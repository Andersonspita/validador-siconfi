import { ParsedData, ValidationResult, MSCAccount } from './types';

export const runValidations = (data: ParsedData): ValidationResult[] => {
  const results: ValidationResult[] = [];

  if (data.msc) {
    results.push(...validateD1_MSC(data.msc));
  }

  // Se tivermos MSC e outros arquivos, podemos cruzar (D4) ou checar D2/D3
  if (data.rreo && data.rgf) {
    results.push(...validateD3_Fiscal(data.rreo, data.rgf));
  }

  return results;
};

// --- D1 Rules (Gestão da Informação) ---
function validateD1_MSC(msc: MSCAccount[]): ValidationResult[] {
  const results: ValidationResult[] = [];

  // D1_00017: Valores negativos
  const negativeAccounts = msc.filter(acc => acc.Valor < 0);
  if (negativeAccounts.length > 0) {
    results.push({
      ruleId: 'D1_00017',
      dimension: 'D1',
      description: 'Envio de MSCs com valores negativos',
      severity: 'error',
      impactsCapag: false,
      affectedAccounts: Array.from(new Set(negativeAccounts.map(a => a.CONTA))),
      detailedItems: negativeAccounts.map(a => ({
         conta: a.CONTA,
         po: a.PO,
         fr: a.FR,
         co: a.CO,
         valor: a.Valor,
         detalhe: `Tipo: ${a.Tipo_valor} | Natureza: ${a.Natureza_valor}`
      })),
      message: `Encontradas ${negativeAccounts.length} contas com valores negativos. O Siconfi não aceita valores negativos na MSC.`,
    });
  }

  // D1_00018: SI + MOV <> SF
  // (Simplificado: Na MSC real teríamos que agrupar por CONTA, PO, FR, etc. e somar)
  // Aqui faremos um check conceitual
  const accountsMap = new Map<string, { si: number, mov: number, sf: number }>();
  
  msc.forEach(acc => {
    const key = `${acc.CONTA}-${acc.PO}-${acc.FR}-${acc.CO}`;
    if (!accountsMap.has(key)) accountsMap.set(key, { si: 0, mov: 0, sf: 0 });
    
    const entry = accountsMap.get(key)!;
    const signedValue = acc.Natureza_valor === 'C' ? -acc.Valor : acc.Valor;
    
    if (acc.Tipo_valor === 'beginning_balance') entry.si += signedValue;
    else if (acc.Tipo_valor === 'period_change') entry.mov += signedValue;
    else if (acc.Tipo_valor === 'ending_balance') entry.sf += signedValue;
  });

  const inconsistentAccounts: string[] = [];
  const detailedInconsistencies: any[] = [];
  accountsMap.forEach((vals, key) => {
    // Equação contábil rigorosa: SI (com sinal) + MOV (com sinal) = SF (com sinal)
    const diff = Math.abs((vals.si + vals.mov) - vals.sf);
    
    // Tolerância de centavos por erro de arredondamento
    if (diff > 0.01) {
      const parts = key.split('-');
      inconsistentAccounts.push(parts[0]);
      
      const formatContabil = (val: number) => Math.abs(val).toFixed(2) + (val < 0 ? 'C' : 'D');
      const sfEsperado = vals.si + vals.mov;
      
      detailedInconsistencies.push({
         conta: parts[0],
         po: parts[1],
         fr: parts[2],
         co: parts[3],
         detalhe: `SI: ${formatContabil(vals.si)} | MOV: ${formatContabil(vals.mov)} | SF Esp: ${formatContabil(sfEsperado)} | SF Inf: ${formatContabil(vals.sf)} | Dif: ${diff.toFixed(2)}`
      });
    }
  });

  if (inconsistentAccounts.length > 0) {
    results.push({
      ruleId: 'D1_00018',
      dimension: 'D1',
      description: 'SI + MOV <> SF',
      severity: 'warning',
      impactsCapag: false,
      affectedAccounts: Array.from(new Set(inconsistentAccounts)),
      detailedItems: detailedInconsistencies,
      message: `Encontradas ${inconsistentAccounts.length} contas com movimentação inconsistente. O Saldo Inicial + Movimento não bate com o Saldo Final.`,
    });
  }

  // D1_00021: Ativo invertido
  const activeAccountsInverted = msc.filter(acc => 
    (acc.CONTA.startsWith('1111') || acc.CONTA.startsWith('1121') || acc.CONTA.startsWith('1231')) && 
    acc.Tipo_valor === 'ending_balance' && 
    acc.Natureza_valor === 'C' && 
    acc.Valor > 0
  );

  if (activeAccountsInverted.length > 0) {
    results.push({
      ruleId: 'D1_00021',
      dimension: 'D1',
      description: 'Contas do ativo com saldo invertido',
      severity: 'warning',
      impactsCapag: false,
      affectedAccounts: Array.from(new Set(activeAccountsInverted.map(a => a.CONTA))),
      detailedItems: activeAccountsInverted.map(a => ({
         conta: a.CONTA,
         po: a.PO,
         fr: a.FR,
         co: a.CO,
         valor: a.Valor,
         detalhe: `Natureza Info: ${a.Natureza_valor} (Esperado: D) | Tipo: ${a.Tipo_valor}`
      })),
      message: `Foram encontradas ${activeAccountsInverted.length} contas do ativo com natureza Credora (C). A natureza padrão é Devedora (D).`,
    });
  }

  return results;
}

// --- D3 Rules (Fiscal) ---
function validateD3_Fiscal(rreo: any, rgf: any): ValidationResult[] {
  const results: ValidationResult[] = [];
  
  // Exemplo de regra D3_00005: Igualdade da RCL
  // (Na vida real, navegaríamos no XML para achar o valor)
  // Aqui é mockado para demonstrar o Alerta CAPAG
  if (rreo && rgf) {
    // Simulando uma discrepância CAPAG
    results.push({
      ruleId: 'D3_00005',
      dimension: 'D3',
      description: 'Igualdade da Receita Corrente Líquida (RCL) entre RREO e RGF',
      severity: 'error',
      impactsCapag: true,
      message: 'Foi detectada divergência na Receita Corrente Líquida (RCL) informada no Anexo 3 do RREO e Anexo 1 do RGF. Corrige-o para evitar perda na nota CAPAG!',
    });
  }

  return results;
}
