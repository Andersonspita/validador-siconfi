import { describe, it, expect } from 'vitest';
import { validateLRF_MSC } from './rulesD3';
import { MSCAccount, ParsedData } from '../types';

const acc = (partial: Partial<MSCAccount> & Pick<MSCAccount, 'CONTA' | 'Valor'>): MSCAccount => ({
  PO: '10131',
  Tipo_valor: 'period_change',
  Natureza_valor: 'D',
  ...partial,
});

// ─── D2_LRF_PESSOAL_EXEC/LEG: Executivo x Legislativo não podem ficar trocados ─
//
// Regressão do bug: PO 1x = Executivo, PO 2x = Legislativo (confirmado por
// exemplo oficial da STN — Anexo I, Portaria STN nº 642/2019 — e por dados
// reais de Guanambi/BA 2026). O código antigo filtrava PO 2x para "pessoalExec"
// e PO 1x para "pessoalLeg", invertido. Isso fazia a folha de pagamento REAL do
// Executivo ser comparada contra o limite de 6% do Legislativo (art. 20, III,
// a, LRF) — disparando um IMPEDITIVO falso quase garantido em qualquer
// município, já que a folha do Executivo é naturalmente >> 6% da RCL. Foi
// exatamente esse bug que produziu "Despesa com Pessoal do Legislativo
// estimada: R$ 584.877.708,60 = 8.30% da RCL" no relatório real de Guanambi
// analisado em 05/07/2026 — um número overwhelmingly grande demais para a
// folha de uma Câmara Municipal, e na verdade era a folha do Executivo.

describe('D2_LRF_PESSOAL_EXEC/LEG — despesa com pessoal por Poder', () => {
  const buildMsc = (rclMensal: number, pessoalExecMensal: number, pessoalLegMensal: number): MSCAccount[] => [
    // Receita corrente (para cálculo da RCL anualizada = period_change * 12)
    acc({ CONTA: '621100000', Valor: rclMensal, Natureza_valor: 'C' }),
    // Despesa com pessoal do Executivo (PO 1x)
    acc({ CONTA: '311100000', PO: '10131', Valor: pessoalExecMensal, Natureza_valor: 'D' }),
    // Despesa com pessoal do Legislativo (PO 2x)
    acc({ CONTA: '311100000', PO: '20231', Valor: pessoalLegMensal, Natureza_valor: 'D' }),
  ];

  it('NÃO gera falso IMPEDITIVO de pessoal do Legislativo quando é a folha do Executivo que é grande (cenário real de Guanambi)', () => {
    // RCL mensal 5M (anualizada 60M). Executivo: 2M/mês (24M/ano = 40% da RCL,
    // dentro do limite de 54%). Legislativo: 200k/mês (2,4M/ano = 4% da RCL,
    // dentro do limite de 6%). Nenhum dos dois deveria disparar IMPEDITIVO.
    const msc = buildMsc(5_000_000, 2_000_000, 200_000);
    const data: ParsedData = { msc };
    const results = validateLRF_MSC(data, new Map());

    // Antes da correção, isto vinha como D2_LRF_PESSOAL_LEG (a folha do
    // Executivo, mal atribuída ao Legislativo, excedia o limite de 6%).
    expect(results.find(r => r.ruleId === 'D2_LRF_PESSOAL_LEG')).toBeUndefined();
    expect(results.find(r => r.ruleId === 'D2_LRF_PESSOAL_EXEC')).toBeUndefined();
  });

  it('gera IMPEDITIVO real de pessoal do Executivo quando o Executivo de fato excede 54% da RCL', () => {
    // RCL mensal 5M (anualizada 60M). Executivo: 3M/mês (36M/ano = 60% da RCL,
    // acima do limite de 54%).
    const msc = buildMsc(5_000_000, 3_000_000, 100_000);
    const data: ParsedData = { msc };
    const results = validateLRF_MSC(data, new Map());

    const execAlert = results.find(r => r.ruleId === 'D2_LRF_PESSOAL_EXEC');
    expect(execAlert).toBeDefined();
    expect(execAlert?.message).toContain('Executivo');
  });

  it('gera IMPEDITIVO real de pessoal do Legislativo quando o Legislativo de fato excede 6% da RCL', () => {
    // RCL mensal 5M (anualizada 60M). Legislativo: 400k/mês (4,8M/ano = 8% da
    // RCL, acima do limite de 6%). Executivo dentro do limite.
    const msc = buildMsc(5_000_000, 2_000_000, 400_000);
    const data: ParsedData = { msc };
    const results = validateLRF_MSC(data, new Map());

    const legAlert = results.find(r => r.ruleId === 'D2_LRF_PESSOAL_LEG');
    expect(legAlert).toBeDefined();
    expect(legAlert?.message).toContain('Legislativo');
  });
});
