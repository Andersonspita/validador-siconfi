/**
 * capagEngine.ts
 * Estimativa dos indicadores CAPAG a partir de dados da MSC.
 * Referência: Portaria STN nº 501/2017 e atualizações.
 *
 * ⚠️  ESTIMATIVA — o CAPAG oficial usa DCA (anual) e RGF (semestral).
 *     Com MSC mensal, os valores são aproximados e servem como alerta antecipado.
 */

import { MSCAccount } from './types';

// ── Thresholds por indicador (municípios) ────────────────────────────────────

const THRESHOLDS = {
  endividamento: { a: 0,   b: 1.2  },  // DC/RCL: A≤0 | B≤1.2 | C>1.2
  poupanca:      { a: 0.95, b: 1.0 },  // DC/RC:  A<0.95 | B<1.0 | C≥1.0
  liquidez:      { a: 1.0, b: 2.0  },  // OF/DCB: A≤1 | B≤2 | C>2
};

export type NotaCapag = 'A' | 'B' | 'C' | '–';

export interface IndicadorCapag {
  nome: string;
  formula: string;
  numerador: number;
  denominador: number;
  resultado: number | null;
  nota: NotaCapag;
  referencia: string;
}

export interface ResultadoCapag {
  notaGeral: NotaCapag;
  indicadores: IndicadorCapag[];
  advertencias: string[];
  baseCalculo: 'MSC' | 'RGF' | 'DCA';
}

// ── Helpers de soma ───────────────────────────────────────────────────────────

function soma(msc: MSCAccount[], prefixos: string[], tipo: 'ending_balance' | 'period_change', nat: 'D' | 'C'): number {
  return msc
    .filter(a => prefixos.some(p => a.CONTA.startsWith(p)) && a.Tipo_valor === tipo && a.Natureza_valor === nat)
    .reduce((s, a) => s + a.Valor, 0);
}

function netBalance(msc: MSCAccount[], prefixos: string[], tipo: 'ending_balance' | 'period_change'): number {
  const d = soma(msc, prefixos, tipo, 'D');
  const c = soma(msc, prefixos, tipo, 'C');
  return d - c;
}

function gradeEnvidamento(v: number): NotaCapag {
  if (v <= THRESHOLDS.endividamento.a) return 'A';
  if (v <= THRESHOLDS.endividamento.b) return 'B';
  return 'C';
}
function gradePoupanca(v: number): NotaCapag {
  if (v < THRESHOLDS.poupanca.a) return 'A';
  if (v < THRESHOLDS.poupanca.b) return 'B';
  return 'C';
}
function gradeLiquidez(v: number): NotaCapag {
  if (v <= THRESHOLDS.liquidez.a) return 'A';
  if (v <= THRESHOLDS.liquidez.b) return 'B';
  return 'C';
}

function notaGeral(notas: NotaCapag[]): NotaCapag {
  if (notas.includes('C')) return 'C';
  if (notas.includes('B')) return 'B';
  if (notas.every(n => n === 'A')) return 'A';
  return '–';
}

// ── Cálculo principal ─────────────────────────────────────────────────────────

export function calcularCapag(msc: MSCAccount[]): ResultadoCapag {
  const advertencias: string[] = [];

  // ── Indicador 1: Endividamento (DCL / RCL) ──────────────────────────────
  // Dívida Consolidada Bruta = dívida fundada interna + externa
  const dividaBruta = Math.max(0,
    netBalance(msc, ['21211', '21212', '21213', '21221', '21311', '21312', '21313'], 'ending_balance') * -1
    + soma(msc, ['21211', '21212', '21213', '21221', '21311', '21312', '21313'], 'ending_balance', 'C')
    - soma(msc, ['21211', '21212', '21213', '21221', '21311', '21312', '21313'], 'ending_balance', 'D')
  );
  // Disponibilidades (para DCL)
  const disponibilidades = Math.max(0, soma(msc, ['1111'], 'ending_balance', 'D') - soma(msc, ['1111'], 'ending_balance', 'C'));
  const dcl = Math.max(0, dividaBruta - disponibilidades);

  // RCL: anualizar receitas correntes realizadas (period_change * 12)
  const receitasMes = soma(msc, ['6211'], 'period_change', 'C') - soma(msc, ['6211'], 'period_change', 'D');
  const rcl = receitasMes * 12;

  const ratioEnd = rcl > 0 ? dcl / rcl : null;
  if (rcl === 0) advertencias.push('RCL não estimável — sem movimentação de receitas na MSC do período.');

  const ind1: IndicadorCapag = {
    nome: 'Endividamento',
    formula: 'DCL / RCL',
    numerador: dcl,
    denominador: rcl,
    resultado: ratioEnd,
    nota: ratioEnd !== null ? gradeEnvidamento(ratioEnd) : '–',
    referencia: 'Art. 3º, Portaria STN 501/2017 · Limite municípios: A≤0, B≤1,2, C>1,2',
  };

  // ── Indicador 2: Poupança Corrente (Despesas Correntes / Receitas Correntes) ──
  const despesasCorrentes = soma(msc, ['622'], 'period_change', 'C')
    - soma(msc, ['622'], 'period_change', 'D');
  const receitasCorrentes = receitasMes;

  const ratioPoupa = receitasCorrentes > 0 ? despesasCorrentes / receitasCorrentes : null;
  if (receitasCorrentes === 0) advertencias.push('Receitas correntes zeradas — poupança corrente não calculável.');

  const ind2: IndicadorCapag = {
    nome: 'Poupança Corrente',
    formula: 'Despesas Correntes / Receitas Correntes',
    numerador: despesasCorrentes,
    denominador: receitasCorrentes,
    resultado: ratioPoupa,
    nota: ratioPoupa !== null ? gradePoupanca(ratioPoupa) : '–',
    referencia: 'Art. 4º, Portaria STN 501/2017 · Limite: A<0,95, B<1,0, C≥1,0',
  };

  // ── Indicador 3: Liquidez (Obrigações Financeiras / Disponibilidade de Caixa Bruta) ──
  // Obrigações financeiras = fornecedores + trib a recolher + precatórios + outros CCP
  const obrigacoes = Math.max(0,
    soma(msc, ['21111', '21112', '21113', '21114', '21115', '21118', '21119'], 'ending_balance', 'C')
    - soma(msc, ['21111', '21112', '21113', '21114', '21115', '21118', '21119'], 'ending_balance', 'D')
  );
  // Disponibilidade de Caixa Bruta (fontes não vinculadas estimada)
  const caixaBruto = Math.max(0, disponibilidades);
  // DDR: saldo 821 > saldo 721 indica vinculações que reduzem disponibilidade livre
  const ddr821 = soma(msc, ['821'], 'ending_balance', 'C') - soma(msc, ['821'], 'ending_balance', 'D');
  const ddr721 = soma(msc, ['721'], 'ending_balance', 'D') - soma(msc, ['721'], 'ending_balance', 'C');
  const excesso821 = Math.max(0, ddr821 - ddr721);
  const caixaNaoVinculado = Math.max(0, caixaBruto - excesso821);

  const ratioLiq = caixaNaoVinculado > 0 ? obrigacoes / caixaNaoVinculado : null;
  if (caixaNaoVinculado === 0) advertencias.push('Disponibilidade de caixa não vinculada zerada — liquidez não calculável.');
  if (excesso821 > 0) advertencias.push(`DDR desequilibrado (R$ ${(excesso821/1e6).toFixed(1)}M) reduz a disponibilidade livre — impacto direto no Indicador 3.`);

  const ind3: IndicadorCapag = {
    nome: 'Liquidez',
    formula: 'Obrigações Financeiras / Disponibilidade de Caixa (fontes livres)',
    numerador: obrigacoes,
    denominador: caixaNaoVinculado,
    resultado: ratioLiq,
    nota: ratioLiq !== null ? gradeLiquidez(ratioLiq) : '–',
    referencia: 'Art. 5º, Portaria STN 501/2017 · Limite: A≤1, B≤2, C>2',
  };

  advertencias.push('Estimativa baseada em MSC mensal. O CAPAG oficial usa DCA (anual) e RGF (semestral) da STN.');

  return {
    notaGeral: notaGeral([ind1.nota, ind2.nota, ind3.nota]),
    indicadores: [ind1, ind2, ind3],
    advertencias,
    baseCalculo: 'MSC',
  };
}
