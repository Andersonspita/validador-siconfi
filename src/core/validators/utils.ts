import { ValidationResult, MSCAccount, DetailedItem } from '../types';
import { TOLERANCIA_REAIS, MDF_VERSION } from '../pcaspRules';

const TIPOS_SALDO: MSCAccount['Tipo_valor'][] = ['beginning_balance', 'period_change', 'ending_balance'];

const TIPO_SALDO_LABEL: Record<MSCAccount['Tipo_valor'], string> = {
  beginning_balance: 'Saldo Inicial',
  period_change: 'Movimentação',
  ending_balance: 'Saldo Final',
};

/** Chave única de lançamento MSC (todos os ICs relevantes). */
export const mscAccountKey = (acc: MSCAccount): string =>
  [acc.CONTA, acc.PO, acc.FP, acc.FS, acc.FR, acc.CO, acc.ND].map(v => v ?? '').join('|');

export const isRegularMonthPeriod = (period: string): boolean => {
  const m = parseInt(period.split('-')[1] ?? '0', 10);
  return m >= 1 && m <= 12;
};

export const findEncerramentoPeriod = (mscByPeriod: Record<string, MSCAccount[]>): string | undefined =>
  Object.keys(mscByPeriod).find(p => {
    const m = parseInt(p.split('-')[1] ?? '0', 10);
    return m > 12 || m === 0;
  });

export const prefixMessage = (msg: string, periodLabel?: string): string =>
  periodLabel ? `[${periodLabel}] ${msg}` : msg;

// Compara dois valores de demonstrativos; retorna ValidationResult[] (vazio se ok ou dados ausentes)
export function validatePairEquality(
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
    actionPlan: `Ação Corretiva: Verifique e corrija os lançamentos que compõem [${a.label}] ou ajuste o valor informado em [${b.label}].`
  }];
}

// Compara três valores; gera erro para cada par que divergir
export function validateTripleEquality(
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
  
  const sources = Array.from(new Set(diverging.flatMap(([x,y]) => [x.label, y.label]))).join(', ');
  return [{
    ruleId, dimension, description: '', severity: 'error', impactsCapag,
    message: `${msgBase} ${detail}.`,
    actionPlan: `Ação Corretiva: Revise a conciliação entre as fontes: ${sources}.`
  }];
}

// Soma valores de contas com prefixo, tipo e natureza especificados
export const sumAccounts = (
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

// Calcula o saldo líquido considerando a natureza esperada (D ou C)
export const getNetBalance = (
  msc: MSCAccount[],
  prefixes: string[],
  tipo: MSCAccount['Tipo_valor'],
  expectedNature: 'D' | 'C',
  excludePrefixes: string[] = []
): number => {
  const sumD = sumAccounts(msc, prefixes, tipo, 'D', excludePrefixes);
  const sumC = sumAccounts(msc, prefixes, tipo, 'C', excludePrefixes);
  return expectedNature === 'D' ? sumD - sumC : sumC - sumD;
};

// Retorna registros de contas que violam uma natureza esperada no saldo final
export const findInvertedAccounts = (
  msc: MSCAccount[],
  prefixes: string[],
  expectedNatureza: MSCAccount['Natureza_valor'],
  excludePrefixes: string[] = []
): MSCAccount[] =>
  msc.filter(acc =>
    prefixes.some(p => acc.CONTA.startsWith(p)) &&
    !excludePrefixes.some(p => acc.CONTA.startsWith(p)) &&
    acc.Tipo_valor === 'ending_balance' &&
    acc.Natureza_valor !== expectedNatureza &&
    acc.Valor > 0
  );

/** Verifica equilíbrio SUM(D) = SUM(C) por tipo de saldo na MSC. */
export const validateEquilibrioGeral = (
  msc: MSCAccount[],
  periodLabel?: string
): ValidationResult[] => {
  const results: ValidationResult[] = [];

  for (const tipo of TIPOS_SALDO) {
    const sumD = msc
      .filter(a => a.Tipo_valor === tipo && a.Natureza_valor === 'D')
      .reduce((s, a) => s + a.Valor, 0);
    const sumC = msc
      .filter(a => a.Tipo_valor === tipo && a.Natureza_valor === 'C')
      .reduce((s, a) => s + a.Valor, 0);
    const diff = Math.abs(sumD - sumC);

    if (diff > TOLERANCIA_REAIS) {
      results.push({
        ruleId: 'D2_MSC_EQUILIBRIO',
        dimension: 'D2',
        description: 'Equilíbrio contábil da MSC (soma devedora = soma credora)',
        severity: 'error',
        impactsCapag: false,
        message: prefixMessage(
          `${TIPO_SALDO_LABEL[tipo]}: SUM(D)=R$ ${sumD.toFixed(2)} ≠ SUM(C)=R$ ${sumC.toFixed(2)} (dif.: R$ ${diff.toFixed(2)}). Referência: ${MDF_VERSION}.`,
          periodLabel
        ),
        actionPlan: 'Revise os lançamentos com natureza D/C invertida ou valores ausentes neste tipo de saldo.',
      });
    }
  }

  return results;
};

/** Saldo líquido credor do passivo circulante (classe 21). */
export const getPassivoCirculanteNet = (
  msc: MSCAccount[],
  filter?: (acc: MSCAccount) => boolean
): number =>
  msc
    .filter(a =>
      a.CONTA.startsWith('21') &&
      a.Tipo_valor === 'ending_balance' &&
      (!filter || filter(a))
    )
    .reduce((s, a) => s + (a.Natureza_valor === 'C' ? a.Valor : -a.Valor), 0);

// Monta detailedItems padrão para contas invertidas
export const buildInvertedItems = (accounts: MSCAccount[], expected: string): DetailedItem[] =>
  accounts.map(a => ({
    conta: a.CONTA,
    po: a.PO,
    fr: a.FR,
    co: a.CO,
    valor: a.Valor,
    detalhe: `Natureza informada: ${a.Natureza_valor} (esperado: ${expected})`,
  }));
