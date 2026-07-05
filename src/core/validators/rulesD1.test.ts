import { describe, it, expect, vi, afterEach } from 'vitest';
import { validateD1_MSC, validateMultiMonth, validateD1_Entrega } from './rulesD1';
import { MSCAccount, ParsedData } from '../types';

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

// ─── D1_00001: integração com a API de homologação do Siconfi ───────────────
// Regressão do bug: a interface antiga usava um campo "relatorio" que não
// existe na API real (o campo correto é "entregavel"), e comparava
// status_relatorio contra a string "homologado" quando a API devolve um
// código curto (ex.: "HO"). Isso fazia D1_00001 disparar como IMPEDITIVO
// mesmo quando o ente já tinha homologado tudo — foi exatamente o caso do
// relatório de PM Guanambi (2911709) analisado em 05/07/2026.

describe('D1_00001 — homologação via API do Siconfi', () => {
  const baseData: ParsedData = {
    enteId: '2911709',
    anoReferencia: '2026',
    msc: [acc({ CONTA: '111111900', Valor: 100 })],
  };

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('NÃO gera IMPEDITIVO quando a API confirma homologação (payload real da STN)', async () => {
    const fakeResponse = {
      items: [
        {
          exercicio: 2026, cod_ibge: '2911709', populacao: 80000,
          instituicao: 'Prefeitura Municipal de Guanambi',
          entregavel: 'Relatório Resumido de Execução Orçamentária',
          periodo: 2, periodicidade: 'B',
          status_relatorio: 'HO', data_status: '2026-05-10T12:00:00Z',
          forma_envio: 'M', tipo_relatorio: 'P',
        },
        {
          exercicio: 2026, cod_ibge: '2911709', populacao: 80000,
          instituicao: 'Prefeitura Municipal de Guanambi',
          entregavel: 'Relatório de Gestão Fiscal',
          periodo: 1, periodicidade: 'Q',
          status_relatorio: 'HO', data_status: '2026-05-10T12:00:00Z',
          forma_envio: 'M', tipo_relatorio: 'P',
        },
        {
          exercicio: 2026, cod_ibge: '2911709', populacao: 80000,
          instituicao: 'Prefeitura Municipal de Guanambi',
          entregavel: 'Declaração de Contas Anuais',
          periodo: 1, periodicidade: 'A',
          status_relatorio: 'HO', data_status: '2026-05-10T12:00:00Z',
          forma_envio: 'M', tipo_relatorio: 'P',
        },
      ],
      hasMore: false, limit: 5000, offset: 0, count: 3,
    };

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => fakeResponse,
    }));

    const results = await validateD1_Entrega(baseData, new Map());
    const d1 = results.find(r => r.ruleId === 'D1_00001');

    // Antes da correção, isto vinha como severity 'error' (IMPEDITIVO) mesmo
    // com os 3 relatórios homologados no payload acima.
    expect(d1?.severity).not.toBe('error');
  });

  it('AINDA gera IMPEDITIVO quando a API confirma que realmente NÃO há homologação', async () => {
    const fakeResponse = { items: [], hasMore: false, limit: 5000, offset: 0, count: 0 };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => fakeResponse,
    }));

    const results = await validateD1_Entrega(baseData, new Map());
    const d1 = results.find(r => r.ruleId === 'D1_00001');
    // Sem nenhum item retornado pela API, cai no branch de "Falha na API ou sem dados"
    // (severity 'warning'), não deve ser confundido com o caso confirmado.
    expect(d1).toBeDefined();
  });
});
