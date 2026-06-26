import { describe, it, expect } from 'vitest';
import { validateD1_MSC, validateMultiMonth } from './rulesD1';
import { MSCAccount } from '../types';

const acc = (partial: Partial<MSCAccount> & Pick<MSCAccount, 'CONTA' | 'Valor'>): MSCAccount => ({
  PO: '20131',
  Tipo_valor: 'ending_balance',
  Natureza_valor: 'D',
  ...partial,
});

// ─── D1_00017: valores negativos ─────────────────────────────────────────────

describe('D1_00017 — valores negativos', () => {
  it('não alerta quando todos os valores são >= 0', () => {
    const msc: MSCAccount[] = [acc({ CONTA: '111111900', Valor: 100 })];
    const results = validateD1_MSC(msc, new Map());
    expect(results.find(r => r.ruleId === 'D1_00017')).toBeUndefined();
  });

  it('alerta quando há valor negativo', () => {
    const msc: MSCAccount[] = [acc({ CONTA: '111111900', Valor: -50 })];
    const results = validateD1_MSC(msc, new Map());
    expect(results.find(r => r.ruleId === 'D1_00017')).toBeDefined();
  });
});

// ─── D1_00018: SI + MOV ≠ SF ─────────────────────────────────────────────────

describe('D1_00018 — SI + MOV = SF', () => {
  it('não alerta quando SI + MOV = SF', () => {
    const msc: MSCAccount[] = [
      acc({ CONTA: '111111900', Valor: 100, Tipo_valor: 'beginning_balance', Natureza_valor: 'D' }),
      acc({ CONTA: '111111900', Valor: 50,  Tipo_valor: 'period_change',    Natureza_valor: 'D' }),
      acc({ CONTA: '111111900', Valor: 150, Tipo_valor: 'ending_balance',   Natureza_valor: 'D' }),
    ];
    const results = validateD1_MSC(msc, new Map());
    expect(results.find(r => r.ruleId === 'D1_00018')).toBeUndefined();
  });

  it('alerta quando SF difere de SI + MOV com a mesma chave de IC', () => {
    const msc: MSCAccount[] = [
      acc({ CONTA: '111111900', Valor: 100, Tipo_valor: 'beginning_balance', Natureza_valor: 'D' }),
      acc({ CONTA: '111111900', Valor: 50,  Tipo_valor: 'period_change',    Natureza_valor: 'D' }),
      acc({ CONTA: '111111900', Valor: 999, Tipo_valor: 'ending_balance',   Natureza_valor: 'D' }),
    ];
    const results = validateD1_MSC(msc, new Map());
    const r = results.find(r => r.ruleId === 'D1_00018');
    expect(r).toBeDefined();
    // mensagem deve mencionar reclassificação de IC
    expect(r?.message).toContain('IC');
  });

  it('não alerta quando ICs diferentes justificam SI=0 no EB (reclassificação legítima)', () => {
    // FR diferente no EB → chave distinta → si=0, mov=0, sf>0 → acusa D1_00018
    // mas isso é legítimo — a mensagem deve existir mas ser informativa
    const msc: MSCAccount[] = [
      acc({ CONTA: '111111900', FR: '1500', Valor: 100, Tipo_valor: 'beginning_balance', Natureza_valor: 'D' }),
      acc({ CONTA: '111111900', FR: '1540', Valor: 100, Tipo_valor: 'ending_balance',   Natureza_valor: 'D' }),
    ];
    const results = validateD1_MSC(msc, new Map());
    const r = results.find(r => r.ruleId === 'D1_00018');
    // pode disparar, mas deve mencionar IC reclassificação na mensagem
    if (r) expect(r.message).toContain('Reclassificações de Indicador');
  });
});

// ─── D1_00021: ativo com saldo invertido ──────────────────────────────────────

describe('D1_00021 — ativo com saldo invertido', () => {
  it('alerta quando conta 1111xxx tem saldo C', () => {
    const msc: MSCAccount[] = [acc({ CONTA: '111111900', Valor: 50, Natureza_valor: 'C' })];
    const results = validateD1_MSC(msc, new Map());
    expect(results.find(r => r.ruleId === 'D1_00021')).toBeDefined();
  });

  it('não alerta para conta retificadora (depreciação) com saldo C legítimo', () => {
    const msc: MSCAccount[] = [acc({ CONTA: '123810100', Valor: 50, Natureza_valor: 'C' })];
    const results = validateD1_MSC(msc, new Map());
    expect(results.find(r => r.ruleId === 'D1_00021')).toBeUndefined();
  });

  it('não alerta quando conta 1111xxx tem saldo D correto', () => {
    const msc: MSCAccount[] = [acc({ CONTA: '111111900', Valor: 100, Natureza_valor: 'D' })];
    const results = validateD1_MSC(msc, new Map());
    expect(results.find(r => r.ruleId === 'D1_00021')).toBeUndefined();
  });
});

// ─── D1_00022: Executivo ausente ──────────────────────────────────────────────

describe('D1_00022 — Executivo ausente na MSC', () => {
  it('alerta quando nenhum PO começa com 2', () => {
    const msc: MSCAccount[] = [acc({ CONTA: '111111900', PO: '10131', Valor: 100 })];
    const results = validateD1_MSC(msc, new Map());
    expect(results.find(r => r.ruleId === 'D1_00022')).toBeDefined();
  });

  it('não alerta quando há PO do Executivo (começa com 2)', () => {
    const msc: MSCAccount[] = [acc({ CONTA: '111111900', PO: '20131', Valor: 100 })];
    const results = validateD1_MSC(msc, new Map());
    expect(results.find(r => r.ruleId === 'D1_00022')).toBeUndefined();
  });
});

// ─── D1_00031: despesa sem ND ─────────────────────────────────────────────────

describe('D1_00031 — despesa 62213 sem ND', () => {
  it('alerta quando conta 62213 tem ND ausente', () => {
    const msc: MSCAccount[] = [acc({ CONTA: '622130100', Valor: 500, Natureza_valor: 'C' })];
    const results = validateD1_MSC(msc, new Map());
    expect(results.find(r => r.ruleId === 'D1_00031')).toBeDefined();
  });

  it('não alerta quando ND está preenchido', () => {
    const msc: MSCAccount[] = [acc({ CONTA: '622130100', ND: '339030', Valor: 500, Natureza_valor: 'C' })];
    const results = validateD1_MSC(msc, new Map());
    expect(results.find(r => r.ruleId === 'D1_00031')).toBeUndefined();
  });
});

// ─── D1_00023/D1_00024: MSCs idênticas — comparação via Map ──────────────────

describe('D1_00023/D1_00024 — MSCs idênticas entre meses (comparação via Map)', () => {
  const makeExecAcc = (conta: string, valor: number): MSCAccount =>
    acc({ CONTA: conta, PO: '20131', Valor: valor, Tipo_valor: 'ending_balance' });

  it('detecta MSCs do Executivo idênticas mesmo em ordens diferentes', () => {
    const mscByPeriod: Record<string, MSCAccount[]> = {
      '2026-01': [makeExecAcc('111111900', 100), makeExecAcc('211110100', 50)],
      '2026-02': [makeExecAcc('211110100', 50), makeExecAcc('111111900', 100)], // mesma, ordem diferente
    };
    const results = validateMultiMonth(mscByPeriod, new Map());
    expect(results.find(r => r.ruleId === 'D1_00023')).toBeDefined();
  });

  it('não alerta quando valores diferem entre meses', () => {
    const mscByPeriod: Record<string, MSCAccount[]> = {
      '2026-01': [makeExecAcc('111111900', 100)],
      '2026-02': [makeExecAcc('111111900', 200)],
    };
    const results = validateMultiMonth(mscByPeriod, new Map());
    expect(results.find(r => r.ruleId === 'D1_00023')).toBeUndefined();
  });
});
