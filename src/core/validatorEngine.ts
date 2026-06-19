import { ParsedData, ValidationResult, MSCAccount, RuleDefinition } from './types';
import {
  getRCLFromRREO, getRCLFromRGF, getReceitasArrecadadasRREO, extractXLSMetadata,
  findNegativeValues, getEquilibrioOrcamentario, getTotalDespesasAnexo01, getDespesasAnexo02,
  getRPPSExercAnt_A01, getRPPSExercAnt_A04, getRPPSExercAnt_A06,
  getSuperavitFinanceiro_A01, getSuperavitFinanceiro_A06,
  getReservaRPPS_A01, getReservaRPPS_A04, getReservaRPPS_A06,
  getReservaContingencia_A01, getReservaContingencia_A06,
  findNegativosRP_A07,
  getDCL_RREO_A06, getDCL_RGF_A02,
  getTransfEmendasIndividuais_RGF_A01, getTransfEmendasIndividuais_RGF_A02,
  getTransfEmendasIndividuais_RREO_A03,
  getDedInativos_RGF_A01, getTotalInativos_RGF_A01,
} from './xmlExtractors';

export const runValidations = (data: ParsedData, rulesMap: Map<string, RuleDefinition>): ValidationResult[] => {
  const results: ValidationResult[] = [];

  results.push(...validateD1_Entrega(data, rulesMap));

  if (data.msc) {
    results.push(...validateD1_MSC(data.msc, rulesMap));
    results.push(...validateD2_MSC(data.msc, rulesMap));
    results.push(...validateMSC_CAPAG(data.msc, rulesMap));
  }

  if (data.rreo) {
    results.push(...validateD3_RREO(data.rreo, rulesMap));
  }

  if (data.msc && data.rreo) {
    results.push(...validateD4_Cruzamentos(data, rulesMap));
  }

  if (data.rreo && data.rgf) {
    results.push(...validateD3_Fiscal(data.rreo, data.rgf, rulesMap));
  }

  return results.map(res => {
    const ruleDef = rulesMap.get(res.ruleId);
    if (ruleDef) {
      res.description = ruleDef.description;
      res.impactsCapag = ruleDef.impactsCapag;
      res.dimension = ruleDef.dimension;
    }
    return res;
  });
};

// Compara dois valores de demonstrativos; retorna ValidationResult[] (vazio se ok ou dados ausentes)
function validatePairEquality(
  ruleId: string,
  dimension: ValidationResult['dimension'],
  a: { label: string; val: number | null },
  b: { label: string; val: number | null },
  msgBase: string,
  impactsCapag: boolean
): ValidationResult[] {
  if (a.val === null || b.val === null) return [];
  if (Math.abs(a.val - b.val) <= 0.01) return [];
  return [{
    ruleId, dimension, description: '', severity: 'error', impactsCapag,
    message: `${msgBase} ${a.label}: R$ ${a.val.toLocaleString('pt-BR', {minimumFractionDigits:2})} | ${b.label}: R$ ${b.val.toLocaleString('pt-BR', {minimumFractionDigits:2})}.`,
  }];
}

// Compara três valores; gera erro para cada par que divergir
function validateTripleEquality(
  ruleId: string,
  dimension: ValidationResult['dimension'],
  a: { label: string; val: number | null },
  b: { label: string; val: number | null },
  c: { label: string; val: number | null },
  msgBase: string,
  impactsCapag: boolean
): ValidationResult[] {
  const pairs = [
    [a, b], [a, c], [b, c]
  ] as [typeof a, typeof b][];
  const diverging = pairs.filter(([x, y]) => x.val !== null && y.val !== null && Math.abs(x.val - y.val) > 0.01);
  if (diverging.length === 0) return [];
  const detail = diverging.map(([x, y]) => `${x.label}: R$ ${x.val!.toLocaleString('pt-BR', {minimumFractionDigits:2})} ≠ ${y.label}: R$ ${y.val!.toLocaleString('pt-BR', {minimumFractionDigits:2})}`).join(' | ');
  return [{
    ruleId, dimension, description: '', severity: 'error', impactsCapag,
    message: `${msgBase} ${detail}.`,
  }];
}

// Soma valores de contas com prefixo, tipo e natureza especificados
const sumAccounts = (
  msc: MSCAccount[],
  prefixes: string[],
  tipo: MSCAccount['Tipo_valor'],
  natureza?: MSCAccount['Natureza_valor'],
  excludePrefixes: string[] = []
): number =>
  msc
    .filter(acc =>
      prefixes.some(p => acc.CONTA.startsWith(p)) &&
      !excludePrefixes.some(p => acc.CONTA.startsWith(p)) &&
      acc.Tipo_valor === tipo &&
      (natureza ? acc.Natureza_valor === natureza : true)
    )
    .reduce((sum, acc) => sum + acc.Valor, 0);

// Retorna registros de contas que violam uma natureza esperada no saldo final
const findInvertedAccounts = (
  msc: MSCAccount[],
  prefixes: string[],
  expectedNatureza: MSCAccount['Natureza_valor']
): MSCAccount[] =>
  msc.filter(acc =>
    prefixes.some(p => acc.CONTA.startsWith(p)) &&
    acc.Tipo_valor === 'ending_balance' &&
    acc.Natureza_valor !== expectedNatureza &&
    acc.Valor > 0
  );

// Monta detailedItems padrão para contas invertidas
const buildInvertedItems = (accounts: MSCAccount[], expected: string) =>
  accounts.map(a => ({
    conta: a.CONTA,
    po: a.PO,
    fr: a.FR,
    co: a.CO,
    valor: a.Valor,
    detalhe: `Natureza informada: ${a.Natureza_valor} (esperado: ${expected})`,
  }));


// =============================================================================
// D1 — Entrega e completude dos demonstrativos (D1_00001–D1_00016)
// =============================================================================
function validateD1_Entrega(data: ParsedData, _rulesMap: Map<string, RuleDefinition>): ValidationResult[] {
  const results: ValidationResult[] = [];

  const temMSC  = !!data.msc  && data.msc.length > 0;
  const temRREO = !!data.rreo;
  const temRGF  = !!data.rgf;
  const temDCA  = !!data.dca;

  // D1_00001 / D1_00003 / D1_00002: verificação de presença dos demonstrativos
  // (homologação real só pode ser confirmada no portal Siconfi; aqui verificamos se os arquivos foram fornecidos)
  const ausentes: string[] = [];
  if (!temRREO) ausentes.push('RREO');
  if (!temRGF)  ausentes.push('RGF');
  if (!temDCA)  ausentes.push('DCA');

  if (ausentes.length > 0 && (temMSC || temRREO || temRGF || temDCA)) {
    results.push({
      ruleId: 'D1_00001',
      dimension: 'D1',
      description: 'Verificação de entrega dos demonstrativos',
      severity: 'info',
      impactsCapag: false,
      affectedAccounts: ausentes,
      message:
        `Demonstrativo(s) não incluído(s) no upload: ${ausentes.join(', ')}. ` +
        `As regras D1_00001–D1_00015 verificam homologação e tempestividade diretamente no portal Siconfi ` +
        `e não podem ser validadas localmente. Confirme no SICONFI que todos os demonstrativos foram homologados no prazo.`,
    });
  }

  // D1_00016: verifica se todas as MSCs do exercício foram enviadas (13 no total: jan–dez + encerramento)
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
            `Exercício ${year}: foram encontradas ${yearPeriods.length} MSC(s) (meses: ${meses.join(', ')}). ` +
            `Mês(es) ausente(s): ${missing.map(m => String(m).padStart(2,'0')).join(', ')}. ` +
            `O Siconfi exige 13 MSCs por exercício (janeiro a dezembro + encerramento).`,
        });
      }
    }
  }

  return results;
}

// =============================================================================
// D1 — Gestão da Informação
// =============================================================================
function validateD1_MSC(msc: MSCAccount[], _rulesMap: Map<string, RuleDefinition>): ValidationResult[] {
  const results: ValidationResult[] = [];

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
    const key = `${acc.CONTA}-${acc.PO}-${acc.FR}-${acc.CO}`;
    if (!accountsMap.has(key)) accountsMap.set(key, { si: 0, mov: 0, sf: 0 });
    const entry = accountsMap.get(key)!;
    const signed = acc.Natureza_valor === 'C' ? -acc.Valor : acc.Valor;
    if (acc.Tipo_valor === 'beginning_balance') entry.si += signed;
    else if (acc.Tipo_valor === 'period_change') entry.mov += signed;
    else if (acc.Tipo_valor === 'ending_balance') entry.sf += signed;
  });

  const inconsistentAccounts: string[] = [];
  const detailedInconsistencies: import('./types').DetailedItem[] = [];
  accountsMap.forEach((vals, key) => {
    const diff = Math.abs((vals.si + vals.mov) - vals.sf);
    if (diff > 0.01) {
      const parts = key.split('-');
      inconsistentAccounts.push(parts[0]);
      const fmt = (v: number) => Math.abs(v).toFixed(2) + (v < 0 ? 'C' : 'D');
      detailedInconsistencies.push({
        conta: parts[0], po: parts[1], fr: parts[2], co: parts[3],
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
      message: `${inconsistentAccounts.length} conta(s) com movimentação inconsistente (SI + MOV ≠ SF).`,
    });
  }

  // D1_00021: Ativo com saldo invertido (grupos 1111, 1121, 1125, 1231, 1232) — natureza padrão D
  const activePrefixes = ['1111', '1121', '1125', '1231', '1232'];
  const activeInverted = findInvertedAccounts(msc, activePrefixes, 'D');
  if (activeInverted.length > 0) {
    results.push({
      ruleId: 'D1_00021',
      dimension: 'D1',
      description: 'Contas do ativo com saldo invertido',
      severity: 'warning',
      impactsCapag: false,
      affectedAccounts: Array.from(new Set(activeInverted.map(a => a.CONTA))),
      detailedItems: buildInvertedItems(activeInverted, 'D'),
      message: `${activeInverted.length} conta(s) do ativo (grupos 1111/1121/1125/1231/1232) com natureza Credora (C). Natureza padrão: Devedora (D).`,
    });
  }

  // D1_00025: Passivo circulante/não-circulante com saldo invertido — natureza padrão C
  const passivoPrefixes = [
    '2111','2112','2113','2114','2121','2122','2123','2124','2125','2126',
    '213','214','215','221','222','223',
  ];
  const passivoInverted = findInvertedAccounts(msc, passivoPrefixes, 'C');
  if (passivoInverted.length > 0) {
    results.push({
      ruleId: 'D1_00025',
      dimension: 'D1',
      description: 'Contas do passivo com saldo invertido',
      severity: 'warning',
      impactsCapag: false,
      affectedAccounts: Array.from(new Set(passivoInverted.map(a => a.CONTA))),
      detailedItems: buildInvertedItems(passivoInverted, 'C'),
      message: `${passivoInverted.length} conta(s) do passivo com natureza Devedora (D). Natureza padrão: Credora (C).`,
    });
  }

  // D1_00026: Patrimônio líquido com saldo invertido — natureza padrão C
  const plPrefixes = ['2311','2312','232','233','234','235','236'];
  const plInverted = findInvertedAccounts(msc, plPrefixes, 'C');
  if (plInverted.length > 0) {
    results.push({
      ruleId: 'D1_00026',
      dimension: 'D1',
      description: 'Contas de patrimônio líquido com saldo invertido',
      severity: 'warning',
      impactsCapag: false,
      affectedAccounts: Array.from(new Set(plInverted.map(a => a.CONTA))),
      detailedItems: buildInvertedItems(plInverted, 'C'),
      message: `${plInverted.length} conta(s) do Patrimônio Líquido com natureza Devedora (D). Natureza padrão: Credora (C).`,
    });
  }

  // D1_00028: Todas as classes (1–8) presentes na MSC
  const presentClasses = new Set(msc.filter(a => a.Valor !== 0).map(a => a.CONTA[0]));
  const missingClasses = ['1','2','3','4','5','6','7','8'].filter(c => !presentClasses.has(c));
  if (missingClasses.length > 0) {
    results.push({
      ruleId: 'D1_00028',
      dimension: 'D1',
      description: 'MSC com informação de todas as classes de contas',
      severity: 'warning',
      impactsCapag: false,
      affectedAccounts: missingClasses.map(c => `Classe ${c}`),
      message: `Classe(s) de contas ausente(s) na MSC: ${missingClasses.map(c => `Classe ${c}`).join(', ')}. A MSC deve conter valores em todas as classes patrimonial, orçamentária e de controle.`,
    });
  }

  // D1_00029: Contas de receita (6211, 6212, 6213) sem FR
  const receitaSemFR = msc.filter(acc =>
    (acc.CONTA.startsWith('6211') || acc.CONTA.startsWith('6212') || acc.CONTA.startsWith('6213')) &&
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

  // D1_00038: Classe 5/6 com saldo invertido — natureza padrão por grupo
  // 511/621 = previsão/arrecadação de receita → C; 512/622 = fixação/execução de despesa → D
  const orcamInvertedC = findInvertedAccounts(msc, ['511', '621'], 'C');
  const orcamInvertedD = findInvertedAccounts(msc, ['512', '622'], 'D');
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
      message: `${orcamInverted.length} conta(s) orçamentária(s) (classes 5/6) com natureza diferente do padrão PCASP.`,
    });
  }

  return results;
}


// =============================================================================
// D2 — Consistência Contábil (regras aplicáveis com apenas a MSC)
// =============================================================================
function validateD2_MSC(msc: MSCAccount[], _rulesMap: Map<string, RuleDefinition>): ValidationResult[] {
  const results: ValidationResult[] = [];

  // D2_00055: Amortização acumulada de intangíveis (1248) > valor dos intangíveis (124 excl. 1248)
  const vlIntangiveis = sumAccounts(msc, ['124'], 'ending_balance', 'D', ['1248']);
  const vlAmortizacao = sumAccounts(msc, ['1248'], 'ending_balance', 'C');
  if (vlAmortizacao > vlIntangiveis + 0.01) {
    results.push({
      ruleId: 'D2_00055',
      dimension: 'D2',
      description: 'Amortização acumulada de intangíveis superior ao valor dos intangíveis',
      severity: 'error',
      impactsCapag: false,
      affectedAccounts: ['124', '1248'],
      message: `Amortização acumulada de intangíveis (R$ ${vlAmortizacao.toFixed(2)}) é maior que o valor bruto dos ativos intangíveis (R$ ${vlIntangiveis.toFixed(2)}). A amortização não pode superar o valor do ativo.`,
    });
  }

  // D2_00067: Depreciação acumulada de bens móveis (1238101) > valor dos bens móveis (1231)
  const vlBensMoveis = sumAccounts(msc, ['1231'], 'ending_balance', 'D');
  const vlDeprMoveis = sumAccounts(msc, ['1238101'], 'ending_balance', 'C');
  if (vlDeprMoveis > vlBensMoveis + 0.01) {
    results.push({
      ruleId: 'D2_00067',
      dimension: 'D2',
      description: 'Depreciação de bens móveis superior ao valor dos bens móveis',
      severity: 'error',
      impactsCapag: false,
      affectedAccounts: ['1231', '1238101'],
      message: `Depreciação acumulada de bens móveis (R$ ${vlDeprMoveis.toFixed(2)}) é maior que o valor bruto dos bens móveis (R$ ${vlBensMoveis.toFixed(2)}).`,
    });
  }

  // D2_00068: Depreciação acumulada de bens imóveis (1238102) > valor dos bens imóveis (1232)
  const vlBensImoveis = sumAccounts(msc, ['1232'], 'ending_balance', 'D');
  const vlDeprImoveis = sumAccounts(msc, ['1238102'], 'ending_balance', 'C');
  if (vlDeprImoveis > vlBensImoveis + 0.01) {
    results.push({
      ruleId: 'D2_00068',
      dimension: 'D2',
      description: 'Depreciação de bens imóveis superior ao valor dos bens imóveis',
      severity: 'error',
      impactsCapag: false,
      affectedAccounts: ['1232', '1238102'],
      message: `Depreciação acumulada de bens imóveis (R$ ${vlDeprImoveis.toFixed(2)}) é maior que o valor bruto dos bens imóveis (R$ ${vlBensImoveis.toFixed(2)}).`,
    });
  }

  // D2_00080: Saldo de estoques/almoxarifado (11561) = 0
  const vlEstoques = sumAccounts(msc, ['11561'], 'ending_balance', 'D');
  if (vlEstoques === 0) {
    const temContaEstoque = msc.some(a => a.CONTA.startsWith('11561'));
    if (temContaEstoque) {
      results.push({
        ruleId: 'D2_00080',
        dimension: 'D2',
        description: 'Saldo de estoques/almoxarifado zerado',
        severity: 'warning',
        impactsCapag: false,
        affectedAccounts: ['11561'],
        message: `O saldo final das contas de estoques/almoxarifado (grupo 11561) está zerado. Verifique se o ente possui estoques e se os registros estão corretos.`,
      });
    }
  }

  // D2_00081: Férias e 13º salário sem provisão mensal (211110102 e 211110103)
  const temFeriasProvisao = msc.some(a => a.CONTA === '211110102' && a.Tipo_valor === 'period_change' && a.Valor > 0);
  const tem13Provisao = msc.some(a => a.CONTA === '211110103' && a.Tipo_valor === 'period_change' && a.Valor > 0);
  if (!temFeriasProvisao && !tem13Provisao) {
    const temPessoal = msc.some(a => a.CONTA.startsWith('311') && a.Tipo_valor === 'period_change' && a.Valor > 0);
    if (temPessoal) {
      results.push({
        ruleId: 'D2_00081',
        dimension: 'D2',
        description: 'Férias e 13º salário sem provisão registrada',
        severity: 'warning',
        impactsCapag: false,
        affectedAccounts: ['211110102', '211110103'],
        message: `Há despesas com pessoal (classe 311) registradas, mas sem provisão de férias (211110102) nem de 13º salário (211110103) no período. Verifique o reconhecimento por competência.`,
      });
    }
  }

  // D2_00083: Integridade DDR — saldo final da classe 721 deve igualar saldo final da classe 821
  const vlDDR721 = sumAccounts(msc, ['721'], 'ending_balance', 'D');
  const vlDDR821 = sumAccounts(msc, ['821'], 'ending_balance', 'C');
  if (Math.abs(vlDDR721 - vlDDR821) > 0.01 && (vlDDR721 > 0 || vlDDR821 > 0)) {
    results.push({
      ruleId: 'D2_00083',
      dimension: 'D2',
      description: 'Integridade do DDR (saldo 721 ≠ saldo 821)',
      severity: 'error',
      impactsCapag: false,
      affectedAccounts: ['721', '821'],
      message: `Divergência nas contas de controle do DDR. Saldo final 721: R$ ${vlDDR721.toFixed(2)} | Saldo final 821: R$ ${vlDDR821.toFixed(2)}. Os saldos devem ser iguais.`,
    });
  }

  // D2_00093: Almoxarifado sem movimentação de consumo (period_change nas contas 11561)
  const temMovAlmox = msc.some(a => a.CONTA.startsWith('11561') && a.Tipo_valor === 'period_change' && a.Valor > 0);
  const temSaldoAlmox = msc.some(a => a.CONTA.startsWith('11561') && a.Tipo_valor === 'ending_balance' && a.Valor > 0);
  if (temSaldoAlmox && !temMovAlmox) {
    results.push({
      ruleId: 'D2_00093',
      dimension: 'D2',
      description: 'Almoxarifado sem movimentação de consumo no período',
      severity: 'warning',
      impactsCapag: false,
      affectedAccounts: ['11561'],
      message: `Há saldo nas contas de almoxarifado (11561) mas nenhuma movimentação (consumo) foi registrada no período. Verifique o reconhecimento patrimonial dos estoques.`,
    });
  }

  // D2_00094: Despesas com pessoal RPPS sem contribuição patronal correspondente
  // Conta 311110101 (despesa ativa RPPS) deve ter correspondência em 312120100 (contribuição patronal RPPS)
  const temDespRPPS = msc.some(a => a.CONTA === '311110101' && a.Tipo_valor === 'period_change' && a.Valor > 0);
  const temContribRPPS = msc.some(a => a.CONTA === '312120100' && a.Tipo_valor === 'period_change' && a.Valor > 0);
  if (temDespRPPS && !temContribRPPS) {
    results.push({
      ruleId: 'D2_00094',
      dimension: 'D2',
      description: 'Despesas previdenciárias RPPS sem contribuição patronal',
      severity: 'warning',
      impactsCapag: false,
      affectedAccounts: ['311110101', '312120100'],
      message: `Há despesas com pessoal ativo RPPS (311110101) mas sem registro de contribuição patronal (312120100). Verifique o registro das despesas previdenciárias.`,
    });
  }

  // D2_00095: Despesas com pessoal RGPS sem INSS/FGTS correspondente
  // Conta 311210101 (despesa ativa RGPS) deve ter 312210100 (INSS) ou 312230100 (FGTS)
  const temDespRGPS = msc.some(a => a.CONTA === '311210101' && a.Tipo_valor === 'period_change' && a.Valor > 0);
  const temINSS = msc.some(a => a.CONTA === '312210100' && a.Tipo_valor === 'period_change' && a.Valor > 0);
  const temFGTS = msc.some(a => a.CONTA === '312230100' && a.Tipo_valor === 'period_change' && a.Valor > 0);
  if (temDespRGPS && !temINSS && !temFGTS) {
    results.push({
      ruleId: 'D2_00095',
      dimension: 'D2',
      description: 'Despesas previdenciárias RGPS sem INSS/FGTS',
      severity: 'warning',
      impactsCapag: false,
      affectedAccounts: ['311210101', '312210100', '312230100'],
      message: `Há despesas com pessoal ativo RGPS (311210101) mas sem registro de INSS patronal (312210100) nem FGTS (312230100). Verifique o registro das despesas previdenciárias.`,
    });
  }

  return results;
}


// =============================================================================
// D3 — Regras internas do RREO (não precisam do RGF)
// =============================================================================
function validateD3_RREO(rreo: any, _rulesMap: Map<string, RuleDefinition>): ValidationResult[] {
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


// =============================================================================
// D3 — Fiscal (RREO + RGF)
// =============================================================================
function validateD3_Fiscal(rreo: any, rgf: any, _rulesMap: Map<string, RuleDefinition>): ValidationResult[] {
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

  return results;
}


// =============================================================================
// D4 — Cruzamentos entre MSC e Demonstrativos Fiscais
// =============================================================================
function validateD4_Cruzamentos(data: ParsedData, _rulesMap: Map<string, RuleDefinition>): ValidationResult[] {
  const results: ValidationResult[] = [];

  // D4_00020: Receitas arrecadadas na MSC (6212) vs Anexo 01 do RREO
  if (data.msc && data.rreo) {
    const receitasMSC  = sumAccounts(data.msc, ['6212'], 'period_change');
    const receitasRREO = getReceitasArrecadadasRREO(data.rreo);

    if (receitasRREO === null) {
      results.push({
        ruleId: 'D4_00020',
        dimension: 'D4',
        description: '',
        severity: 'info',
        impactsCapag: true,
        message: `Não foi possível extrair o total de receitas arrecadadas do RREO Anexo 01. A regra D4_00020 não pôde ser verificada.`,
      });
    } else if (Math.abs(receitasMSC - receitasRREO) > 0.01) {
      results.push({
        ruleId: 'D4_00020',
        dimension: 'D4',
        description: '',
        severity: 'error',
        impactsCapag: true,
        message: `Receitas Arrecadadas divergentes. MSC (6212): R$ ${receitasMSC.toLocaleString('pt-BR', {minimumFractionDigits:2})} | RREO Anexo 01: R$ ${receitasRREO.toLocaleString('pt-BR', {minimumFractionDigits:2})}.`,
      });
    }
  }

  return results;
}


// =============================================================================
// D3 — Regras CAPAG da MSC
// =============================================================================
function validateMSC_CAPAG(msc: MSCAccount[], _rulesMap: Map<string, RuleDefinition>): ValidationResult[] {
  const results: ValidationResult[] = [];

  // D3_00021: Passivo financeiro >= Restos a Pagar (Executivo + RPPS)
  // Passivo financeiro: contas 21 e 22 com atributo F (FP = F)
  // Restos a Pagar: contas 212 (RPP) e 213 (RPNP)
  let passivoFinanceiro = 0;
  let restosAPagar = 0;

  msc.forEach(acc => {
    if (acc.Tipo_valor === 'ending_balance') {
      const valor = acc.Natureza_valor === 'C' ? acc.Valor : -acc.Valor;
      if (acc.CONTA.startsWith('21') || acc.CONTA.startsWith('22')) {
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
