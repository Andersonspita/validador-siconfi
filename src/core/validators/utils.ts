import { ValidationResult, MSCAccount, DetailedItem } from '../types';

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
  return [{
    ruleId, dimension, description: '', severity: 'error', impactsCapag,
    message: `${msgBase} ${detail}.`,
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
  expectedNatureza: MSCAccount['Natureza_valor']
): MSCAccount[] =>
  msc.filter(acc =>
    prefixes.some(p => acc.CONTA.startsWith(p)) &&
    acc.Tipo_valor === 'ending_balance' &&
    acc.Natureza_valor !== expectedNatureza &&
    acc.Valor > 0
  );

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
