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
  mscPeriods?: string[];   // períodos detectados nos cabeçalhos CSV (YYYY-MM)
  rreo?: any;
  rgf?: any;
  dca?: any;
}

export interface MSCAccount {
  CONTA: string;
  PO?: string;
  FP?: string;  // atributo superávit financeiro (IC2 quando TIPO2='FP')
  FS?: string;  // função/subfunção (IC2 quando TIPO2='FS', contas 622xxx)
  FR?: string;  // fonte ou destinação de recurso (IC3)
  CO?: string;  // complemento (IC4)
  ND?: string;  // natureza da despesa (IC5 quando TIPO5='ND', contas 622xxx)
  Valor: number;
  Tipo_valor: 'beginning_balance' | 'period_change' | 'ending_balance';
  Natureza_valor: 'D' | 'C';
}
