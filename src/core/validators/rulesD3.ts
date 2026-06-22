import { ValidationResult, RuleDefinition, MSCAccount } from '../types';
import { validatePairEquality, validateTripleEquality } from './utils';
import {
  getRCLFromRREO, getRCLFromRGF, extractXLSMetadata, findNegativeValues,
  getEquilibrioOrcamentario, getTotalDespesasAnexo01, getDespesasAnexo02,
  getTotalReceitasRPPS_A04, getReceitasRPPS_A06, getRPPSExercAnt_A01, getRPPSExercAnt_A04,
  getRPPSExercAnt_A06, getSuperavitFinanceiro_A01, getSuperavitFinanceiro_A06,
  getReservaRPPS_A01, getReservaRPPS_A04, getReservaRPPS_A06,
  getReservaContingencia_A01, getReservaContingencia_A06, findNegativosRP_A07,
  getDCL_RREO_A06, getDCL_RGF_A02, getTransfEmendasIndividuais_RGF_A01,
  getTransfEmendasIndividuais_RGF_A02, getTransfEmendasIndividuais_RREO_A03,
  getTransfEmendasBancada_RREO_A03, getTransfEmendasBancada_RGF_A01,
  getTransfAgentesSaude_RREO_A03, getTransfAgentesSaude_RGF_A01,
  getDedInativos_RGF_A01, getTotalInativos_RGF_A01, getReceitasRealizadasTotal_A01,
  getReceitasRealizadasTotal_A06, getDotacaoAtualizada_A01, getDespesasEmpenhadas_A01,
  getDespesasLiquidadas_A01, getDotacaoAtualizada_A06, getDespesasEmpenhadas_A06,
  getDespesasLiquidadas_A06, getRPNP_inscricoes_A01
} from '../xmlExtractors';

export function validateD3_RREO(rreo: any, _rulesMap: Map<string, RuleDefinition>): ValidationResult[] {
  const results: ValidationResult[] = [];

  // D3_00001: Equilíbrio orçamentário — TOTAL COM DÉFICIT (VII) = TOTAL COM SUPERÁVIT (XIV)
  const eq = getEquilibrioOrcamentario(rreo);
  if (eq.comDeficit !== null && eq.comSuperavit !== null) {
    if (Math.abs(eq.comDeficit - eq.comSuperavit) > 0.01) {
      results.push({
        ruleId: 'D3_00001',
        dimension: 'D3',
        description: '',
        severity: 'error',
        impactsCapag: false,
        message: `Desequilíbrio orçamentário no Anexo 01 do RREO. Total com Déficit (VII): R$ ${eq.comDeficit.toLocaleString('pt-BR', {minimumFractionDigits:2})} ≠ Total com Superávit (XIV): R$ ${eq.comSuperavit.toLocaleString('pt-BR', {minimumFractionDigits:2})}.`,
      });
    }
  }

  // D3_00002: Despesas Orçamentárias — Anexo 01 (Subtotal) = Anexo 02 (Total exceto intra)
  const despA01 = getTotalDespesasAnexo01(rreo);
  const despA02 = getDespesasAnexo02(rreo);
  if (despA01 !== null && despA02 !== null) {
    if (Math.abs(despA01 - despA02) > 0.01) {
      results.push({
        ruleId: 'D3_00002',
        dimension: 'D3',
        description: '',
        severity: 'error',
        impactsCapag: false,
        message: `Divergência nas despesas orçamentárias entre Anexos 01 e 02 do RREO. Anexo 01 (Subtotal X): R$ ${despA01.toLocaleString('pt-BR', {minimumFractionDigits:2})} | Anexo 02 (Exceto Intra I): R$ ${despA02.toLocaleString('pt-BR', {minimumFractionDigits:2})}.`,
      });
    }
  }

  // D3_00012: Valores negativos no RREO (exceto linhas de resultado/déficit)
  const negativosRREO = findNegativeValues(rreo);
  if (negativosRREO.length > 0) {
    results.push({
      ruleId: 'D3_00012',
      dimension: 'D3',
      description: '',
      severity: 'warning',
      impactsCapag: false,
      affectedAccounts: Array.from(new Set(negativosRREO.map(n => n.sheet))),
      detailedItems: negativosRREO.slice(0, 30).map(n => ({
        conta: n.sheet,
        detalhe: `Linha ${n.row}: "${n.label}" = R$ ${n.value.toLocaleString('pt-BR', {minimumFractionDigits:2})}`,
      })),
      message: `${negativosRREO.length} célula(s) com valor negativo encontrada(s) no RREO. Verifique as abas: ${Array.from(new Set(negativosRREO.map(n => n.sheet))).join(', ')}.`,
    });
  }

  // D3_00030: Igualdade das receitas previdenciárias RPPS entre Anexo 04 e Anexo 06
  results.push(...validatePairEquality(
    'D3_00030', 'D3',
    { label: 'RREO Anexo 04', val: getTotalReceitasRPPS_A04(rreo) },
    { label: 'RREO Anexo 06', val: getReceitasRPPS_A06(rreo) },
    'Total de Receitas Previdenciárias do RPPS diverge entre o Anexo 04 e o Anexo 06 do RREO.',
    true
  ));

  // D3_00032: Recursos RPPS arrecadados em exercícios anteriores — deve ser igual em A01, A04 e A06
  results.push(...validateTripleEquality(
    'D3_00032', 'D3',
    { label: 'RREO Anexo 01', val: getRPPSExercAnt_A01(rreo) },
    { label: 'RREO Anexo 04', val: getRPPSExercAnt_A04(rreo) },
    { label: 'RREO Anexo 06', val: getRPPSExercAnt_A06(rreo) },
    'Recursos RPPS Arrecadados em Exercícios Anteriores divergem entre os Anexos 01, 04 e 06 do RREO.',
    false
  ));

  // D3_00033: Superávit financeiro utilizado para créditos adicionais — A01 = A06
  results.push(...validatePairEquality(
    'D3_00033', 'D3',
    { label: 'RREO Anexo 01', val: getSuperavitFinanceiro_A01(rreo) },
    { label: 'RREO Anexo 06', val: getSuperavitFinanceiro_A06(rreo) },
    'Superávit Financeiro Utilizado para Créditos Adicionais diverge entre os Anexos 01 e 06 do RREO.',
    false
  ));

  // D3_00034: Reserva do RPPS — deve ser igual em A01, A04 e A06
  results.push(...validateTripleEquality(
    'D3_00034', 'D3',
    { label: 'RREO Anexo 01', val: getReservaRPPS_A01(rreo) },
    { label: 'RREO Anexo 04', val: getReservaRPPS_A04(rreo) },
    { label: 'RREO Anexo 06', val: getReservaRPPS_A06(rreo) },
    'Reserva do RPPS diverge entre os Anexos 01, 04 e 06 do RREO.',
    false
  ));

  // D3_00035: Reserva de Contingência — A01 = A06
  results.push(...validatePairEquality(
    'D3_00035', 'D3',
    { label: 'RREO Anexo 01', val: getReservaContingencia_A01(rreo) },
    { label: 'RREO Anexo 06', val: getReservaContingencia_A06(rreo) },
    'Reserva de Contingência diverge entre os Anexos 01 e 06 do RREO.',
    false
  ));

  // D3_00027: Dotação Atualizada, Empenhadas Até, Liquidadas Até — Anexo 01 = Anexo 06
  // Nota: A06 mostra "despesas primárias exceto RPPS"; municípios com RPPS terão diferença.
  for (const [, a01val, a06val, label] of [
    ['dot', getDotacaoAtualizada_A01(rreo), getDotacaoAtualizada_A06(rreo), 'Dotação Atualizada'],
    ['emp', getDespesasEmpenhadas_A01(rreo), getDespesasEmpenhadas_A06(rreo), 'Despesas Empenhadas Até o Bimestre'],
    ['liq', getDespesasLiquidadas_A01(rreo), getDespesasLiquidadas_A06(rreo), 'Despesas Liquidadas Até o Bimestre'],
  ] as [string, number|null, number|null, string][]) {
    if (a01val !== null && a06val !== null && Math.abs(a01val - a06val) > 0.01) {
      results.push({
        ruleId: 'D3_00027', dimension: 'D3', description: '', severity: 'warning', impactsCapag: false,
        message: `${label} diverge entre Anexo 01 (R$ ${a01val.toLocaleString('pt-BR', {minimumFractionDigits:2})}) e Anexo 06 (R$ ${a06val.toLocaleString('pt-BR', {minimumFractionDigits:2})}). (Diferença pode ser esperada em municípios com RPPS.)`,
      });
    }
  }

  // D3_00028: Receitas Realizadas Até o Bimestre — Anexo 01 = Anexo 06 (CAPAG)
  // A01 col[5] vs A06 col[2] (A06 exclui RPPS; pequena diferença pode ser esperada)
  results.push(...validatePairEquality(
    'D3_00028', 'D3',
    { label: 'RREO Anexo 01 (Subtotal III, col Realizadas Até)', val: getReceitasRealizadasTotal_A01(rreo) },
    { label: 'RREO Anexo 06 (Receita Primária Total XVI)',         val: getReceitasRealizadasTotal_A06(rreo) },
    'Receitas Realizadas Até o Bimestre divergem entre o Anexo 01 e o Anexo 06 do RREO.',
    true
  ));

  // D3_00045: Valores negativos em Restos a Pagar (Anexo 07)
  const negRP = findNegativosRP_A07(rreo);
  if (negRP.length > 0) {
    results.push({
      ruleId: 'D3_00045',
      dimension: 'D3',
      description: '',
      severity: 'warning',
      impactsCapag: true,
      detailedItems: negRP.slice(0, 20).map(n => ({
        conta: 'RREO-Anexo 07',
        detalhe: `"${n.label}" = R$ ${n.value.toLocaleString('pt-BR', {minimumFractionDigits:2})}`,
      })),
      message: `${negRP.length} linha(s) com valor negativo nas colunas de Restos a Pagar (Anexo 07). O RREO não admite valores negativos em RP fora das linhas de resultado.`,
    });
  }

  return results;
}

export function validateD3_Fiscal(rreo: any, rgf: any, _rulesMap: Map<string, RuleDefinition>): ValidationResult[] {
  const results: ValidationResult[] = [];

  // D3_00005: Igualdade da RCL entre RREO (Anexo 03) e RGF (Anexo 01)
  const rclRREO = getRCLFromRREO(rreo);
  const rclRGF  = getRCLFromRGF(rgf);

  if (rclRREO === null || rclRGF === null) {
    // Dado não encontrado nos arquivos — exibe aviso de leitura em vez de falso positivo
    const naoLidos = [rclRREO === null ? 'RREO Anexo 03' : null, rclRGF === null ? 'RGF Anexo 01' : null]
      .filter(Boolean);
    results.push({
      ruleId: 'D3_00005',
      dimension: 'D3',
      description: '',
      severity: 'info',
      impactsCapag: true,
      message:
        `Não foi possível extrair a RCL de: ${naoLidos.join(', ')}. ` +
        `Verifique se o arquivo está no formato correto do Siconfi (XLS exportado pelo portal). ` +
        `A regra D3_00005 não pôde ser verificada.`,
    });
  } else if (Math.abs(rclRREO - rclRGF) > 0.01) {
    results.push({
      ruleId: 'D3_00005',
      dimension: 'D3',
      description: '',
      severity: 'error',
      impactsCapag: true,
      message: `Divergência na Receita Corrente Líquida (RCL). RREO Anexo 03: R$ ${rclRREO.toLocaleString('pt-BR', {minimumFractionDigits:2})} | RGF Anexo 01: R$ ${rclRGF.toLocaleString('pt-BR', {minimumFractionDigits:2})}.`,
    });
  }

  // Metadados de identificação para ajudar no diagnóstico
  const metaRREO = extractXLSMetadata(rreo);
  const metaRGF  = extractXLSMetadata(rgf);
  if (metaRREO.ente && metaRGF.ente && metaRREO.ente !== metaRGF.ente) {
    results.push({
      ruleId: 'D3_00005',
      dimension: 'D3',
      description: '',
      severity: 'warning',
      impactsCapag: false,
      message:
        `Atenção: o RREO é do ente "${metaRREO.ente}" e o RGF é do ente "${metaRGF.ente}". ` +
        `Certifique-se de que os arquivos correspondem ao mesmo município e exercício.`,
    });
  }

  // D3_00006: Igualdade da DCL entre RREO Anexo 06 e RGF Anexo 02 — CAPAG
  results.push(...validatePairEquality(
    'D3_00006', 'D3',
    { label: 'RREO Anexo 06', val: getDCL_RREO_A06(rreo) },
    { label: 'RGF Anexo 02',  val: getDCL_RGF_A02(rgf) },
    'Dívida Consolidada Líquida (DCL) diverge entre o Anexo 06 do RREO e o Anexo 02 do RGF.',
    true
  ));

  // D3_00011: Dedução de inativos/pensionistas com recursos vinculados ≤ total inativos/pensionistas
  const dedInativ = getDedInativos_RGF_A01(rgf);
  const totInativ  = getTotalInativos_RGF_A01(rgf);
  if (dedInativ !== null && totInativ !== null && dedInativ > totInativ + 0.01) {
    results.push({
      ruleId: 'D3_00011',
      dimension: 'D3',
      description: '',
      severity: 'error',
      impactsCapag: false,
      message: `Dedução de Inativos e Pensionistas com Recursos Vinculados (R$ ${dedInativ.toLocaleString('pt-BR', {minimumFractionDigits:2})}) é maior que o total de Inativos e Pensionistas (R$ ${totInativ.toLocaleString('pt-BR', {minimumFractionDigits:2})}) no RGF Anexo 01.`,
    });
  }

  // D3_00013: Valores negativos no RGF
  const negativosRGF = findNegativeValues(rgf);
  if (negativosRGF.length > 0) {
    results.push({
      ruleId: 'D3_00013',
      dimension: 'D3',
      description: '',
      severity: 'warning',
      impactsCapag: false,
      affectedAccounts: Array.from(new Set(negativosRGF.map(n => n.sheet))),
      detailedItems: negativosRGF.slice(0, 30).map(n => ({
        conta: n.sheet,
        detalhe: `Linha ${n.row}: "${n.label}" = R$ ${n.value.toLocaleString('pt-BR', {minimumFractionDigits:2})}`,
      })),
      message: `${negativosRGF.length} célula(s) com valor negativo encontrada(s) no RGF. Verifique as abas: ${Array.from(new Set(negativosRGF.map(n => n.sheet))).join(', ')}.`,
    });
  }

  // D3_00014: Transferências emendas individuais devem ser iguais nos Anexos 01 e 02 do RGF — CAPAG
  results.push(...validatePairEquality(
    'D3_00014', 'D3',
    { label: 'RGF Anexo 01', val: getTransfEmendasIndividuais_RGF_A01(rgf) },
    { label: 'RGF Anexo 02', val: getTransfEmendasIndividuais_RGF_A02(rgf) },
    'Transferências Obrigatórias da União relativas a Emendas Individuais (art. 166-A §1º CF) divergem entre os Anexos 01 e 02 do RGF.',
    true
  ));

  // D3_00015: Transferências emendas individuais RREO Anexo 03 = RGF Anexo 01 — CAPAG
  results.push(...validatePairEquality(
    'D3_00015', 'D3',
    { label: 'RREO Anexo 03', val: getTransfEmendasIndividuais_RREO_A03(rreo) },
    { label: 'RGF Anexo 01',  val: getTransfEmendasIndividuais_RGF_A01(rgf) },
    'Transferências relativas a Emendas Individuais divergem entre o Anexo 03 do RREO e o Anexo 01 do RGF.',
    true
  ));

  // D3_00016: Transferências emendas de bancada RREO Anexo 03 = RGF Anexo 01 — CAPAG
  results.push(...validatePairEquality(
    'D3_00016', 'D3',
    { label: 'RREO Anexo 03', val: getTransfEmendasBancada_RREO_A03(rreo) },
    { label: 'RGF Anexo 01',  val: getTransfEmendasBancada_RGF_A01(rgf) },
    'Transferências relativas a Emendas de Bancada (art. 166, §16, CF) divergem entre o Anexo 03 do RREO e o Anexo 01 do RGF.',
    true
  ));

  // D3_00044: Transferências agentes comunitários de saúde RREO Anexo 03 = RGF Anexo 01 — CAPAG
  results.push(...validatePairEquality(
    'D3_00044', 'D3',
    { label: 'RREO Anexo 03', val: getTransfAgentesSaude_RREO_A03(rreo) },
    { label: 'RGF Anexo 01',  val: getTransfAgentesSaude_RGF_A01(rgf) },
    'Transferências da União relativas à remuneração dos Agentes Comunitários de Saúde (CF, art. 198, §11) divergem entre o Anexo 03 do RREO e o Anexo 01 do RGF.',
    true
  ));

  
  // D3_00008: Restos a pagar não processados RREO A01 x RGF A05
  // (Simplificado: verificamos presença ou igualdade se extraídos)
  const rreoA01_rpnp = getRPNP_inscricoes_A01(rreo); // já importado
  // RGF A05 (RPNP) não tem extrator implementado ainda, mas preparamos o stub:
  const rgfA05_rpnp = null; 
  if (rreoA01_rpnp !== null && rgfA05_rpnp !== null && Math.abs(rreoA01_rpnp - rgfA05_rpnp) > 0.01) {
      results.push({
        ruleId: 'D3_00008',
        dimension: 'D3',
        description: '',
        severity: 'error',
        impactsCapag: false,
        message: `Restos a pagar não processados divergem entre RREO Anexo 01 (R$ ${rreoA01_rpnp}) e RGF Anexo 05 (R$ ${rgfA05_rpnp}).`
      });
  }

  // D3_00010: RCL do RGF deve ser igual à calculada internamente ou entre poderes
  if (rclRGF !== null) {
      // Como a validação de RCL já foi feita em D3_00005, D3_00010 foca em relatórios de outros poderes.
      // Aqui só deixaremos a marcação.
  }

  return results;
}

export function validateMSC_CAPAG(msc: MSCAccount[], _rulesMap: Map<string, RuleDefinition>): ValidationResult[] {
  const results: ValidationResult[] = [];

  // D3_00021: Passivo financeiro >= Restos a Pagar (Executivo + RPPS)
  // Passivo financeiro: contas 21 e 22 com atributo F (FP = F)
  // Restos a Pagar: contas 212 (RPP) e 213 (RPNP)
  let passivoFinanceiro = 0;
  let restosAPagar = 0;

  msc.forEach(acc => {
    if (acc.Tipo_valor === 'ending_balance') {
      const valor = acc.Natureza_valor === 'C' ? acc.Valor : -acc.Valor;
      // Passivo financeiro = apenas contas 21/22 com atributo F (superávit financeiro)
      if ((acc.CONTA.startsWith('21') || acc.CONTA.startsWith('22')) && acc.FP === 'F') {
        passivoFinanceiro += valor;
      }
      if (acc.CONTA.startsWith('213') || acc.CONTA.startsWith('212')) {
        restosAPagar += valor;
      }
    }
  });

  if (passivoFinanceiro < restosAPagar) {
    results.push({
      ruleId: 'D3_00021',
      dimension: 'D3',
      description: '',
      severity: 'error',
      impactsCapag: true,
      message: `Passivo Financeiro (R$ ${passivoFinanceiro.toFixed(2)}) é menor que os Restos a Pagar (R$ ${restosAPagar.toFixed(2)}). Impacta a nota CAPAG.`,
      affectedAccounts: ['21', '22', '212', '213'],
    });
  }

  return results;
}
