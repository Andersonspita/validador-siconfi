import { ParsedData, ValidationResult, MSCAccount, RuleDefinition } from '../types';
import { findInvertedAccounts, buildInvertedItems, mscAccountKey, prefixMessage } from './utils';
import {
  ATIVO_NATUREZA_D_PREFIXES,
  ATIVO_RETIFICADORA_PREFIXES,
  PASSIVO_NATUREZA_C_PREFIXES,
  PL_NATUREZA_C_PREFIXES,
  PL_DEDUCAO_PREFIXES,
  ORCAM_NATUREZA_EXCEPTION_PREFIXES,
} from '../pcaspRules';
import { getExtratoEntregas, buildPendenciasPorPoder, PendenciaPorPoder } from '../../services/siconfiApi';

export async function validateD1_Entrega(data: ParsedData, _rulesMap: Map<string, RuleDefinition>): Promise<ValidationResult[]> {
  const results: ValidationResult[] = [];

  const temMSC  = !!data.msc  && data.msc.length > 0;
  const temRREO = !!data.rreo;
  const temRGF  = !!data.rgf;
  const temDCA  = !!data.dca;

  const ausentes: string[] = [];
  if (!temRREO) ausentes.push('RREO');
  if (!temRGF)  ausentes.push('RGF');
  if (!temDCA)  ausentes.push('DCA');

  // Integracao Siconfi API para Tempestividade
  if (data.enteId && data.anoReferencia) {
    const entregas = await getExtratoEntregas(data.enteId, data.anoReferencia);

    // Nem todo demonstrativo é "de cada Poder": pela LRF, o RGF é elaborado e
    // publicado separadamente por cada Poder/Órgão (art. 20), mas o RREO é um
    // documento ÚNICO e consolidado, elaborado pelo Poder Executivo abrangendo
    // também os demais Poderes (art. 48, caput) — os demais Poderes apenas
    // homologam/assinam a parte deles dentro desse relatório único, não enviam
    // um RREO próprio. O mesmo vale para a DCA (prestação de contas anual
    // consolidada). Por isso a pendência de RREO/DCA aparecendo para um Poder
    // que não o Executivo normalmente significa "aguardando o Executivo
    // concluir/homologar o documento consolidado", e não "este Poder precisa
    // enviar algo por conta própria".
    const CONSOLIDADOS_PELO_EXECUTIVO = ['RREO', 'DCA'];

    const formatPendenciaInstituicao = (pend: PendenciaPorPoder): string => {
      if (pend.poder === 'Executivo') {
        return `${pend.instituicao} [Executivo]: ${pend.pendentes.join(', ')} (elaboração e homologação são responsabilidade direta do Executivo)`;
      }
      const proprios = pend.pendentes.filter(x => !CONSOLIDADOS_PELO_EXECUTIVO.includes(x));
      const consolidados = pend.pendentes.filter(x => CONSOLIDADOS_PELO_EXECUTIVO.includes(x));
      const partes: string[] = [];
      if (proprios.length > 0) {
        partes.push(`${proprios.join(', ')} (elaboração própria deste Poder — LRF art. 20)`);
      }
      if (consolidados.length > 0) {
        partes.push(
          `${consolidados.join(', ')} (documento único e consolidado, elaborado pelo Poder Executivo — LRF art. 48; a pendência aqui reflete a assinatura/homologação da parte deste Poder dentro desse relatório, não um envio separado)`
        );
      }
      return `${pend.instituicao} [${pend.poder}]: ${partes.join('; ')}`;
    };

    if (entregas.length > 0) {
      // Regras de Tempestividade LRF:
      // MSC: Geralmente avaliada no encerramento (D1_00016 já cobre upload local, a API pode confirmar status)
      // RREO: 30 dias após bimestre
      // RGF: 30 dias após quadrimestre/semestre
      // DCA: 30 de abril do ano seguinte
      //
      // IMPORTANTE: um município pode ter mais de um Poder/Órgão prestando
      // contas separadamente (ex.: Prefeitura e Câmara). O Legislativo homologar
      // o RGF dele NÃO significa que o Executivo também homologou o dele — por
      // isso verificamos a homologação POR instituição, não apenas "existe algum
      // registro homologado desse tipo, de qualquer Poder".
      //
      // TODO(limitação conhecida): se um Poder/Órgão nunca enviou absolutamente
      // nada ao Siconfi no exercício (nem rascunho), ele não aparece em
      // `entregas` de forma alguma — logo, buildPendenciasPorPoder() não tem
      // como sinalizar "esse Poder nem consta na resposta da API". Isso é
      // diferente do caso observado em Guanambi/2026 (Prefeitura aparece
      // porque enviou a MSC, só não o RREO/RGF). Para cobrir esse caso extremo,
      // seria necessário comparar contra a lista de instituições/Poderes
      // cadastrados para o ente via GET /ords/siconfi/tt/entes (ou cadastro
      // equivalente), e não apenas contra o que já foi entregue.
      const pendenciasPorPoder = buildPendenciasPorPoder(entregas, ausentes);

      if (pendenciasPorPoder.length > 0 && (temMSC || temRREO || temRGF || temDCA)) {
        const executivoPendente = pendenciasPorPoder.find(p => p.poder === 'Executivo');
        const outrosPendentes = pendenciasPorPoder.filter(p => p.poder !== 'Executivo');
        const todosPendentesUnicos = Array.from(new Set(pendenciasPorPoder.flatMap(p => p.pendentes)));
        const resumoPorInstituicao = pendenciasPorPoder.map(formatPendenciaInstituicao).join(' | ');

        results.push({
          ruleId: 'D1_00001',
          dimension: 'D1',
          description: 'Verificação de entrega dos demonstrativos',
          // Só é IMPEDITIVO se a pendência for do Poder Executivo. Pendência
          // isolada de outro Poder (ex.: Legislativo) ainda é informada, mas
          // como aviso — não bloqueia o relatório do Executivo em si.
          severity: executivoPendente ? 'error' : 'warning',
          impactsCapag: !!executivoPendente,
          affectedAccounts: todosPendentesUnicos,
          message: executivoPendente
            ? `Demonstrativo(s) NÃO homologados na API do Siconfi para o Poder Executivo em ${data.anoReferencia}: ${executivoPendente.pendentes.join(', ')}.` +
              (outrosPendentes.length > 0 ? ` Pendência(s) adicional(is) em outro(s) Poder/Órgão: ${outrosPendentes.map(formatPendenciaInstituicao).join(' | ')}.` : '')
            : `Sem pendência confirmada para o Poder Executivo, mas há demonstrativo(s) NÃO homologado(s) em outro(s) Poder/Órgão do ente: ${resumoPorInstituicao}.`,
          debugInfo: {
            label: `Resposta da API de Homologação (Siconfi) — ente ${data.enteId}, exercício ${data.anoReferencia}`,
            payload: { pendenciasPorPoder, entregas },
          },
        });
      } else if (ausentes.length > 0) {
        results.push({
          ruleId: 'D1_00001',
          dimension: 'D1',
          description: 'Verificação de entrega dos demonstrativos',
          severity: 'info',
          impactsCapag: false,
          affectedAccounts: ausentes,
          message:
            `Os arquivos ${ausentes.join(', ')} não foram inseridos para validação de cruzamento (D3/D4), mas constam como homologados na API do Siconfi para todo(s) o(s) Poder/Órgão identificado(s).`,
          debugInfo: {
            label: `Resposta da API de Homologação (Siconfi) — ente ${data.enteId}, exercício ${data.anoReferencia}`,
            payload: entregas,
          },
        });
      }

      // TODO: Futuramente, podemos adicionar checagem exata de data_entrega x prazos legais.
    } else {
       // Falha na API ou sem dados
       if (ausentes.length > 0 && (temMSC || temRREO || temRGF || temDCA)) {
         results.push({
           ruleId: 'D1_00001',
           dimension: 'D1',
           description: 'Verificação de entrega dos demonstrativos',
           severity: 'warning',
           impactsCapag: false,
           affectedAccounts: ausentes,
           message:
             `Demonstrativo(s) não incluído(s) no upload: ${ausentes.join(', ')}. ` +
             `A API do Siconfi não retornou dados para confirmar homologação. Confirme manualmente no SICONFI.`,
           debugInfo: {
             label: `Resposta da API de Homologação (Siconfi) — ente ${data.enteId}, exercício ${data.anoReferencia}`,
             payload: { items: [], observacao: 'A API não retornou nenhum item (lista vazia) ou a chamada falhou. Veja o console do navegador para detalhes de erro de rede/CORS.' },
           },
         });
       }
    }
  } else {
    // Modo Offline (sem enteId)
    if (ausentes.length > 0 && (temMSC || temRREO || temRGF || temDCA)) {
      results.push({
        ruleId: 'D1_00001',
        dimension: 'D1',
        description: 'Verificação de entrega dos demonstrativos',
        severity: 'info',
        impactsCapag: false,
        affectedAccounts: ausentes,
        message:
          `Demonstrativo(s) ausentes no upload: ${ausentes.join(', ')}. ` +
          `Não foi possível validar a tempestividade (D1) via API porque o código do ente (IBGE) não foi detectado na MSC.`,
      });
    }
  }

  // Regras de Servidor Siconfi (Homologação, Tempestividade e Retificações)
  const serverRules = [
    'D1_00002', 'D1_00003', 'D1_00004', 'D1_00005', 'D1_00006', 'D1_00007', 'D1_00008',
    'D1_00009', 'D1_00010', 'D1_00011', 'D1_00012', 'D1_00013', 'D1_00014', 'D1_00015'
  ];
  serverRules.forEach(ruleId => {
    results.push({
      ruleId,
      dimension: 'D1',
      description: 'Regra validada exclusivamente pelo servidor',
      severity: 'info',
      impactsCapag: false,
      message: `Esta regra refere-se a metadados do servidor do Siconfi (homologação, tempestividade ou retificações) e não pode ser validada offline apenas com os arquivos. Consulte o painel oficial para o status.`,
    });
  });

  // D1_00016: verifica se todas as MSCs do exercício foram enviadas localmente
  if (temMSC && data.mscPeriods && data.mscPeriods.length > 0) {
    const periods = data.mscPeriods;
    const years = Array.from(new Set(periods.map(p => p.split('-')[0])));

    for (const year of years) {
      const yearPeriods = periods.filter(p => p.startsWith(year + '-'));
      const meses = yearPeriods.map(p => parseInt(p.split('-')[1])).sort((a, b) => a - b);
      const allMonths = [1,2,3,4,5,6,7,8,9,10,11,12];
      const missing = allMonths.filter(m => !meses.includes(m));

      if (missing.length > 0) {
        results.push({
          ruleId: 'D1_00016',
          dimension: 'D1',
          description: 'Envio de todas as MSCs do período',
          severity: 'warning',
          impactsCapag: false,
          affectedAccounts: missing.map(m => `${year}-${String(m).padStart(2,'0')}`),
          message:
            `Exercício ${year}: localmente foram enviadas ${yearPeriods.length} MSC(s) (meses: ${meses.join(', ')}). ` +
            `Mês(es) ausente(s): ${missing.map(m => String(m).padStart(2,'0')).join(', ')}. ` +
            `Verifique se as demais foram homologadas no Siconfi.`,
        });
      }
    }
  }

  return results;
}

export function validateD1_MSC(msc: MSCAccount[], _rulesMap: Map<string, RuleDefinition>, periodLabel?: string): ValidationResult[] {
  const results: ValidationResult[] = [];
  const pm = (msg: string) => prefixMessage(msg, periodLabel);

  // D1_00019: PO (Poder/Órgão) com formato inválido
  // O PO deve ser um código de 5 dígitos numéricos e iniciar com 1 (Executivo), 2 (Legislativo), 3 (Judiciário), 4 (MP), 5 (Defensoria) ou 6 (Outros).
  // CORREÇÃO: o mapeamento original deste comentário estava invertido (dizia
  // "1 = Legislativo, 2 = Executivo"). Confirmado com exemplo oficial da STN
  // (Anexo I, Portaria STN nº 642/2019 — Regras Gerais MSC): "IC1 = 10111 [...]
  // esse registro diz respeito ao Poder Executivo Estadual" — ou seja, PO
  // iniciado em '1' é o Executivo. Confirmado também empiricamente com dados
  // reais de Guanambi/BA (2026): PO 10131 tem ~R$1,3 bi em despesa orçamentária
  // e ~R$12,7M em despesa de pessoal (compatível com Executivo); PO 20231 tem
  // ~R$25M e ~R$951k respectivamente (compatível com Legislativo/Câmara).
  const poInvalidos = msc.filter(acc => {
    const po = acc.PO?.trim();
    return po && !/^[123456]\d{4}$/.test(po);
  });
  if (poInvalidos.length > 0) {
    const posUnicas = Array.from(new Set(poInvalidos.map(a => a.PO ?? '')));
    results.push({
      ruleId: 'D1_00019',
      dimension: 'D1',
      description: 'Envio de MSCs com códigos de poder/órgão incorretos',
      severity: 'error',
      impactsCapag: false,
      affectedAccounts: posUnicas.slice(0, 20),
      detailedItems: poInvalidos.slice(0, 30).map(a => ({
        conta: a.CONTA, po: a.PO, fr: a.FR, co: a.CO, valor: a.Valor,
        detalhe: `PO "${a.PO}" inválido. Deve ter 5 dígitos numéricos iniciando por 1 a 6.`,
      })),
      message: `${poInvalidos.length} lançamento(s) com código de Poder/Órgão inválido ou inexistente no Siconfi: ${posUnicas.slice(0, 5).join(', ')}${posUnicas.length > 5 ? '...' : ''}.`,
    });
  }

  // D1_00022: Envio de MSCs com todos os códigos de poder/órgão
  // Verifica se pelo menos o Poder Executivo (PO iniciado em 1) está presente na MSC.
  // BUGFIX: antes checava startsWith('2'), tratando o Legislativo como se fosse
  // o Executivo (ver nota acima, em D1_00019, com a fonte oficial da inversão).
  const temExecutivo = msc.some(acc => acc.PO?.trim().startsWith('1'));
  if (!temExecutivo) {
    results.push({
      ruleId: 'D1_00022',
      dimension: 'D1',
      description: 'Envio de MSCs com todos os códigos de poder/órgão',
      severity: 'error',
      impactsCapag: true,
      message: `O código de Poder/Órgão relativo ao Poder Executivo (iniciado em '1') não foi encontrado nesta MSC. O envio de dados do Executivo é obrigatório.`,
    });
  }

  // D1_00017: Valores negativos
  const negativeAccounts = msc.filter(acc => acc.Valor < 0);
  if (negativeAccounts.length > 0) {
    results.push({
      ruleId: 'D1_00017',
      dimension: 'D1',
      description: 'Envio de MSCs com valores negativos',
      severity: 'error',
      impactsCapag: false,
      affectedAccounts: Array.from(new Set(negativeAccounts.map(a => a.CONTA))),
      detailedItems: negativeAccounts.map(a => ({
        conta: a.CONTA, po: a.PO, fr: a.FR, co: a.CO, valor: a.Valor,
        detalhe: `Tipo: ${a.Tipo_valor} | Natureza: ${a.Natureza_valor}`,
      })),
      message: `${negativeAccounts.length} lançamento(s) com valor negativo. O Siconfi não aceita valores negativos na MSC.`,
    });
  }

  // D1_00018: SI + MOV <> SF
  const accountsMap = new Map<string, { si: number; mov: number; sf: number }>();
  msc.forEach(acc => {
    const key = mscAccountKey(acc);
    if (!accountsMap.has(key)) accountsMap.set(key, { si: 0, mov: 0, sf: 0 });
    const entry = accountsMap.get(key)!;
    const signed = acc.Natureza_valor === 'C' ? -acc.Valor : acc.Valor;
    if (acc.Tipo_valor === 'beginning_balance') entry.si += signed;
    else if (acc.Tipo_valor === 'period_change') entry.mov += signed;
    else if (acc.Tipo_valor === 'ending_balance') entry.sf += signed;
  });

  const inconsistentAccounts: string[] = [];
  const detailedInconsistencies: import('../types').DetailedItem[] = [];
  accountsMap.forEach((vals, key) => {
    const diff = Math.abs((vals.si + vals.mov) - vals.sf);
    if (diff > 0.01) {
      const parts = key.split('|');
      inconsistentAccounts.push(parts[0]);
      const fmt = (v: number) => Math.abs(v).toFixed(2) + (v < 0 ? 'C' : 'D');
      detailedInconsistencies.push({
        conta: parts[0], po: parts[1], fr: parts[4], co: parts[5],
        detalhe: `SI: ${fmt(vals.si)} | MOV: ${fmt(vals.mov)} | SF Esp: ${fmt(vals.si + vals.mov)} | SF Inf: ${fmt(vals.sf)} | Dif: ${diff.toFixed(2)}`,
      });
    }
  });
  if (inconsistentAccounts.length > 0) {
    results.push({
      ruleId: 'D1_00018',
      dimension: 'D1',
      description: 'SI + MOV <> SF',
      severity: 'warning',
      impactsCapag: false,
      affectedAccounts: Array.from(new Set(inconsistentAccounts)),
      detailedItems: detailedInconsistencies,
      message: pm(
        `${inconsistentAccounts.length} combinação(ões) de conta+IC com movimentação inconsistente (SI + MOV ≠ SF). ` +
        `Reclassificações de Indicador de Conta (FR, CO, ND) entre períodos podem gerar esta diferença de forma legítima — ` +
        `verifique prioritariamente registros com diferença acima de R$ 1.000.`
      ),
      actionPlan:
        'Para cada item detalhado: verifique se houve reclassificação intencional de IC (ex.: mudança de fonte de recurso). ' +
        'Se não houver justificativa, corrija o saldo inicial ou a movimentação no sistema contábil.',
    });
  }

  // D1_00021: Ativo com saldo invertido — exclui contas retificadoras (depreciação acumulada)
  const activeInverted = findInvertedAccounts(msc, ATIVO_NATUREZA_D_PREFIXES, 'D', ATIVO_RETIFICADORA_PREFIXES);
  if (activeInverted.length > 0) {
    const uniqueContas = Array.from(new Set(activeInverted.map(a => a.CONTA)));
    results.push({
      ruleId: 'D1_00021',
      dimension: 'D1',
      description: 'Contas do ativo com saldo invertido',
      severity: 'warning',
      impactsCapag: false,
      affectedAccounts: uniqueContas,
      detailedItems: buildInvertedItems(activeInverted, 'D'),
      message: pm(`${activeInverted.length} registro(s) / ${uniqueContas.length} conta(s) PCASP do ativo com natureza Credora (C). Natureza padrão: Devedora (D).`),
    });
  }

  // D1_00025: Passivo circulante/não-circulante com saldo invertido — natureza padrão C
  const passivoInverted = findInvertedAccounts(msc, PASSIVO_NATUREZA_C_PREFIXES, 'C');
  if (passivoInverted.length > 0) {
    const uniqueContas = Array.from(new Set(passivoInverted.map(a => a.CONTA)));
    results.push({
      ruleId: 'D1_00025',
      dimension: 'D1',
      description: 'Contas do passivo com saldo invertido',
      severity: 'warning',
      impactsCapag: false,
      affectedAccounts: uniqueContas,
      detailedItems: buildInvertedItems(passivoInverted, 'C'),
      message: pm(`${passivoInverted.length} registro(s) / ${uniqueContas.length} conta(s) do passivo com natureza Devedora (D). Natureza padrão: Credora (C).`),
    });
  }

  // D1_00026: Patrimônio líquido com saldo invertido — exclui deduções do PL (natureza D legítima)
  const plInverted = findInvertedAccounts(msc, PL_NATUREZA_C_PREFIXES, 'C', PL_DEDUCAO_PREFIXES);
  if (plInverted.length > 0) {
    const uniqueContas = Array.from(new Set(plInverted.map(a => a.CONTA)));
    results.push({
      ruleId: 'D1_00026',
      dimension: 'D1',
      description: 'Contas de patrimônio líquido com saldo invertido',
      severity: 'warning',
      impactsCapag: false,
      affectedAccounts: uniqueContas,
      detailedItems: buildInvertedItems(plInverted, 'C'),
      message: pm(`${plInverted.length} registro(s) / ${uniqueContas.length} conta(s) do Patrimônio Líquido com natureza Devedora (D). Natureza padrão: Credora (C).`),
    });
  }

  // D1_00028: Todas as classes (1–8) presentes na MSC
  // Classes 7 e 8 (DDR — controle) podem ser ausentes em municípios sem RPPS ou obrigações
  // contingentes: tratadas como 'info' para não gerar falso positivo.
  const presentClasses = new Set(msc.filter(a => a.Valor !== 0).map(a => a.CONTA[0]));
  const missingObrig  = ['1','2','3','4','5','6'].filter(c => !presentClasses.has(c));
  const missingDDR    = ['7','8'].filter(c => !presentClasses.has(c));

  if (missingObrig.length > 0) {
    results.push({
      ruleId: 'D1_00028',
      dimension: 'D1',
      description: 'MSC com informação de todas as classes de contas',
      severity: 'warning',
      impactsCapag: false,
      affectedAccounts: missingObrig.map(c => `Classe ${c}`),
      message: `Classe(s) obrigatória(s) ausente(s) na MSC: ${missingObrig.map(c => `Classe ${c}`).join(', ')}. A MSC deve conter valores nas classes patrimonial (1–4) e orçamentária (5–6).`,
    });
  }
  if (missingDDR.length > 0) {
    results.push({
      ruleId: 'D1_00028',
      dimension: 'D1',
      description: 'MSC com informação de todas as classes de contas',
      severity: 'info',
      impactsCapag: false,
      affectedAccounts: missingDDR.map(c => `Classe ${c}`),
      message: `Classe(s) de controle DDR ausente(s) na MSC: ${missingDDR.map(c => `Classe ${c}`).join(', ')}. Classes 7 e 8 são esperadas pelo Siconfi mas podem ser legitimamente ausentes em municípios sem RPPS ou sem obrigações contingentes registradas.`,
    });
  }

  // D1_00029: Contas de receita (6211, 6212, 6213) sem FR
  const receitaSemFR = msc.filter(acc =>
    (acc.CONTA.startsWith('6211') || acc.CONTA.startsWith('6212') || acc.CONTA.startsWith('6213')) &&
    acc.Tipo_valor === 'ending_balance' && acc.Valor > 0 &&
    (!acc.FR || acc.FR.trim() === '' || acc.FR.trim() === '0000')
  );
  if (receitaSemFR.length > 0) {
    results.push({
      ruleId: 'D1_00029',
      dimension: 'D1',
      description: 'Contas de receita orçamentária sem fonte ou destinação de recurso',
      severity: 'warning',
      impactsCapag: false,
      affectedAccounts: Array.from(new Set(receitaSemFR.map(a => a.CONTA))),
      detailedItems: receitaSemFR.map(a => ({ conta: a.CONTA, po: a.PO, fr: a.FR, co: a.CO, valor: a.Valor, detalhe: 'FR ausente ou zerado' })),
      message: `${receitaSemFR.length} lançamento(s) nos grupos 6211/6212/6213 sem detalhamento de Fonte ou Destinação de Recurso (FR).`,
    });
  }

  // D1_00030: Contas de receita (6211, 6212, 6213) sem natureza de receita (CO)
  const receitaSemCO = msc.filter(acc =>
    (acc.CONTA.startsWith('6211') || acc.CONTA.startsWith('6212') || acc.CONTA.startsWith('6213')) &&
    acc.Tipo_valor === 'ending_balance' && acc.Valor > 0 &&
    (!acc.CO || acc.CO.trim() === '' || acc.CO.trim() === '0000')
  );
  if (receitaSemCO.length > 0) {
    results.push({
      ruleId: 'D1_00030',
      dimension: 'D1',
      description: 'Contas de receita orçamentária sem natureza da receita',
      severity: 'warning',
      impactsCapag: false,
      affectedAccounts: Array.from(new Set(receitaSemCO.map(a => a.CONTA))),
      detailedItems: receitaSemCO.map(a => ({ conta: a.CONTA, po: a.PO, fr: a.FR, co: a.CO, valor: a.Valor, detalhe: 'Natureza de receita (CO) ausente' })),
      message: `${receitaSemCO.length} lançamento(s) nos grupos 6211/6212/6213 sem detalhamento de Natureza da Receita (CO).`,
    });
  }

  // D1_00027: Contas com atributo F (superávit financeiro) sem detalhamento de FR
  const fpSemFR = msc.filter(acc =>
    acc.FP === 'F' &&
    (!acc.FR || acc.FR.trim() === '' || acc.FR.trim() === '0000')
  );
  if (fpSemFR.length > 0) {
    results.push({
      ruleId: 'D1_00027',
      dimension: 'D1',
      description: 'Contas com atributo F (financeiro) sem detalhamento de fonte ou destinação de recursos',
      severity: 'warning',
      impactsCapag: false,
      affectedAccounts: Array.from(new Set(fpSemFR.map(a => a.CONTA))),
      detailedItems: fpSemFR.map(a => ({ conta: a.CONTA, po: a.PO, fr: a.FR, co: a.CO, valor: a.Valor, detalhe: `FP: ${a.FP} | FR: ${a.FR || '(vazio)'}` })),
      message: `${fpSemFR.length} lançamento(s) com atributo F (superávit financeiro) sem detalhamento de Fonte ou Destinação de Recurso (FR). Contas com atributo F precisam de FR preenchido.`,
    });
  }

  // D1_00031: Contas de despesa (62213) sem natureza de despesa (ND = IC5)
  const despesaSemND = msc.filter(acc =>
    acc.CONTA.startsWith('62213') &&
    acc.Tipo_valor === 'ending_balance' && acc.Valor > 0 &&
    (!acc.ND || acc.ND.trim() === '' || acc.ND === '00000000')
  );
  if (despesaSemND.length > 0) {
    results.push({
      ruleId: 'D1_00031',
      dimension: 'D1',
      description: 'Contas de despesa orçamentária sem natureza de despesa',
      severity: 'warning',
      impactsCapag: false,
      affectedAccounts: Array.from(new Set(despesaSemND.map(a => a.CONTA))),
      detailedItems: despesaSemND.map(a => ({ conta: a.CONTA, po: a.PO, fr: a.FR, co: a.CO, valor: a.Valor, detalhe: 'Natureza de despesa (ND/IC5) ausente ou zerada' })),
      message: `${despesaSemND.length} lançamento(s) no grupo 62213 sem detalhamento de Natureza da Despesa (ND).`,
    });
  }

  // D1_00032: Contas de despesa (622xxx) sem função/subfunção (FS = IC2)
  const despesaSemFS = msc.filter(acc =>
    acc.CONTA.startsWith('622') &&
    acc.Tipo_valor === 'ending_balance' && acc.Valor > 0 &&
    (!acc.FS || acc.FS.trim() === '' || acc.FS.trim() === '00000')
  );
  if (despesaSemFS.length > 0) {
    results.push({
      ruleId: 'D1_00032',
      dimension: 'D1',
      description: 'Contas de despesa orçamentária sem detalhamento de função/subfunção',
      severity: 'warning',
      impactsCapag: false,
      affectedAccounts: Array.from(new Set(despesaSemFS.map(a => a.CONTA))),
      detailedItems: despesaSemFS.map(a => ({ conta: a.CONTA, po: a.PO, fr: a.FR, co: a.CO, valor: a.Valor, detalhe: `FS: ${a.FS || '(vazio)'}` })),
      message: `${despesaSemFS.length} lançamento(s) no grupo 622 sem detalhamento de Função/Subfunção (FS).`,
    });
  }

  // D1_00033: Contas de despesa (62213) sem fonte de recurso (FR)
  const despesaSemFR = msc.filter(acc =>
    acc.CONTA.startsWith('62213') &&
    acc.Tipo_valor === 'ending_balance' && acc.Valor > 0 &&
    (!acc.FR || acc.FR.trim() === '' || acc.FR.trim() === '0000')
  );
  if (despesaSemFR.length > 0) {
    results.push({
      ruleId: 'D1_00033',
      dimension: 'D1',
      description: 'Contas de despesa orçamentária sem fonte ou destinação de recursos',
      severity: 'warning',
      impactsCapag: false,
      affectedAccounts: Array.from(new Set(despesaSemFR.map(a => a.CONTA))),
      detailedItems: despesaSemFR.map(a => ({ conta: a.CONTA, po: a.PO, fr: a.FR, co: a.CO, valor: a.Valor, detalhe: 'FR ausente ou zerado' })),
      message: `${despesaSemFR.length} lançamento(s) no grupo 62213 sem detalhamento de Fonte ou Destinação de Recurso (FR).`,
    });
  }

  // D1_00034: VPD (grupos 311–363) com saldo invertido — natureza padrão D
  const vpdPrefixes = [
    '311','312','313','321','322','323',
    '331','332','333','351','352','353','361','362','363',
  ];
  const vpdInverted = findInvertedAccounts(msc, vpdPrefixes, 'D');
  if (vpdInverted.length > 0) {
    results.push({
      ruleId: 'D1_00034',
      dimension: 'D1',
      description: 'Contas de VPD com saldo invertido',
      severity: 'warning',
      impactsCapag: false,
      affectedAccounts: Array.from(new Set(vpdInverted.map(a => a.CONTA))),
      detailedItems: buildInvertedItems(vpdInverted, 'D'),
      message: `${vpdInverted.length} conta(s) de VPD (Variação Patrimonial Diminutiva) com natureza Credora (C). Natureza padrão: Devedora (D).`,
    });
  }

  // D1_00035: VPA (classe 4) com saldo invertido — natureza padrão C
  const vpaInverted = findInvertedAccounts(msc, ['4'], 'C');
  if (vpaInverted.length > 0) {
    results.push({
      ruleId: 'D1_00035',
      dimension: 'D1',
      description: 'Contas de VPA com saldo invertido',
      severity: 'warning',
      impactsCapag: false,
      affectedAccounts: Array.from(new Set(vpaInverted.map(a => a.CONTA))),
      detailedItems: buildInvertedItems(vpaInverted, 'C'),
      message: `${vpaInverted.length} conta(s) de VPA (Variação Patrimonial Aumentativa) com natureza Devedora (D). Natureza padrão: Credora (C).`,
    });
  }

  // D1_00037: Fontes de recursos da União (FR 001–499) em MSC de estados/municípios
  // Estados e municípios não devem registrar movimentações em fontes 001-499 (reservadas à União)
  const frUniao = msc.filter(acc => {
    const frNum = parseInt(acc.FR ?? '', 10);
    return !isNaN(frNum) && frNum >= 1 && frNum <= 499 && acc.Valor !== 0;
  });
  if (frUniao.length > 0) {
    const frsUnicas = Array.from(new Set(frUniao.map(a => a.FR!.padStart(4, '0')))).sort();
    results.push({
      ruleId: 'D1_00037',
      dimension: 'D1',
      description: 'MSC com fontes de recursos da União (000–499)',
      severity: 'warning',
      impactsCapag: false,
      affectedAccounts: frsUnicas,
      detailedItems: frUniao.slice(0, 50).map(a => ({ conta: a.CONTA, po: a.PO, fr: a.FR, co: a.CO, valor: a.Valor, detalhe: `FR: ${a.FR} (faixa reservada à União)` })),
      message: `${frUniao.length} lançamento(s) utilizam Fonte(s) de Recurso da União (${frsUnicas.slice(0,5).join(', ')}${frsUnicas.length > 5 ? '...' : ''}). Estados e municípios devem usar fontes ≥ 500.`,
    });
  }

  // D1_00038: Classe 5/6 com saldo invertido — exclui contas de cancelamento/estorno legítimos
  const isOrcamException = (conta: string) =>
    ORCAM_NATUREZA_EXCEPTION_PREFIXES.some(p => conta.startsWith(p));

  const orcamInvertedC = findInvertedAccounts(msc, ['511', '621'], 'C')
    .filter(a => !isOrcamException(a.CONTA));
  const orcamInvertedD = findInvertedAccounts(msc, ['512', '622'], 'D')
    .filter(a => !isOrcamException(a.CONTA));
  const orcamInverted = [...orcamInvertedC, ...orcamInvertedD];
  if (orcamInverted.length > 0) {
    results.push({
      ruleId: 'D1_00038',
      dimension: 'D1',
      description: 'Contas de classe 5 e 6 com saldo invertido',
      severity: 'warning',
      impactsCapag: false,
      affectedAccounts: Array.from(new Set(orcamInverted.map(a => a.CONTA))),
      detailedItems: orcamInverted.map(a => {
        const esperado = a.CONTA.startsWith('511') || a.CONTA.startsWith('621') ? 'C' : 'D';
        return { conta: a.CONTA, po: a.PO, fr: a.FR, co: a.CO, valor: a.Valor, detalhe: `Natureza informada: ${a.Natureza_valor} (esperado: ${esperado})` };
      }),
      message: pm(`${orcamInverted.length} conta(s) orçamentária(s) (classes 5/6) com natureza diferente do padrão PCASP.`),
    });
  }

  return results;
}

export function validateD1_Encerramento(msc: MSCAccount[], _rulesMap: Map<string, RuleDefinition>, periodLabel?: string): ValidationResult[] {
  const results: ValidationResult[] = [];
  const pm = (msg: string) => prefixMessage(msg, periodLabel);

  // D1_00036: MSC de encerramento não pode ter saldo final nas contas de VPA (classe 4) e VPD (classe 3)
  const vpaVpdComSaldo = msc.filter(acc =>
    (acc.CONTA.startsWith('3') || acc.CONTA.startsWith('4')) &&
    acc.Tipo_valor === 'ending_balance' &&
    acc.Valor !== 0
  );
  if (vpaVpdComSaldo.length > 0) {
    results.push({
      ruleId: 'D1_00036',
      dimension: 'D1',
      description: 'MSC encerramento com saldo final nas contas VPA e VPD',
      severity: 'error',
      impactsCapag: false,
      affectedAccounts: Array.from(new Set(vpaVpdComSaldo.map(a => a.CONTA))).slice(0, 20),
      detailedItems: vpaVpdComSaldo.slice(0, 30).map(a => ({
        conta: a.CONTA, po: a.PO, fr: a.FR, co: a.CO, valor: a.Valor,
        detalhe: `Natureza: ${a.Natureza_valor} | As contas de resultado (VPA/VPD) devem ser zeradas no encerramento`,
      })),
      message: pm(`${vpaVpdComSaldo.length} conta(s) de VPA (classe 4) ou VPD (classe 3) com saldo final diferente de zero na MSC de encerramento. O encerramento exige que essas contas sejam zeradas.`),
    });
  }

  // D2_00076: Se há VPA de juros de créditos previdenciários parcelados (44252xxx, beginning_balance > 0),
  // deve haver crédito registrado no ativo (112127, 121120, 113620 — todos beginning_balance)
  const temJurosParcelamento = msc.some(acc =>
    acc.CONTA.startsWith('44252') && acc.Tipo_valor === 'beginning_balance' && acc.Valor > 0
  );
  if (temJurosParcelamento) {
    const temCreditoAtivo = msc.some(acc =>
      (acc.CONTA.startsWith('112127') || acc.CONTA.startsWith('121120') || acc.CONTA.startsWith('113620')) &&
      acc.Tipo_valor === 'beginning_balance' && acc.Valor > 0
    );
    if (!temCreditoAtivo) {
      results.push({
        ruleId: 'D2_00076', dimension: 'D2', description: '', severity: 'warning', impactsCapag: false,
        affectedAccounts: ['44252', '112127', '121120', '113620'],
        message: `Há VPA de juros de créditos previdenciários parcelados (44252xxx) mas não foram encontrados os respectivos créditos no ativo (112127/121120/113620). O PIPCP exige esse registro.`,
      });
    }
  }

  return results;
}


export function validateMultiMonth(
  mscByPeriod: Record<string, MSCAccount[]>,
  _rulesMap: Map<string, RuleDefinition>
): ValidationResult[] {
  const results: ValidationResult[] = [];

  const allPeriods = Object.keys(mscByPeriod).sort();
  const regular = allPeriods.filter(p => {
    const m = parseInt(p.split('-')[1] || '0');
    return m >= 1 && m <= 12;
  });

  for (let i = 1; i < regular.length; i++) {
    const prevPeriod = regular[i - 1];
    const currPeriod = regular[i];
    const prevMsc = mscByPeriod[prevPeriod];
    const currMsc = mscByPeriod[currPeriod];

    // D1_00023: Envio de MSCs com dados do poder executivo iguais entre meses diferentes
    // BUGFIX: PO 1x = Executivo (ver nota em D1_00019/D1_00022).
    const prevExec = prevMsc.filter(a => a.PO?.startsWith('1'));
    const currExec = currMsc.filter(a => a.PO?.startsWith('1'));
    if (prevExec.length > 0 && currExec.length > 0 && prevExec.length === currExec.length) {
      // Correção QA-006: comparação via Map (insensível à ordem de exportação)
      const currExecMap = new Map(currExec.map(a => [mscAccountKey(a), a.Valor]));
      const same = prevExec.every(p => {
        const key = mscAccountKey(p);
        return currExecMap.has(key) && Math.abs((currExecMap.get(key) ?? -1) - p.Valor) < 0.01;
      });
      if (same) {
        results.push({
          ruleId: 'D1_00023', dimension: 'D1', description: 'MSCs idênticas do Executivo', severity: 'warning', impactsCapag: false,
          message: `Os dados do Poder Executivo nas MSCs de ${prevPeriod} e ${currPeriod} são exatamente iguais.`
        });
      }
    }

    // D1_00024: Envio de MSCs com dados do legislativo iguais entre meses diferentes
    // BUGFIX: PO 2x = Legislativo (ver nota em D1_00019/D1_00022).
    const prevLeg = prevMsc.filter(a => a.PO?.startsWith('2'));
    const currLeg = currMsc.filter(a => a.PO?.startsWith('2'));
    if (prevLeg.length > 0 && currLeg.length > 0 && prevLeg.length === currLeg.length) {
      // Correção QA-006: comparação via Map (insensível à ordem de exportação)
      const currLegMap = new Map(currLeg.map(a => [mscAccountKey(a), a.Valor]));
      const same = prevLeg.every(p => {
        const key = mscAccountKey(p);
        return currLegMap.has(key) && Math.abs((currLegMap.get(key) ?? -1) - p.Valor) < 0.01;
      });
      if (same) {
        results.push({
          ruleId: 'D1_00024', dimension: 'D1', description: 'MSCs idênticas do Legislativo', severity: 'warning', impactsCapag: false,
          message: `Os dados do Poder Legislativo nas MSCs de ${prevPeriod} e ${currPeriod} são exatamente iguais.`
        });
      }
    }

    const accsPrev = prevMsc.filter(a => a.CONTA.startsWith('1') || a.CONTA.startsWith('2'));
    let hasDiff = false;

    for (const pAcc of accsPrev) {
      if (pAcc.Tipo_valor !== 'ending_balance') continue;
      const cAcc = currMsc.find(a => mscAccountKey(a) === mscAccountKey(pAcc) && a.Tipo_valor === 'beginning_balance');
      if (cAcc) {
        const sfPrev = pAcc.Natureza_valor === 'C' ? -pAcc.Valor : pAcc.Valor;
        const siCurr = cAcc.Natureza_valor === 'C' ? -cAcc.Valor : cAcc.Valor;
        if (Math.abs(siCurr - sfPrev) > 0.01) {
          hasDiff = true;
          results.push({
            ruleId: 'D2_00077',
            dimension: 'D2',
            description: 'Validação de saldo inicial x final',
            severity: 'error',
            impactsCapag: false,
            message: `Conta ${pAcc.CONTA}: O saldo final de ${prevPeriod} (R$ ${Math.abs(sfPrev).toFixed(2)}${sfPrev < 0 ? 'C' : 'D'}) difere do saldo inicial de ${currPeriod} (R$ ${Math.abs(siCurr).toFixed(2)}${siCurr < 0 ? 'C' : 'D'}).`,
          });
        }
      }
    }

    // D1_00020: Envio de MSCs com diferenças nos saldos entre meses diferentes
    if (hasDiff) {
      results.push({
        ruleId: 'D1_00020', dimension: 'D1', description: 'Diferença de saldos entre meses', severity: 'error', impactsCapag: true,
        message: `Foram encontradas diferenças entre os saldos finais de ${prevPeriod} e os saldos iniciais de ${currPeriod} (ver detalhes na D2_00077).`
      });
    }
  }

  return results;
}
