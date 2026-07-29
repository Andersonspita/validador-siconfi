/**
 * Catálogo oficial de verificações do Ranking da Qualidade (STN).
 *
 * Fonte (metodologia e downloads oficiais):
 *   https://ranking-municipios.tesouro.gov.br/metodologia
 *   - descricao_ranking.csv           (descrições + no_aplicavel + CAPAG)
 *   - verificacoes_aplicabilidade.csv (aplicabilidade por exercício)
 *
 * Aplicabilidade (coluna do exercício em verificacoes_aplicabilidade.csv):
 *   T = aplicável a todos os entes;  E = só Estados/DF;  M = só Municípios;
 *   (vazio) = verificação não existia naquele exercício.
 *
 * Para MUNICÍPIO: uma verificação é NÃO APLICÁVEL quando o código do exercício
 * é 'E' (exclusiva de Estados/DF). As marcadas 'M' ou 'T' são aplicáveis.
 */

export type EnteTipo = 'M' | 'E' | 'DF';

/**
 * Verificações NÃO APLICÁVEIS a municípios (código 'E' no exercício 2025).
 * Extraídas de verificacoes_aplicabilidade.csv + descricao_ranking.csv (no_aplicavel = "E/DF").
 */
export const NAO_APLICAVEIS_MUNICIPIO = new Set<string>([
  'D1_00005', 'D1_00010', 'D1_00015', // RGF Judiciário/MP/Defensoria — só Estados/DF
  'D2_00045', 'D2_00047',             // tributos/transferências estaduais na MSCE×DCA
  'D2_00106',                         // FPE (só Estados)
  'D4_00009', 'D4_00011',             // tributos/transferências estaduais DCA×RREO A3
  'D4_00013', 'D4_00015',             // tributos/transferências estaduais DCA×RREO A6 (exerc. anteriores)
  'D4_00021', 'D4_00023',             // tributos/transferências estaduais MSC×RREO A3
  'D4_00037', 'D4_00039',             // tributos/transferências estaduais RREO A6×MSC dez
]);

/**
 * Verificações que compõem a métrica CAPAG (destacadas no quadro oficial).
 * Fonte: coluna `capag` do descricao_ranking.csv.
 */
export const CAPAG_RULES = new Set<string>([
  'D2_00003', 'D2_00004', 'D2_00010', 'D2_00011', 'D2_00012', 'D2_00028', 'D2_00029',
  'D2_00033', 'D2_00035', 'D2_00044', 'D2_00045', 'D2_00046', 'D2_00047', 'D2_00048',
  'D2_00049', 'D2_00084', 'D2_00085', 'D2_00097', 'D2_00099',
  'D3_00005', 'D3_00008', 'D3_00009', 'D3_00010', 'D3_00013', 'D3_00014', 'D3_00015',
  'D3_00016', 'D3_00021', 'D3_00022', 'D3_00023', 'D3_00024', 'D3_00026', 'D3_00028',
  'D3_00030', 'D3_00044', 'D3_00045',
  'D4_00001', 'D4_00002', 'D4_00003', 'D4_00004', 'D4_00010', 'D4_00012', 'D4_00017',
  'D4_00020', 'D4_00021', 'D4_00023', 'D4_00025', 'D4_00028', 'D4_00035', 'D4_00037',
  'D4_00038', 'D4_00039', 'D4_00040', 'D4_00041', 'D4_00042', 'D4_00043', 'D4_00045',
]);

/**
 * Regras de pontuação proporcional (fração por unidade), extraídas das descrições oficiais.
 * A maioria das verificações de MSC pontua por matriz: cada MSC correta vale 1/13
 * (12 meses + encerramento). Exceções valem 1/12 (não contam a de encerramento).
 * As de retificação (D1_00011..15) variam de 0,5 a 1,0 conforme a quantidade.
 */
export interface ProporcaoRegra {
  /** Denominador de matrizes: 13 (mensais + encerramento) ou 12 (só mensais). */
  matrizes?: 13 | 12;
  /** Pontuação mínima quando há ocorrência (ex.: retificações: piso 0,5). */
  pisoComOcorrencia?: number;
}

export const PROPORCAO: Record<string, ProporcaoRegra> = {
  // MSC — cada matriz vale 1/13
  D1_00016: { matrizes: 13 }, D1_00017: { matrizes: 13 }, D1_00018: { matrizes: 13 },
  D1_00019: { matrizes: 13 }, D1_00021: { matrizes: 13 }, D1_00022: { matrizes: 13 },
  D1_00023: { matrizes: 13 }, D1_00024: { matrizes: 13 }, D1_00025: { matrizes: 13 },
  D1_00026: { matrizes: 13 }, D1_00027: { matrizes: 13 }, D1_00028: { matrizes: 13 },
  D1_00029: { matrizes: 13 }, D1_00030: { matrizes: 13 }, D1_00031: { matrizes: 13 },
  D1_00032: { matrizes: 13 }, D1_00033: { matrizes: 13 }, D1_00037: { matrizes: 13 },
  D1_00038: { matrizes: 13 },
  // MSC — 1/12 (não contam a de encerramento)
  D1_00020: { matrizes: 12 }, D1_00035: { matrizes: 12 }, D1_00034: { matrizes: 12 },
  // Retificações — piso 0,5 quando há retificação
  D1_00011: { pisoComOcorrencia: 0.5 }, D1_00012: { pisoComOcorrencia: 0.5 },
  D1_00013: { pisoComOcorrencia: 0.5 }, D1_00014: { pisoComOcorrencia: 0.5 },
  D1_00015: { pisoComOcorrencia: 0.5 },
};

export const DIMENSAO_NOME_OFICIAL: Record<string, string> = {
  D1: 'Gestão da Informação',
  D2: 'Informações Contábeis',
  D3: 'Informações Fiscais',
  D4: 'Informações Contábeis x Informações Fiscais',
};

/** Retorna o conjunto de regras não aplicáveis para o tipo de ente informado. */
export const naoAplicaveisPara = (tipo: EnteTipo): Set<string> =>
  tipo === 'M' ? NAO_APLICAVEIS_MUNICIPIO : new Set<string>();
