export interface DetailedItem {
  conta: string;
  po?: string;
  fr?: string;
  co?: string;
  detalhe?: string;
  valor?: number;
}

/** Lançamento contábil PCASP sugerido para correção de uma inconsistência. */
export interface SuggestedEntry {
  /** Descrição do lançamento em linguagem contábil clara. */
  descricao: string;
  /** Conta devedora (D) no PCASP. */
  debito: { conta: string; descricao: string };
  /** Conta credora (C) no PCASP. */
  credito: { conta: string; descricao: string };
  /** Valor sugerido quando calculável automaticamente. */
  valor?: number;
  /** Observação — limitações, variações possíveis, referência normativa. */
  obs?: string;
}

export interface RuleDefinition {
  ruleId: string;
  description: string;
  dimension: 'D1' | 'D2' | 'D3' | 'D4';
  impactsCapag: boolean;
  aplicavel?: string;
  finalidade?: string;
}

export interface ValidationResult {
  ruleId: string;
  dimension: 'D1' | 'D2' | 'D3' | 'D4';
  description: string;
  severity: 'error' | 'warning' | 'info';
  impactsCapag: boolean;
  affectedAccounts?: string[];
  detailedItems?: DetailedItem[];
  message: string;
  actionPlan?: string;
  /** Lançamentos PCASP sugeridos para corrigir a inconsistência detectada. */
  suggestedEntries?: SuggestedEntry[];
  /**
   * Dados de diagnóstico para depuração (ex.: payload bruto retornado por uma
   * API externa). Usado hoje pelo D1_00001 para expor a resposta da API de
   * homologação do Siconfi na UI, sem precisar abrir o DevTools.
   */
  debugInfo?: {
    label: string;
    payload: unknown;
  };
}

export interface XLSReport {
  [sheetName: string]: any[][];
}

export interface ParsedData {
  enteId?: string;
  anoReferencia?: string;
  msc?: MSCAccount[];
  mscPeriods?: string[];
  mscByPeriod?: Record<string, MSCAccount[]>;
  rreo?: any;
  rgf?: any;
  dca?: any;
}

export interface MSCAccount {
  CONTA: string;
  PO?: string;
  FP?: string;
  FS?: string;
  FR?: string;
  CO?: string;
  ND?: string;
  Valor: number;
  Tipo_valor: 'beginning_balance' | 'period_change' | 'ending_balance';
  Natureza_valor: 'D' | 'C';
}
