import { describe, it, expect } from 'vitest';
import { buildScoreSummary, classeFromPercent } from './scoring';
import type { ValidationResult, RuleDefinition } from './types';

const R = (id: string, dim: any, sev: any): ValidationResult => ({
  ruleId: id, dimension: dim, description: id, severity: sev,
  impactsCapag: false, message: 'x',
});

describe('classeFromPercent', () => {
  it('mapeia faixas A–E conforme metodologia STN', () => {
    expect(classeFromPercent(96)).toBe('A');
    expect(classeFromPercent(95)).toBe('B');
    expect(classeFromPercent(86)).toBe('B');
    expect(classeFromPercent(80)).toBe('C');
    expect(classeFromPercent(70)).toBe('D');
    expect(classeFromPercent(64)).toBe('E');
  });
});

describe('buildScoreSummary', () => {
  it('só conta status avaliáveis (OK/FALHA/ATENÇÃO) no ICF', () => {
    const results = [R('D1_00001', 'D1', 'info'), R('D1_00002', 'D1', 'error')];
    const rulesMap = new Map<string, RuleDefinition>([
      ['D1_00001', { ruleId: 'D1_00001', description: 'a', dimension: 'D1', impactsCapag: false }],
      ['D1_00002', { ruleId: 'D1_00002', description: 'b', dimension: 'D1', impactsCapag: false }],
      // regra ausente nos resultados -> NÃO VERIFICÁVEL, fora do denominador
      ['D2_00001', { ruleId: 'D2_00001', description: 'c', dimension: 'D2', impactsCapag: false }],
    ]);
    const s = buildScoreSummary(results, { rulesMap });
    // 1 OK + 1 FALHA = 1/2 avaliáveis -> 50%
    expect(s.pontosAvaliaveis).toBe(2);
    expect(s.pontosObtidos).toBe(1);
    expect(s.percentual).toBe(50);
    expect(s.contagemStatus.NAO_VERIFICAVEL).toBe(1);
    expect(s.classe).toBe('E');
  });

  it('pondera checks mensais: 3 OK + 1 FALHA da mesma regra = 0,75', () => {
    const results = [
      R('D1_00020', 'D1', 'info'), R('D1_00020', 'D1', 'info'),
      R('D1_00020', 'D1', 'info'), R('D1_00020', 'D1', 'error'),
    ];
    const s = buildScoreSummary(results);
    const check = s.checks.find(c => c.ruleId === 'D1_00020')!;
    expect(check.maxPontos).toBe(4);
    expect(check.pontos).toBe(3); // 3×1 + 1×0
    // status representativo do grupo é o pior (FALHA)
    expect(check.status).toBe('FALHA');
  });

  it('marca regras não aplicáveis a municípios', () => {
    const rulesMap = new Map<string, RuleDefinition>([
      ['D1_00005', { ruleId: 'D1_00005', description: 'RGF Judiciário', dimension: 'D1', impactsCapag: false }],
    ]);
    const s = buildScoreSummary([], { rulesMap, naoAplicaveis: new Set(['D1_00005']) });
    expect(s.contagemStatus.NAO_APLICAVEL).toBe(1);
    expect(s.pontosAvaliaveis).toBe(0);
  });
});
