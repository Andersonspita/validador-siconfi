/**
 * correctiveEntries.ts
 *
 * Mapeia cada regra de validação ao(s) lançamento(s) contábil(is) PCASP
 * que corrigem a inconsistência detectada.
 *
 * Referência: MCASP 11ª edição · PCASP · MDF 15ª edição
 */

import { ValidationResult, SuggestedEntry, MSCAccount } from './types';
import { DDR_DEVEDORA_PREFIXES, DDR_CREDORA_PREFIXES, PROVISAO_FERIAS_13_CONTAS } from './pcaspRules';
import { getNetBalance, sumAccounts } from './validators/utils';

// ─── Helpers internos ────────────────────────────────────────────────────────

const brl = (v: number) =>
  v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Lançamento simples D/C com valor calculado. */
function entry(
  descricao: string,
  debitoConta: string, debitoDesc: string,
  creditoConta: string, creditoDesc: string,
  valor?: number,
  obs?: string
): SuggestedEntry {
  return { descricao, debito: { conta: debitoConta, descricao: debitoDesc }, credito: { conta: creditoConta, descricao: creditoDesc }, valor, obs };
}

// ─── Gerador principal ───────────────────────────────────────────────────────

/**
 * Para um resultado de validação e os dados da MSC, retorna os
 * lançamentos PCASP sugeridos para corrigir a inconsistência.
 */
export function buildCorrectiveEntries(
  result: ValidationResult,
  msc: MSCAccount[]
): SuggestedEntry[] {
  switch (result.ruleId) {

    // ── D2_00083: Desequilíbrio DDR (7211 × 8211) ───────────────────────────
    case 'D2_00083': {
      const v7211 = getNetBalance(msc, DDR_DEVEDORA_PREFIXES, 'ending_balance', 'D');
      const v8211 = getNetBalance(msc, DDR_CREDORA_PREFIXES,  'ending_balance', 'C');
      const diff  = Math.abs(v7211 - v8211);
      if (v8211 > v7211) {
        return [entry(
          'Ajuste do controle devedor DDR para equilibrar com o controle credor',
          '721110000', 'Disponibilidades por Destinação de Recursos — Devedora (DDR)',
          '821110000', 'Disponibilidades por Destinação de Recursos — Credora (DDR)',
          diff,
          `Diferença apurada: R$ ${brl(diff)}. O saldo 8211 (R$ ${brl(v8211)}) supera o 7211 (R$ ${brl(v7211)}). ` +
          `Verifique no sistema contábil qual destinação de recurso gerou o desequilíbrio e registre o ajuste na conta correta do subgrupo 721/821 correspondente à fonte. ` +
          `Ref.: MCASP 11ª ed., Parte II, Cap. 8 — DDR.`
        )];
      } else {
        return [entry(
          'Ajuste do controle credor DDR para equilibrar com o controle devedor',
          '821110000', 'Disponibilidades por Destinação de Recursos — Credora (DDR)',
          '721110000', 'Disponibilidades por Destinação de Recursos — Devedora (DDR)',
          diff,
          `Diferença apurada: R$ ${brl(diff)}. O saldo 7211 (R$ ${brl(v7211)}) supera o 8211 (R$ ${brl(v8211)}). ` +
          `Verifique a destinação de recurso de origem e registre o ajuste na conta correta. ` +
          `Ref.: MCASP 11ª ed., Parte II, Cap. 8 — DDR.`
        )];
      }
    }

    // ── D2_00081: Férias e 13º sem provisão ─────────────────────────────────
    case 'D2_00081': {
      const ausentes = PROVISAO_FERIAS_13_CONTAS.filter(c =>
        !msc.some(a => a.CONTA === c && a.Tipo_valor === 'ending_balance' && a.Valor > 0)
      );
      const vlPessoal = sumAccounts(msc, ['311'], 'period_change', 'D');
      const porItem   = ausentes.length ? Math.round(vlPessoal * 0.08 / ausentes.length) : 0;

      const labelMap: Record<string, string> = {
        '211110102': 'Provisão para Férias',
        '211110103': 'Provisão para 13º Salário',
        '211110104': 'Provisão para 13º Salário Proporcional',
      };
      const vpdMap: Record<string, [string, string]> = {
        '211110102': ['311210103', 'VPD — Provisão de Férias'],
        '211110103': ['311210104', 'VPD — Provisão de 13º Salário'],
        '211110104': ['311210105', 'VPD — Provisão de 13º Salário Proporcional'],
      };

      return ausentes.map(conta => entry(
        `Reconhecimento por competência — ${labelMap[conta] ?? conta}`,
        vpdMap[conta]?.[0] ?? '311210199', vpdMap[conta]?.[1] ?? 'VPD — Provisão de Pessoal',
        conta, labelMap[conta] ?? conta,
        porItem || undefined,
        `Valor estimado com base em 8% das despesas de pessoal do período (R$ ${brl(vlPessoal)}). ` +
        `Calcule o valor exato conforme o quadro de servidores antes de lançar. ` +
        `Ref.: MCASP 11ª ed., Parte II, Cap. 6 — Benefícios a Empregados.`
      ));
    }

    // ── D2_00067: Depreciação bens móveis > valor bruto ─────────────────────
    case 'D2_00067': {
      const vBens = sumAccounts(msc, ['1231'], 'ending_balance', 'D');
      const vDepr = sumAccounts(msc, ['1238101'], 'ending_balance', 'C');
      const excesso = vDepr - vBens;
      return [entry(
        'Estorno do excesso de depreciação acumulada de bens móveis',
        '123810100', 'Depreciação Acumulada — Bens Móveis',
        '311910100', 'VPD — Reversão de Depreciação de Bens Móveis',
        excesso > 0 ? excesso : undefined,
        `A depreciação acumulada (R$ ${brl(vDepr)}) supera o custo histórico dos bens móveis (R$ ${brl(vBens)}) em R$ ${brl(Math.max(0, excesso))}. ` +
        `Estorne o excesso ou reavalie os ativos. Ref.: MCASP 11ª ed., NBC TSP 07.`
      )];
    }

    // ── D2_00068: Depreciação bens imóveis > valor bruto ────────────────────
    case 'D2_00068': {
      const vBens = sumAccounts(msc, ['1232'], 'ending_balance', 'D');
      const vDepr = sumAccounts(msc, ['1238102'], 'ending_balance', 'C');
      const excesso = vDepr - vBens;
      return [entry(
        'Estorno do excesso de depreciação acumulada de bens imóveis',
        '123810200', 'Depreciação Acumulada — Bens Imóveis',
        '311910200', 'VPD — Reversão de Depreciação de Bens Imóveis',
        excesso > 0 ? excesso : undefined,
        `A depreciação acumulada (R$ ${brl(vDepr)}) supera o custo histórico dos bens imóveis (R$ ${brl(vBens)}) em R$ ${brl(Math.max(0, excesso))}. ` +
        `Estorne o excesso ou proceda à reavaliação patrimonial. Ref.: MCASP 11ª ed., NBC TSP 07.`
      )];
    }

    // ── D2_00055: Amortização intangível > valor bruto ──────────────────────
    case 'D2_00055': {
      const vAtivo = sumAccounts(msc, ['124'], 'ending_balance', 'D', ['1248']);
      const vAmort = sumAccounts(msc, ['1248'], 'ending_balance', 'C');
      const excesso = vAmort - vAtivo;
      return [entry(
        'Estorno do excesso de amortização acumulada de intangíveis',
        '124810000', 'Amortização Acumulada — Ativo Intangível',
        '311910300', 'VPD — Reversão de Amortização de Intangíveis',
        excesso > 0 ? excesso : undefined,
        `Amortização acumulada (R$ ${brl(vAmort)}) supera o valor bruto do ativo intangível (R$ ${brl(vAtivo)}). ` +
        `Estorne o excesso. Ref.: MCASP 11ª ed., NBC TSP 31.`
      )];
    }

    // ── D2_00053: Perdas estoques > estoque bruto ───────────────────────────
    case 'D2_00053': {
      const vEst  = sumAccounts(msc, ['115'], 'ending_balance', 'D', ['1158']);
      const vPerda = sumAccounts(msc, ['1158'], 'ending_balance', 'C');
      const excesso = vPerda - vEst;
      return [entry(
        'Estorno do excesso de ajuste para perdas de estoques',
        '115810000', 'Ajuste de Perdas de Estoques',
        '311810000', 'VPD — Reversão de Ajuste de Perdas de Estoques',
        excesso > 0 ? excesso : undefined,
        `O ajuste para perdas (R$ ${brl(vPerda)}) supera o estoque bruto (R$ ${brl(vEst)}). ` +
        `Estorne o excesso ou baixe os estoques inexistentes. Ref.: MCASP 11ª ed., NBC TSP 12.`
      )];
    }

    // ── D2_00059/60: Perdas de créditos > valor dos créditos ────────────────
    case 'D2_00059':
    case 'D2_00060': {
      return [entry(
        'Estorno do excesso de ajuste para perdas de créditos',
        '112900000', 'Ajuste de Perdas de Créditos a Curto Prazo',
        '311710000', 'VPD — Reversão de Ajuste de Perdas de Créditos',
        undefined,
        `O ajuste para perdas supera o valor bruto dos créditos. Calcule o excesso e estorne. ` +
        `Ref.: MCASP 11ª ed., NBC TSP 29.`
      )];
    }

    // ── D2_00030/31/34/40: Saldos negativos ─────────────────────────────────
    case 'D2_00030':
    case 'D2_00031':
    case 'D2_00034':
    case 'D2_00040': {
      return [{
        descricao: 'Estorno do lançamento que gerou saldo negativo',
        debito:  { conta: '[conta com saldo negativo]', descricao: 'Conta com saldo negativo — ver detalhes' },
        credito: { conta: '[conta de contrapartida original]', descricao: 'Contrapartida do lançamento original' },
        obs: `O PCASP não permite saldo com sinal negativo — use a natureza de saldo correta (D ou C). ` +
             `Identifique o lançamento original que gerou o valor negativo e proceda ao estorno ou reclassificação. ` +
             `Ref.: MCASP 11ª ed., Parte II, Cap. 2.`
      }];
    }

    // ── D2_00094: Pessoal RPPS sem contribuição patronal ────────────────────
    case 'D2_00094': {
      const vlRPPS = sumAccounts(msc, ['311110101'], 'period_change', 'D');
      const contrib = vlRPPS * 0.22; // alíquota patronal típica RPPS
      return [entry(
        'Registro da contribuição patronal para o RPPS',
        '312120100', 'VPD — Contribuição Patronal para RPPS',
        '211110200', 'Contribuições Previdenciárias a Recolher — RPPS',
        contrib || undefined,
        `Valor estimado com alíquota patronal de 22% sobre as despesas RPPS (R$ ${brl(vlRPPS)}). ` +
        `Confirme a alíquota patronal vigente no plano de custeio do seu RPPS antes de lançar.`
      )];
    }

    // ── D2_00095: Pessoal RGPS sem INSS/FGTS ────────────────────────────────
    case 'D2_00095': {
      const vlRGPS = sumAccounts(msc, ['311210101'], 'period_change', 'D');
      return [
        entry(
          'Registro da contribuição patronal INSS (RGPS)',
          '312210100', 'VPD — Contribuição Patronal para RGPS (INSS)',
          '211110301', 'Contribuições Previdenciárias a Recolher — INSS',
          vlRGPS * 0.20 || undefined,
          `Alíquota patronal estimada em 20% sobre salários RGPS (R$ ${brl(vlRGPS)}). Confirme a base de cálculo.`
        ),
        entry(
          'Registro do FGTS (RGPS)',
          '312230100', 'VPD — FGTS',
          '211110302', 'FGTS a Recolher',
          vlRGPS * 0.08 || undefined,
          `Alíquota FGTS estimada em 8% sobre salários (R$ ${brl(vlRGPS)}). Confirme a base e o percentual aplicável.`
        ),
      ];
    }

    // ── D1_00021: Ativo com saldo Credor (invertido) ────────────────────────
    case 'D1_00021': {
      const affected = result.affectedAccounts ?? [];
      if (!affected.length) return [];
      return [entry(
        'Reclassificação de saldo credor indevido em conta do Ativo',
        affected[0], `Conta do Ativo com saldo C indevido (${affected[0]})`,
        '[conta de origem do crédito]', 'Contrapartida do lançamento original incorreto',
        undefined,
        `Contas do ativo (grupos ${affected.slice(0,3).join(', ')}) devem ter saldo Devedor. ` +
        `Se o saldo C for legítimo (ex.: ajuste de avaliação patrimonial), classifique na conta retificadora correta ` +
        `(ex.: depreciação acumulada 123810xxx). Caso contrário, estorne o lançamento incorreto. ` +
        `Ref.: MCASP 11ª ed., Quadro de Natureza de Saldo.`
      )];
    }

    // ── D1_00025: Passivo com saldo Devedor (invertido) ─────────────────────
    case 'D1_00025': {
      const affected = result.affectedAccounts?.filter(a => !a.startsWith('237')) ?? [];
      if (!affected.length) return [];
      return [entry(
        'Regularização de saldo devedor indevido em conta do Passivo',
        '[conta de origem do débito]', 'Contrapartida do lançamento original incorreto',
        affected[0], `Conta do Passivo com saldo D indevido (${affected[0]})`,
        undefined,
        `Contas do passivo (grupos 211–221) devem ter saldo Credor. Um saldo D pode indicar: ` +
        `(a) pagamento registrado sem liquidação prévia — registre a liquidação (D 211xxx / C 111xxx); ` +
        `(b) lançamento de débito em conta errada — estorne e corrija. ` +
        `Contas 237xxx (deduções do PL) podem ter saldo D legitimamente. ` +
        `Ref.: MCASP 11ª ed., Quadro de Natureza de Saldo.`
      )];
    }

    // ── D1_00029-33: ICs ausentes em contas orçamentárias ───────────────────
    case 'D1_00029':
    case 'D1_00030':
    case 'D1_00031':
    case 'D1_00032':
    case 'D1_00033': {
      const icMap: Record<string, string> = {
        'D1_00029': 'Fonte de Recurso (FR)',
        'D1_00030': 'Natureza de Receita (CO)',
        'D1_00031': 'Natureza de Despesa (ND)',
        'D1_00032': 'Função/Subfunção (FS)',
        'D1_00033': 'Fonte de Recurso (FR) nas despesas',
      };
      return [{
        descricao: `Atualização do Indicador de Conta — ${icMap[result.ruleId]}`,
        debito:  { conta: 'N/A', descricao: 'Não requer lançamento contábil' },
        credito: { conta: 'N/A', descricao: 'Não requer lançamento contábil' },
        obs: `Esta inconsistência não é corrigida por lançamento contábil, mas por atualização dos dados ` +
             `de ${icMap[result.ruleId]} nas contas afetadas diretamente no sistema contábil de origem ` +
             `(módulo de configuração de receitas/despesas). Após atualização, gerar nova MSC e revalidar.`
      }];
    }

    // ── D2_00080: Estoques zerados sem movimentação ──────────────────────────
    case 'D2_00080': {
      return [entry(
        'Reconhecimento de estoque em almoxarifado',
        '115610100', 'Almoxarifado — Material de Consumo',
        '311310100', 'VPD — Consumo de Material de Almoxarifado',
        undefined,
        `Se há estoque físico, registre a entrada (D 115610xxx / C 411xxx — VPA de incorporação). ` +
        `Se o almoxarifado está realmente zerado, a conta pode ser omitida da MSC. ` +
        `Ref.: MCASP 11ª ed., NBC TSP 12.`
      )];
    }

    // ── D2_00054: Equiv. patrimonial sem investimentos permanentes ───────────
    case 'D2_00054': {
      return [entry(
        'Registro do investimento permanente base da equivalência patrimonial',
        '122110000', 'Participações em Empresas Controladas',
        '441210000', 'VPA — Resultado Positivo de Equivalência Patrimonial',
        undefined,
        `Há movimentações de VPA/VPD de equivalência patrimonial (442/362) sem investimentos permanentes (122). ` +
        `Registre o investimento no ativo permanente correspondente. Ref.: MCASP 11ª ed., NBC TSP 36.`
      )];
    }

    default:
      return [];
  }
}

/**
 * Enriquece os resultados de validação com lançamentos corretivos sugeridos.
 * Chamado após runValidations(), antes de gerar o relatório.
 *
 * BUGFIX (jul/2026): antes, todo resultado — inclusive os gerados mês a mês
 * (D1_00021, D1_00030, D1_00032, D2_00081 etc.) — era enriquecido com o
 * array de MSC de TODOS os meses achatado (`msc`). Isso fazia com que o
 * valor calculado (ex.: 8% da despesa de pessoal para a provisão de
 * férias/13º) fosse o mesmo trimestre inteiro, repetido de forma idêntica
 * em cada mês no relatório, em vez de refletir a despesa daquele mês
 * específico. Agora, quando o resultado traz `r.period` e existe o MSC
 * daquele período em `mscByPeriod`, usamos o MSC do mês correto; caso
 * contrário (regras multi-mês/globais, sem período específico), mantemos o
 * comportamento anterior usando o array completo.
 */
export function enrichWithCorrectiveEntries(
  results: ValidationResult[],
  msc: MSCAccount[],
  mscByPeriod?: Record<string, MSCAccount[]>
): ValidationResult[] {
  return results.map(r => {
    if (r.severity === 'info') return r; // orientações não têm lançamento
    const mscDoPeriodo = r.period && mscByPeriod?.[r.period] ? mscByPeriod[r.period] : msc;
    const entries = buildCorrectiveEntries(r, mscDoPeriodo);
    return entries.length > 0 ? { ...r, suggestedEntries: entries } : r;
  });
}
