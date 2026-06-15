export interface DetailedItem {
  conta: string;
  po?: string;
  fr?: string;
  co?: string;
  detalhe?: string;
  valor?: number;
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
}

export interface XLSReport {
  [sheetName: string]: any[][];
}

export interface ParsedData {
  msc?: MSCAccount[];
  rreo?: any; // XML ou XLSReport
  rgf?: any;
  dca?: any;
}

export interface MSCAccount {
  CONTA: string;
  PO?: string;
  FP?: string;
  FR?: string;
  CO?: string;
  Valor: number;
  Tipo_valor: 'beginning_balance' | 'period_change' | 'ending_balance';
  Natureza_valor: 'D' | 'C';
}
