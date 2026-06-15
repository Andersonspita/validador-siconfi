import { ParsedData, ValidationResult, MSCAccount, RuleDefinition } from './types';
import { getRCLFromRREO, getRCLFromRGF, getReceitasArrecadadasRREO_Anexo1 } from './xmlExtractors';

export const runValidations = (data: ParsedData, rulesMap: Map<string, RuleDefinition>): ValidationResult[] => {
  const results: ValidationResult[] = [];

  if (data.msc) {
    results.push(...validateD1_MSC(data.msc, rulesMap));
    results.push(...validateMSC_CAPAG(data.msc, rulesMap));
  }

  // Se tivermos MSC e outros arquivos, podemos cruzar (D4)
  if (data.msc && data.rreo) {
    results.push(...validateD4_Cruzamentos(data, rulesMap));
  }

  // Checar RREO vs RGF (D3)
  if (data.rreo && data.rgf) {
    results.push(...validateD3_Fiscal(data.rreo, data.rgf, rulesMap));
  }

  // Populate dynamic metadata
  return results.map(res => {
    const ruleDef = rulesMap.get(res.ruleId);
    if (ruleDef) {
      res.description = ruleDef.description;
      res.impactsCapag = ruleDef.impactsCapag;
      res.dimension = ruleDef.dimension;
    }
    return res;
  });
};

// --- D1 Rules (Gestão da Informação) ---
function validateD1_MSC(msc: MSCAccount[], rulesMap: Map<string, RuleDefinition>): ValidationResult[] {
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
function validateD3_Fiscal(rreo: any, rgf: any, rulesMap: Map<string, RuleDefinition>): ValidationResult[] {
  const results: ValidationResult[] = [];
  
  // D3_00005: Igualdade da RCL entre RREO e RGF
  if (rreo && rgf) {
    const rclRREO = getRCLFromRREO(rreo);
    const rclRGF = getRCLFromRGF(rgf);

    if (Math.abs(rclRREO - rclRGF) > 0.01) {
      results.push({
        ruleId: 'D3_00005',
        dimension: 'D3',
        description: '', // populated dynamically
        severity: 'error',
        impactsCapag: true,
        message: `Divergência na Receita Corrente Líquida (RCL). RREO: R$ ${rclRREO.toFixed(2)} | RGF: R$ ${rclRGF.toFixed(2)}.`,
      });
    }
  }

  return results;
}

// --- D4 Rules (Cruzamentos Diversos) ---
function validateD4_Cruzamentos(data: ParsedData, rulesMap: Map<string, RuleDefinition>): ValidationResult[] {
  const results: ValidationResult[] = [];

  // D4_00020: Igualdade nas receitas arrecadadas na MSC de dezembro e no Anexo 01 do RREO 6ºB
  if (data.msc && data.rreo) {
    let receitasMSC = 0;
    
    data.msc.forEach(acc => {
      // Receitas arrecadadas (Classe 6, tipicamente 6212 ou contas de receita com natureza credora)
      if (acc.CONTA.startsWith('6212') && acc.Tipo_valor === 'period_change') {
        receitasMSC += acc.Valor;
      }
    });

    const receitasRREO = getReceitasArrecadadasRREO_Anexo1(data.rreo);

    // Como é PoC, o valor da MSC provavelmente não vai bater com o mock do RREO
    if (Math.abs(receitasMSC - receitasRREO) > 0.01) {
      results.push({
        ruleId: 'D4_00020',
        dimension: 'D4',
        description: '', // populated dynamically
        severity: 'error',
        impactsCapag: true,
        message: `Receitas Arrecadadas divergentes. MSC: R$ ${receitasMSC.toFixed(2)} | RREO: R$ ${receitasRREO.toFixed(2)}.`,
      });
    }
  }

  return results;
}

// --- MSC CAPAG Rules ---
function validateMSC_CAPAG(msc: MSCAccount[], rulesMap: Map<string, RuleDefinition>): ValidationResult[] {
  const results: ValidationResult[] = [];

  // D3_00021: Somatório do passivo circulante e passivo não circulante (financeiros) >= Restos a Pagar (Executivo + RPPS)
  // Lógica Aproximada (PCASP): 
  // Passivo Financeiro = Contas Classe 2 (21 e 22) com atributo F (Superávit Financeiro).
  // Restos a Pagar = Contas 2131 (RPNP) e 2121/2122 (RPP) ou saldo das contas de controle.
  
  let passivoFinanceiro = 0;
  let restosAPagar = 0;

  msc.forEach(acc => {
    // Na MSC, o saldo final de contas do passivo tem natureza credora (C)
    if (acc.Tipo_valor === 'ending_balance') {
      const valor = acc.Natureza_valor === 'C' ? acc.Valor : -acc.Valor;
      
      // Simplificação do Passivo Financeiro (geralmente detalhado por fonte com atributo F)
      // Aqui vamos apenas usar as contas 21 e 22 de forma abrangente para o mock.
      if (acc.CONTA.startsWith('21') || acc.CONTA.startsWith('22')) {
        passivoFinanceiro += valor;
      }

      // Restos a Pagar (Contas 213 para Não Processados e subcontas de RPP)
      if (acc.CONTA.startsWith('213') || acc.CONTA.startsWith('212')) {
         restosAPagar += valor;
      }
    }
  });

  if (passivoFinanceiro < restosAPagar) {
    results.push({
      ruleId: 'D3_00021',
      dimension: 'D3',
      description: '', // Preenchido dinamicamente via rulesMap
      severity: 'error',
      impactsCapag: true, // Será sobreposto pelo metadado
      message: `O somatório do Passivo Financeiro (R$ ${passivoFinanceiro.toFixed(2)}) é menor que os Restos a Pagar (R$ ${restosAPagar.toFixed(2)}).`,
      affectedAccounts: ['21', '22']
    });
  }

  return results;
}
