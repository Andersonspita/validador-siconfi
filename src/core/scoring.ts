import { ValidationResult, RuleDefinition } from './types';

/**
 * Modelo de pontuação e ranking do "Verificador Siconfi" (metodologia
 * simplificada do Ranking da Qualidade da Informação Contábil e Fiscal — STN).
 *
 * Reconstruído a partir dos PDFs de referência (Contendas do Sincorá 2026):
 *  - 5 status por verificação: OK, FALHA, ATENÇÃO, NÃO VERIFICÁVEL, NÃO APLICÁVEL.
 *  - Só entram no cálculo os status "avaliáveis" (OK/FALHA/ATENÇÃO). NÃO
 *    VERIFICÁVEL e NÃO APLICÁVEL ficam fora do denominador.
 *  - Cada verificação avaliável vale 1,00 ponto; checks mensais de MSC podem
 *    pontuar proporcionalmente (ex.: 0,75 = 3 de 4 meses corretos).
 *  - ICF = pontos obtidos / pontos avaliáveis. Faixas: A > 95%, E < 65%,
 *    B/C/D em degraus de 10 p.p. (B 85–95, C 75–85, D 65–75).
 */

export type CheckStatus = 'OK' | 'FALHA' | 'ATENCAO' | 'NAO_VERIFICAVEL' | 'NAO_APLICAVEL';

export type Classe = 'A' | 'B' | 'C' | 'D' | 'E';

export interface ScoredCheck {
  ruleId: string;
  dimension: 'D1' | 'D2' | 'D3' | 'D4';
  dimensionLabel: string;
  descricao: string;
  status: CheckStatus;
  /** Pontos obtidos (0..maxPontos). Só significativo para status avaliáveis. */
  pontos: number;
  /** Pontos máximos da verificação (normalmente 1; pode variar em checks mensais). */
  maxPontos: number;
  avaliavel: boolean;
  detalhe: string;
  actionPlan?: string;
  impactsCapag: boolean;
}

export interface DimensionScore {
  dimension: 'D1' | 'D2' | 'D3' | 'D4';
  label: string;
  obtidos: number;
  avaliaveis: number;
  percentual: number; // 0..100
}

export interface ScoreSummary {
  classe: Classe;
  percentual: number;         // 0..100 (ICF)
  pontosObtidos: number;
  pontosAvaliaveis: number;
  porDimensao: DimensionScore[];
  contagemStatus: Record<CheckStatus, number>;
  totalVerificacoes: number;
  checks: ScoredCheck[];
}

const DIMENSION_LABELS: Record<string, string> = {
  D1: 'Gestão da Informação',
  D2: 'Contábil',
  D3: 'Fiscal',
  D4: 'Contábil x Fiscal',
};

export const STATUS_LABELS: Record<CheckStatus, string> = {
  OK: 'OK',
  FALHA: 'FALHA',
  ATENCAO: 'ATENÇÃO',
  NAO_VERIFICAVEL: 'NÃO VERIFICÁVEL',
  NAO_APLICAVEL: 'NÃO APLICÁVEL',
};

// Cores alinhadas ao visual dos PDFs de referência.
export const STATUS_COLORS: Record<CheckStatus, string> = {
  OK: '#1f8a4c',
  FALHA: '#c0392b',
  ATENCAO: '#c98a00',
  NAO_VERIFICAVEL: '#7a7a7a',
  NAO_APLICAVEL: '#9aa0a6',
};

export const CLASSE_COLORS: Record<Classe, string> = {
  A: '#1f8a4c',
  B: '#4caf50',
  C: '#c98a00',
  D: '#e67e22',
  E: '#c0392b',
};

/** Mapeia a severidade interna do motor para o status do ranking. */
const severityToStatus = (r: ValidationResult): CheckStatus => {
  switch (r.severity) {
    case 'error':
      return 'FALHA';
    case 'warning':
      return 'ATENCAO';
    case 'info':
    default:
      return 'OK';
  }
};

const AVALIAVEIS: CheckStatus[] = ['OK', 'FALHA', 'ATENCAO'];
export const isAvaliavel = (s: CheckStatus): boolean => AVALIAVEIS.includes(s);

/**
 * Deriva a faixa/classe a partir do percentual do ICF.
 * A > 95 ; B 85–95 ; C 75–85 ; D 65–75 ; E < 65.
 */
export const classeFromPercent = (pct: number): Classe => {
  if (pct > 95) return 'A';
  if (pct >= 85) return 'B';
  if (pct >= 75) return 'C';
  if (pct >= 65) return 'D';
  return 'E';
};

/**
 * Extrai os pontos de uma verificação avaliada mês a mês. Quando a mesma regra
 * aparece em vários períodos (ex.: MSC 2026-01..05), o ranking pondera pela
 * fração de meses corretos. Aqui, na ausência de um campo de pontos explícito
 * no ValidationResult, tratamos cada resultado como 1 ponto (0 se FALHA), e o
 * agrupamento por ruleId (abaixo) faz a média — reproduzindo o 0,75 do PDF.
 */
const pontosDoResultado = (status: CheckStatus): number => {
  if (status === 'OK') return 1;
  if (status === 'ATENCAO') return 0.5;
  return 0; // FALHA
};

export interface BuildScoreOptions {
  /**
   * Conjunto de regras conhecidas (rulesMap). Regras presentes no catálogo mas
   * ausentes nos resultados entram como NÃO VERIFICÁVEL — reproduzindo a
   * cobertura parcial dos PDFs (66 de 207 avaliáveis).
   */
  rulesMap?: Map<string, RuleDefinition>;
  /** Regras não aplicáveis a municípios (marcadas NÃO APLICÁVEL). */
  naoAplicaveis?: Set<string>;
}

/**
 * Constroi o resumo de pontuacao a partir dos resultados do motor.
 * Agrupa múltiplos resultados da mesma regra (meses diferentes) numa única
 * verificação com pontuação proporcional.
 */
export const buildScoreSummary = (
  results: ValidationResult[],
  opts: BuildScoreOptions = {}
): ScoreSummary => {
  const { rulesMap, naoAplicaveis } = opts;

  // 1. Agrupa resultados por ruleId, somando pontos/máximos entre períodos.
  interface Acc {
    ruleId: string;
    dimension: 'D1' | 'D2' | 'D3' | 'D4';
    descricao: string;
    somaPontos: number;
    somaMax: number;
    piorStatus: CheckStatus;
    detalhes: string[];
    actionPlan?: string;
    impactsCapag: boolean;
  }

  // ordem de severidade para escolher o status "representativo" do grupo
  const rank: Record<CheckStatus, number> = {
    FALHA: 0, ATENCAO: 1, OK: 2, NAO_VERIFICAVEL: 3, NAO_APLICAVEL: 4,
  };

  const grupos = new Map<string, Acc>();

  for (const r of results) {
    const status = severityToStatus(r);
    const g = grupos.get(r.ruleId);
    const pts = pontosDoResultado(status);
    if (!g) {
      grupos.set(r.ruleId, {
        ruleId: r.ruleId,
        dimension: r.dimension,
        descricao: r.description || rulesMap?.get(r.ruleId)?.description || r.message.slice(0, 80),
        somaPontos: pts,
        somaMax: 1,
        piorStatus: status,
        detalhes: [r.message],
        actionPlan: r.actionPlan,
        impactsCapag: r.impactsCapag,
      });
    } else {
      g.somaPontos += pts;
      g.somaMax += 1;
      if (rank[status] < rank[g.piorStatus]) {
        g.piorStatus = status;
        g.actionPlan = r.actionPlan ?? g.actionPlan;
      }
      if (g.detalhes.length < 6) g.detalhes.push(r.message);
    }
  }

  // 2. Converte grupos em ScoredCheck avaliáveis.
  const checks: ScoredCheck[] = [];
  for (const g of grupos.values()) {
    checks.push({
      ruleId: g.ruleId,
      dimension: g.dimension,
      dimensionLabel: DIMENSION_LABELS[g.dimension] ?? g.dimension,
      descricao: g.descricao,
      status: g.piorStatus,
      pontos: g.somaPontos,
      maxPontos: g.somaMax,
      avaliavel: isAvaliavel(g.piorStatus),
      detalhe: g.detalhes.join(' | '),
      actionPlan: g.actionPlan,
      impactsCapag: g.impactsCapag,
    });
  }

  // 3. Regras do catálogo ausentes nos resultados -> NÃO VERIFICÁVEL / NÃO APLICÁVEL.
  if (rulesMap) {
    for (const [ruleId, def] of rulesMap) {
      if (grupos.has(ruleId)) continue;
      const naoAplic = naoAplicaveis?.has(ruleId);
      checks.push({
        ruleId,
        dimension: def.dimension,
        dimensionLabel: DIMENSION_LABELS[def.dimension] ?? def.dimension,
        descricao: def.description || ruleId,
        status: naoAplic ? 'NAO_APLICAVEL' : 'NAO_VERIFICAVEL',
        pontos: 0,
        maxPontos: 1,
        avaliavel: false,
        detalhe: naoAplic
          ? 'Não aplicável a municípios (apenas Estados/DF)'
          : 'Dados ausentes na pasta / não fornecidos pela API',
        impactsCapag: def.impactsCapag,
      });
    }
  }

  // 4. Contagem por status.
  const contagemStatus: Record<CheckStatus, number> = {
    OK: 0, FALHA: 0, ATENCAO: 0, NAO_VERIFICAVEL: 0, NAO_APLICAVEL: 0,
  };
  for (const c of checks) contagemStatus[c.status]++;

  // 5. Pontuação por dimensão (só avaliáveis entram no denominador).
  const dims: ('D1' | 'D2' | 'D3' | 'D4')[] = ['D1', 'D2', 'D3', 'D4'];
  const porDimensao: DimensionScore[] = dims.map(d => {
    const avaliaveisDim = checks.filter(c => c.dimension === d && c.avaliavel);
    const obtidos = avaliaveisDim.reduce((s, c) => s + c.pontos, 0);
    const avaliaveis = avaliaveisDim.reduce((s, c) => s + c.maxPontos, 0);
    return {
      dimension: d,
      label: DIMENSION_LABELS[d],
      obtidos,
      avaliaveis,
      percentual: avaliaveis > 0 ? (obtidos / avaliaveis) * 100 : 0,
    };
  }).filter(d => d.avaliaveis > 0);

  // 6. Totais e ICF.
  const pontosObtidos = porDimensao.reduce((s, d) => s + d.obtidos, 0);
  const pontosAvaliaveis = porDimensao.reduce((s, d) => s + d.avaliaveis, 0);
  const percentual = pontosAvaliaveis > 0 ? (pontosObtidos / pontosAvaliaveis) * 100 : 0;

  return {
    classe: classeFromPercent(percentual),
    percentual,
    pontosObtidos,
    pontosAvaliaveis,
    porDimensao,
    contagemStatus,
    totalVerificacoes: checks.length,
    checks,
  };
};
