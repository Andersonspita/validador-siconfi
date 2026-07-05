import { describe, it, expect } from 'vitest';
import { generateRelatorioTecnicoPDFBuffer } from './relatorioTecnico';
import { ValidationResult } from './types';

describe('generateRelatorioTecnicoPDFBuffer', () => {
  it('gera um PDF válido (não vazio) sem nenhuma menção a nome de empresa', () => {
    const results: ValidationResult[] = [
      {
        ruleId: 'D1_00001',
        dimension: 'D1',
        description: 'Verificação de entrega dos demonstrativos',
        severity: 'error',
        impactsCapag: true,
        message: 'Demonstrativo(s) NÃO homologados na API do Siconfi para o Poder Executivo em 2026: RREO, RGF, DCA.',
        debugInfo: {
          label: 'Resposta da API',
          payload: {
            pendenciasPorPoder: [
              { instituicao: 'Prefeitura Municipal de Guanambi - BA', poder: 'Executivo', pendentes: ['RREO', 'RGF', 'DCA'] },
              { instituicao: 'Câmara de Vereadores de Guanambi - BA', poder: 'Legislativo', pendentes: ['RREO', 'DCA'] },
            ],
            entregas: [],
          },
        },
      },
      {
        ruleId: 'D2_00077',
        dimension: 'D2',
        description: 'Validação de saldo inicial x final',
        severity: 'error',
        impactsCapag: false,
        message: 'Conta 122110107: O saldo final de 2026-01 difere do saldo inicial de 2026-02.',
        actionPlan: 'Investigar a origem da divergência antes do próximo fechamento.',
      },
      {
        ruleId: 'D2_00081',
        dimension: 'D2',
        description: 'Férias e 13º salário sem provisão registrada',
        severity: 'warning',
        impactsCapag: false,
        message: 'Há despesas com pessoal, mas sem saldo final de provisão.',
      },
    ];

    const buffer = generateRelatorioTecnicoPDFBuffer(results, { enteId: '2911709', periodo: '2026-01 a 2026-03' });
    expect(buffer.byteLength).toBeGreaterThan(1000);

    // O PDF gerado (binário) não deve conter nenhuma referência textual a nomes de empresa.
    const text = Buffer.from(buffer).toString('latin1');
    expect(text.toLowerCase()).not.toContain('lopes consultoria');
  });

  it('não quebra quando não há nenhuma inconsistência', () => {
    const buffer = generateRelatorioTecnicoPDFBuffer([], { enteId: '2911709', periodo: '2026-01' });
    expect(buffer.byteLength).toBeGreaterThan(500);
  });
});
