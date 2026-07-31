import { describe, it, expect } from 'vitest';
import { validateD2_MSC } from './rulesD2';
import { MSCAccount, ParsedData } from '../types';

const acc = (partial: Partial<MSCAccount> & Pick<MSCAccount, 'CONTA' | 'Valor'>): MSCAccount => ({
  PO: '20131',
  Tipo_valor: 'ending_balance',
  Natureza_valor: 'D',
  ...partial,
});

const data = (msc: MSCAccount[]): ParsedData => ({ msc });

// ─── D2_00083: integridade DDR ────────────────────────────────────────────────

describe('D2_00083 — integridade DDR (7211 × 8211)', () => {
  it('não alerta quando 7211 = 8211', () => {
    const msc: MSCAccount[] = [
      acc({ CONTA: '721110000', Valor: 500, Natureza_valor: 'D' }),
      acc({ CONTA: '821110000', Valor: 500, Natureza_valor: 'C' }),
    ];
    const results = validateD2_MSC(data(msc), new Map());
    expect(results.find(r => r.ruleId === 'D2_00083')).toBeUndefined();
  });

  it('alerta quando 7211 ≠ 8211 com diferença > 0.01', () => {
    const msc: MSCAccount[] = [
      acc({ CONTA: '721110000', Valor: 500, Natureza_valor: 'D' }),
      acc({ CONTA: '821110000', Valor: 600, Natureza_valor: 'C' }),
    ];
    const results = validateD2_MSC(data(msc), new Map());
    const r = results.find(r => r.ruleId === 'D2_00083');
    expect(r).toBeDefined();
    expect(r?.severity).toBe('error');
    expect(r?.message).toContain('7211');
    expect(r?.message).toContain('8211');
  });

  it('não inclui garantias (722/822) no cálculo DDR', () => {
    // Apenas 722/822 desequilibrados — não deve acusar D2_00083
    const msc: MSCAccount[] = [
      acc({ CONTA: '722110000', Valor: 999, Natureza_valor: 'D' }),
      acc({ CONTA: '822110000', Valor: 1,   Natureza_valor: 'C' }),
    ];
    const results = validateD2_MSC(data(msc), new Map());
    expect(results.find(r => r.ruleId === 'D2_00083')).toBeUndefined();
  });

  it('affectedAccounts usa constantes de pcaspRules (não hardcode)', () => {
    const msc: MSCAccount[] = [
      acc({ CONTA: '721110000', Valor: 100, Natureza_valor: 'D' }),
      acc({ CONTA: '821110000', Valor: 200, Natureza_valor: 'C' }),
    ];
    const results = validateD2_MSC(data(msc), new Map());
    const r = results.find(r => r.ruleId === 'D2_00083');
    expect(r?.affectedAccounts).toContain('7211');
    expect(r?.affectedAccounts).toContain('8211');
  });
});

// ─── D2_00081: provisão de férias e 13º ─────────────────────────────────────

describe('D2_00081 — provisão de férias e 13º', () => {
  it('não alerta quando não há despesa de pessoal', () => {
    const msc: MSCAccount[] = [
      acc({ CONTA: '111111900', Valor: 1000 }),
    ];
    const results = validateD2_MSC(data(msc), new Map());
    expect(results.find(r => r.ruleId === 'D2_00081')).toBeUndefined();
  });

  it('alerta quando há despesa de pessoal mas sem provisões', () => {
    const msc: MSCAccount[] = [
      acc({ CONTA: '311210101', Valor: 50000, Tipo_valor: 'period_change', Natureza_valor: 'D' }),
    ];
    const results = validateD2_MSC(data(msc), new Map());
    const r = results.find(r => r.ruleId === 'D2_00081');
    expect(r).toBeDefined();
    expect(r?.affectedAccounts).toContain('211110102');
  });

  it('não alerta quando há pessoal e provisões de férias + 13º + 13ºP', () => {
    const msc: MSCAccount[] = [
      acc({ CONTA: '311210101', Valor: 50000, Tipo_valor: 'period_change',  Natureza_valor: 'D' }),
      acc({ CONTA: '211110102', Valor: 5000,  Tipo_valor: 'ending_balance', Natureza_valor: 'C' }),
      acc({ CONTA: '211110103', Valor: 4000,  Tipo_valor: 'ending_balance', Natureza_valor: 'C' }),
      acc({ CONTA: '211110104', Valor: 2000,  Tipo_valor: 'ending_balance', Natureza_valor: 'C' }),
    ];
    const results = validateD2_MSC(data(msc), new Map());
    expect(results.find(r => r.ruleId === 'D2_00081')).toBeUndefined();
  });
});

// ─── D2_00050: bug QA-001 corrigido ──────────────────────────────────────────

describe('D2_00050 — despesas empenhadas MSC Encerramento (QA-001)', () => {
  it('não gera falso erro quando MSC de encerramento não tem período encerramento', () => {
    // Sem período de encerramento → D2_00050 não executa → nenhum erro espúrio
    const mscByPeriod: Record<string, MSCAccount[]> = {
      '2025-12': [acc({ CONTA: '111111900', Valor: 100 })],
    };
    const parsed: ParsedData = { msc: mscByPeriod['2025-12'], mscByPeriod };
    const results = validateD2_MSC(parsed, new Map(), '2025-12');
    expect(results.find(r => r.ruleId === 'D2_00050')).toBeUndefined();
  });
});

// ─── D2_00055: amortização de intangíveis ────────────────────────────────────

describe('D2_00055 — amortização acumulada > ativo intangível', () => {
  it('alerta quando amortização supera o ativo intangível', () => {
    const msc: MSCAccount[] = [
      acc({ CONTA: '124110000', Valor: 100, Natureza_valor: 'D' }),
      acc({ CONTA: '124810000', Valor: 200, Natureza_valor: 'C' }), // amortização > ativo
    ];
    const results = validateD2_MSC(data(msc), new Map());
    expect(results.find(r => r.ruleId === 'D2_00055')).toBeDefined();
  });

  it('não alerta quando amortização ≤ ativo intangível', () => {
    const msc: MSCAccount[] = [
      acc({ CONTA: '124110000', Valor: 500, Natureza_valor: 'D' }),
      acc({ CONTA: '124810000', Valor: 200, Natureza_valor: 'C' }),
    ];
    const results = validateD2_MSC(data(msc), new Map());
    expect(results.find(r => r.ruleId === 'D2_00055')).toBeUndefined();
  });
});

// ─── D2_00082: depreciação mensal de bens móveis ─────────────────────────────

describe('D2_00082 — depreciação mensal de bens móveis', () => {
  it('alerta quando há bens móveis mas sem movimentação de depreciação', () => {
    const msc: MSCAccount[] = [
      acc({ CONTA: '123110100', Valor: 100000, Tipo_valor: 'ending_balance', Natureza_valor: 'D' }),
    ];
    const results = validateD2_MSC(data(msc), new Map());
    expect(results.find(r => r.ruleId === 'D2_00082')).toBeDefined();
  });

  it('não alerta quando há movimentação mensal de depreciação', () => {
    const msc: MSCAccount[] = [
      acc({ CONTA: '123110100', Valor: 100000, Tipo_valor: 'ending_balance', Natureza_valor: 'D' }),
      acc({ CONTA: '123810100', Valor: 500, Tipo_valor: 'period_change', Natureza_valor: 'C' }),
    ];
    const results = validateD2_MSC(data(msc), new Map());
    expect(results.find(r => r.ruleId === 'D2_00082')).toBeUndefined();
  });
});

// ─── D2_00086 / 087 / 088: VPD/VPA mensais ───────────────────────────────────

describe('D2_00086/087/088 — VPD/VPA por competência', () => {
  it('D2_00086 alerta despesa sem VPD de material de consumo', () => {
    const msc: MSCAccount[] = [
      acc({ CONTA: '622130000', Valor: 1000, Tipo_valor: 'period_change', Natureza_valor: 'C' }),
    ];
    const results = validateD2_MSC(data(msc), new Map());
    expect(results.find(r => r.ruleId === 'D2_00086')).toBeDefined();
  });

  it('D2_00086 não alerta quando há VPD de material', () => {
    const msc: MSCAccount[] = [
      acc({ CONTA: '622130000', Valor: 1000, Tipo_valor: 'period_change', Natureza_valor: 'C' }),
      acc({ CONTA: '331110000', Valor: 800, Tipo_valor: 'period_change', Natureza_valor: 'D' }),
    ];
    const results = validateD2_MSC(data(msc), new Map());
    expect(results.find(r => r.ruleId === 'D2_00086')).toBeUndefined();
  });

  it('D2_00088 alerta receita de transferência sem VPA correspondente', () => {
    const msc: MSCAccount[] = [
      acc({ CONTA: '621310000', Valor: 5000, Tipo_valor: 'period_change', Natureza_valor: 'C' }),
    ];
    const results = validateD2_MSC(data(msc), new Map());
    expect(results.find(r => r.ruleId === 'D2_00088')).toBeDefined();
  });
});
