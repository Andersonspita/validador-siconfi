import { ParsedData, ValidationResult, RuleDefinition } from '../types';
import { sumAccounts, validatePairEquality } from './utils';
import {
  getReceitasCorrentes_A01, getReceitasCapital_A01, getDespesasCorrentes_A01,
  getDespesasCapital_A01, getDespesasEmpenhadas_SubtotalA01, getDespesasLiquidadas_SubtotalA01,
  getDespesasPagas_SubtotalA01, getRPNP_inscricoes_A01, getReceitasArrecadadasRREO
} from '../xmlExtractors';

export function validateD4_Cruzamentos(data: ParsedData, _rulesMap: Map<string, RuleDefinition>): ValidationResult[] {
  const results: ValidationResult[] = [];

  // ── D3_00022-025: MSC dezembro × RREO Anexo 01 ─────────────────────────────
  // Apenas quando há MSC do mês 12 e RREO disponíveis
  const decPeriodKey = data.mscByPeriod
    ? Object.keys(data.mscByPeriod).find(p => p.endsWith('-12')) : undefined;

  if (decPeriodKey && data.rreo && data.mscByPeriod) {
    const decMSC = data.mscByPeriod[decPeriodKey];

    // Receitas correntes MSC = 6212xxx ending_balance onde CO começa com '1' (ou vazio)
    const recCorrMSC = decMSC
      .filter(a => a.CONTA.startsWith('6212') && a.Tipo_valor === 'ending_balance'
                && (!a.CO || a.CO.startsWith('1') || a.CO === '0000'))
      .reduce((s, a) => s + a.Valor, 0);
    // Receitas de capital MSC = 6212xxx onde CO começa com '7'
    const recCapMSC = decMSC
      .filter(a => a.CONTA.startsWith('6212') && a.Tipo_valor === 'ending_balance'
                && a.CO?.startsWith('7'))
      .reduce((s, a) => s + a.Valor, 0);
    // Despesas correntes MSC = 622xxx onde ND começa com '1','2','3' (GND correntes)
    const despCorrMSC = decMSC
      .filter(a => a.CONTA.startsWith('622') && a.Tipo_valor === 'ending_balance'
                && a.ND && /^[123]/.test(a.ND))
      .reduce((s, a) => s + a.Valor, 0);
    // Despesas de capital MSC = 622xxx onde ND começa com '4','5','6' (GND capital)
    const despCapMSC = decMSC
      .filter(a => a.CONTA.startsWith('622') && a.Tipo_valor === 'ending_balance'
                && a.ND && /^[456]/.test(a.ND))
      .reduce((s, a) => s + a.Valor, 0);

    // D3_00022: Receitas Correntes
    results.push(...validatePairEquality('D3_00022','D3',
      { label: `MSC ${decPeriodKey} (6212 CO=1xxx)`, val: recCorrMSC || null },
      { label: 'RREO A01 RECEITAS CORRENTES col[5]', val: getReceitasCorrentes_A01(data.rreo) },
      'Receitas Correntes Orçamentárias divergem entre MSC de dezembro e RREO Anexo 01.',
      true
    ));
    // D3_00023: Receitas de Capital
    results.push(...validatePairEquality('D3_00023','D3',
      { label: `MSC ${decPeriodKey} (6212 CO=7xxx)`, val: recCapMSC || null },
      { label: 'RREO A01 RECEITAS DE CAPITAL col[5]', val: getReceitasCapital_A01(data.rreo) },
      'Receitas de Capital Orçamentárias divergem entre MSC de dezembro e RREO Anexo 01.',
      true
    ));
    // D3_00024: Despesas Correntes (liquidadas)
    results.push(...validatePairEquality('D3_00024','D3',
      { label: `MSC ${decPeriodKey} (622 ND=1-3xxx)`, val: despCorrMSC || null },
      { label: 'RREO A01 DESPESAS CORRENTES col[7]', val: getDespesasCorrentes_A01(data.rreo) },
      'Despesas Correntes Orçamentárias divergem entre MSC de dezembro e RREO Anexo 01.',
      true
    ));
    // D3_00025: Despesas de Capital
    results.push(...validatePairEquality('D3_00025','D3',
      { label: `MSC ${decPeriodKey} (622 ND=4-6xxx)`, val: despCapMSC || null },
      { label: 'RREO A01 DESPESAS DE CAPITAL col[7]', val: getDespesasCapital_A01(data.rreo) },
      'Despesas de Capital Orçamentárias divergem entre MSC de dezembro e RREO Anexo 01.',
      false
    ));

    // D4_00025: Despesas orçamentárias empenhadas/liquidadas/pagas (62213xxx com ND)
    const despEmpMSC = decMSC.filter(a => a.CONTA.startsWith('622') && a.Tipo_valor === 'ending_balance' && a.ND).reduce((s,a)=>s+a.Valor,0);
    const rreoEmp = getDespesasEmpenhadas_SubtotalA01(data.rreo);
    const rreoLiq = getDespesasLiquidadas_SubtotalA01(data.rreo);
    const rreoPag = getDespesasPagas_SubtotalA01(data.rreo);
    if (despEmpMSC && (rreoEmp !== null || rreoLiq !== null || rreoPag !== null)) {
      // Compara com liquidadas (mais confiável que empenhadas ou pagas)
      if (rreoLiq !== null && Math.abs(despEmpMSC - rreoLiq) > 0.01) {
        results.push({
          ruleId: 'D4_00025', dimension: 'D4', description: '', severity: 'error', impactsCapag: true,
          message: `Despesas Orçamentárias Liquidadas divergem. MSC ${decPeriodKey} (622 com ND): R$ ${despEmpMSC.toLocaleString('pt-BR', {minimumFractionDigits:2})} | RREO A01 Liquidadas (col 7): R$ ${rreoLiq.toLocaleString('pt-BR', {minimumFractionDigits:2})}.`,
        });
      }
    }
  }

  // D4_00026: Restos a Pagar Não Processados — MSC dezembro (213xxx) vs RREO Anexo 01 col[10]
  if (data.msc && data.rreo) {
    const rpnpMSC  = sumAccounts(data.msc, ['213'], 'ending_balance', 'C');
    const rpnpRREO = getRPNP_inscricoes_A01(data.rreo);

    if (rpnpRREO === null) {
      results.push({
        ruleId: 'D4_00026', dimension: 'D4', description: '', severity: 'info', impactsCapag: false,
        message: `Não foi possível extrair o valor de RPNP do RREO Anexo 01 para verificação D4_00026.`,
      });
    } else if (Math.abs(rpnpMSC - rpnpRREO) > 0.01) {
      results.push({
        ruleId: 'D4_00026', dimension: 'D4', description: '', severity: 'error', impactsCapag: false,
        message: `Restos a Pagar Não Processados divergem. MSC (213xxx): R$ ${rpnpMSC.toLocaleString('pt-BR', {minimumFractionDigits:2})} | RREO Anexo 01 (col RPNP): R$ ${rpnpRREO.toLocaleString('pt-BR', {minimumFractionDigits:2})}.`,
      });
    }
  }

  // D4_00020: Receitas arrecadadas na MSC (6212) vs Anexo 01 do RREO
  if (data.msc && data.rreo) {
    const receitasMSC  = sumAccounts(data.msc, ['6212'], 'period_change');
    const receitasRREO = getReceitasArrecadadasRREO(data.rreo);

    if (receitasRREO === null) {
      results.push({
        ruleId: 'D4_00020',
        dimension: 'D4',
        description: '',
        severity: 'info',
        impactsCapag: true,
        message: `Não foi possível extrair o total de receitas arrecadadas do RREO Anexo 01. A regra D4_00020 não pôde ser verificada.`,
      });
    } else if (Math.abs(receitasMSC - receitasRREO) > 0.01) {
      results.push({
        ruleId: 'D4_00020',
        dimension: 'D4',
        description: '',
        severity: 'error',
        impactsCapag: true,
        message: `Receitas Arrecadadas divergentes. MSC (6212): R$ ${receitasMSC.toLocaleString('pt-BR', {minimumFractionDigits:2})} | RREO Anexo 01: R$ ${receitasRREO.toLocaleString('pt-BR', {minimumFractionDigits:2})}.`,
      });
    }
  }

  
  // D4_00001: Validação das Despesas Empenhadas RREO Anexo 1 x MSC Contas 62292 (Empenhos a Liquidar, Liquidados e Pagos)
  if (data.msc && data.rreo) {
    const despEmpenhadasMSC = sumAccounts(data.msc, ['62292'], 'period_change', 'C');
    const despEmpenhadasRREO = getDespesasEmpenhadas_SubtotalA01(data.rreo);

    if (despEmpenhadasRREO !== null && Math.abs(despEmpenhadasMSC - despEmpenhadasRREO) > 0.01) {
      results.push({
        ruleId: 'D4_00001',
        dimension: 'D4',
        description: '',
        severity: 'error',
        impactsCapag: true,
        message: `Despesas Empenhadas divergem. MSC (62292): R$ ${despEmpenhadasMSC.toLocaleString('pt-BR', {minimumFractionDigits:2})} | RREO Anexo 01: R$ ${despEmpenhadasRREO.toLocaleString('pt-BR', {minimumFractionDigits:2})}.`,
      });
    }
  }

  // D4_00005: Restos a Pagar RGF x MSC Contas 631 (Restos a Pagar Processados)
  if (data.msc && data.rgf) {
    // Usando RPNP e RPP do MSC para simular o batimento completo (631 e 632)
    const restosAPagarMSC = sumAccounts(data.msc, ['631', '632'], 'ending_balance', 'C');
    // Para simplificar a POC extrairemos direto do helper utils já importado, ou daremos warning se RGF não lido
    results.push({
        ruleId: 'D4_00005',
        dimension: 'D4',
        description: 'Restos a Pagar RGF x MSC',
        severity: 'info',
        impactsCapag: false,
        message: `Batimento Restos a Pagar RGF x MSC. Total MSC (631/632): R$ ${restosAPagarMSC.toLocaleString('pt-BR', {minimumFractionDigits:2})}. Aguardando mapeamento completo das colunas do Anexo 07 RGF para concluir.`,
    });
  }

  return results;
}

