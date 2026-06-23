import { getDCAValue, getDCA_VPA_Fundeb, getDCA_VPD_Fundeb, getDCA_DeducoesFundeb, getDCA_ReceitasFundeb, getDCA_EncargosPatronais } from '../xmlExtractors';
import { ParsedData, ValidationResult, RuleDefinition } from '../types';
import { sumAccounts } from './utils';

export function validateD2_MSC(data: ParsedData, _rulesMap: Map<string, RuleDefinition>): ValidationResult[] {
  const results: ValidationResult[] = [];
  const msc = data.msc;
  if (!msc) return [];

  // D2_00055: Amortização acumulada de intangíveis (1248) > valor dos intangíveis (124 excl. 1248)
  const vlIntangiveis = sumAccounts(msc, ['124'], 'ending_balance', 'D', ['1248']);
  const vlAmortizacao = sumAccounts(msc, ['1248'], 'ending_balance', 'C');
  if (vlAmortizacao > vlIntangiveis + 0.01) {
    results.push({
      ruleId: 'D2_00055',
      dimension: 'D2',
      description: 'Amortização acumulada de intangíveis superior ao valor dos intangíveis',
      severity: 'error',
      impactsCapag: false,
      affectedAccounts: ['124', '1248'],
      message: `Amortização acumulada de intangíveis (R$ ${vlAmortizacao.toFixed(2)}) é maior que o valor bruto dos ativos intangíveis (R$ ${vlIntangiveis.toFixed(2)}). A amortização não pode superar o valor do ativo.`,
    });
  }

  // D2_00067: Depreciação acumulada de bens móveis (1238101) > valor dos bens móveis (1231)
  const vlBensMoveis = sumAccounts(msc, ['1231'], 'ending_balance', 'D');
  const vlDeprMoveis = sumAccounts(msc, ['1238101'], 'ending_balance', 'C');
  if (vlDeprMoveis > vlBensMoveis + 0.01) {
    results.push({
      ruleId: 'D2_00067',
      dimension: 'D2',
      description: 'Depreciação de bens móveis superior ao valor dos bens móveis',
      severity: 'error',
      impactsCapag: false,
      affectedAccounts: ['1231', '1238101'],
      message: `Depreciação acumulada de bens móveis (R$ ${vlDeprMoveis.toFixed(2)}) é maior que o valor bruto dos bens móveis (R$ ${vlBensMoveis.toFixed(2)}).`,
    });
  }

  // D2_00068: Depreciação acumulada de bens imóveis (1238102) > valor dos bens imóveis (1232)
  const vlBensImoveis = sumAccounts(msc, ['1232'], 'ending_balance', 'D');
  const vlDeprImoveis = sumAccounts(msc, ['1238102'], 'ending_balance', 'C');
  if (vlDeprImoveis > vlBensImoveis + 0.01) {
    results.push({
      ruleId: 'D2_00068',
      dimension: 'D2',
      description: 'Depreciação de bens imóveis superior ao valor dos bens imóveis',
      severity: 'error',
      impactsCapag: false,
      affectedAccounts: ['1232', '1238102'],
      message: `Depreciação acumulada de bens imóveis (R$ ${vlDeprImoveis.toFixed(2)}) é maior que o valor bruto dos bens imóveis (R$ ${vlBensImoveis.toFixed(2)}).`,
    });
  }

  // D2_00080: Saldo de estoques/almoxarifado (11561) = 0
  const vlEstoques = sumAccounts(msc, ['11561'], 'ending_balance', 'D');
  if (vlEstoques === 0) {
    const temContaEstoque = msc.some(a => a.CONTA.startsWith('11561'));
    if (temContaEstoque) {
      results.push({
        ruleId: 'D2_00080',
        dimension: 'D2',
        description: 'Saldo de estoques/almoxarifado zerado',
        severity: 'warning',
        impactsCapag: false,
        affectedAccounts: ['11561'],
        message: `O saldo final das contas de estoques/almoxarifado (grupo 11561) está zerado. Verifique se o ente possui estoques e se os registros estão corretos.`,
      });
    }
  }

  // D2_00081: Férias e 13º salário sem provisão mensal (211110102 e 211110103)
  const temFeriasProvisao = msc.some(a => a.CONTA === '211110102' && a.Tipo_valor === 'period_change' && a.Valor > 0);
  const tem13Provisao = msc.some(a => a.CONTA === '211110103' && a.Tipo_valor === 'period_change' && a.Valor > 0);
  if (!temFeriasProvisao && !tem13Provisao) {
    const temPessoal = msc.some(a => a.CONTA.startsWith('311') && a.Tipo_valor === 'period_change' && a.Valor > 0);
    if (temPessoal) {
      results.push({
        ruleId: 'D2_00081',
        dimension: 'D2',
        description: 'Férias e 13º salário sem provisão registrada',
        severity: 'warning',
        impactsCapag: false,
        affectedAccounts: ['211110102', '211110103'],
        message: `Há despesas com pessoal (classe 311) registradas, mas sem provisão de férias (211110102) nem de 13º salário (211110103) no período. Verifique o reconhecimento por competência.`,
      });
    }
  }

  // D2_00083: Integridade DDR — saldo final da classe 721 deve igualar saldo final da classe 821
  const vlDDR721 = sumAccounts(msc, ['721'], 'ending_balance', 'D');
  const vlDDR821 = sumAccounts(msc, ['821'], 'ending_balance', 'C');
  if (Math.abs(vlDDR721 - vlDDR821) > 0.01 && (vlDDR721 > 0 || vlDDR821 > 0)) {
    results.push({
      ruleId: 'D2_00083',
      dimension: 'D2',
      description: 'Integridade do DDR (saldo 721 ≠ saldo 821)',
      severity: 'error',
      impactsCapag: false,
      affectedAccounts: ['721', '821'],
      message: `Divergência nas contas de controle do DDR. Saldo final 721: R$ ${vlDDR721.toFixed(2)} | Saldo final 821: R$ ${vlDDR821.toFixed(2)}. Os saldos devem ser iguais.`,
    });
  }

  // D2_00093: Almoxarifado sem movimentação de consumo (period_change nas contas 11561)
  const temMovAlmox = msc.some(a => a.CONTA.startsWith('11561') && a.Tipo_valor === 'period_change' && a.Valor > 0);
  const temSaldoAlmox = msc.some(a => a.CONTA.startsWith('11561') && a.Tipo_valor === 'ending_balance' && a.Valor > 0);
  if (temSaldoAlmox && !temMovAlmox) {
    results.push({
      ruleId: 'D2_00093',
      dimension: 'D2',
      description: 'Almoxarifado sem movimentação de consumo no período',
      severity: 'warning',
      impactsCapag: false,
      affectedAccounts: ['11561'],
      message: `Há saldo nas contas de almoxarifado (11561) mas nenhuma movimentação (consumo) foi registrada no período. Verifique o reconhecimento patrimonial dos estoques.`,
    });
  }

  // D2_00094: Despesas com pessoal RPPS sem contribuição patronal correspondente
  // Conta 311110101 (despesa ativa RPPS) deve ter correspondência em 312120100 (contribuição patronal RPPS)
  const temDespRPPS = msc.some(a => a.CONTA === '311110101' && a.Tipo_valor === 'period_change' && a.Valor > 0);
  const temContribRPPS = msc.some(a => a.CONTA === '312120100' && a.Tipo_valor === 'period_change' && a.Valor > 0);
  if (temDespRPPS && !temContribRPPS) {
    results.push({
      ruleId: 'D2_00094',
      dimension: 'D2',
      description: 'Despesas previdenciárias RPPS sem contribuição patronal',
      severity: 'warning',
      impactsCapag: false,
      affectedAccounts: ['311110101', '312120100'],
      message: `Há despesas com pessoal ativo RPPS (311110101) mas sem registro de contribuição patronal (312120100). Verifique o registro das despesas previdenciárias.`,
    });
  }

  // D2_00054: VPA/VPD com equivalência patrimonial (442xxx/362xxx) sem investimentos permanentes (122xxx)
  const temEquivPatrimonial = msc.some(acc =>
    (acc.CONTA.startsWith('442') || acc.CONTA.startsWith('362')) &&
    acc.Tipo_valor === 'period_change' && acc.Valor > 0
  );
  const temInvestimentosPermanentes = msc.some(acc =>
    acc.CONTA.startsWith('122') && acc.Tipo_valor === 'ending_balance' && acc.Valor > 0
  );
  if (temEquivPatrimonial && !temInvestimentosPermanentes) {
    results.push({
      ruleId: 'D2_00054',
      dimension: 'D2',
      description: 'VPA/VPD de equivalência patrimonial sem investimentos permanentes',
      severity: 'warning',
      impactsCapag: false,
      affectedAccounts: ['442', '362', '122'],
      message: `Há movimentações de VPA (442xxx) ou VPD (362xxx) de resultado de equivalência patrimonial, mas não foram encontrados saldos em contas de Investimentos Permanentes (122xxx). O PIPCP exige que esses investimentos estejam registrados.`,
    });
  }

  // D2_00095: Despesas com pessoal RGPS sem INSS/FGTS correspondente
  // Conta 311210101 (despesa ativa RGPS) deve ter 312210100 (INSS) ou 312230100 (FGTS)
  const temDespRGPS = msc.some(a => a.CONTA === '311210101' && a.Tipo_valor === 'period_change' && a.Valor > 0);
  const temINSS = msc.some(a => a.CONTA === '312210100' && a.Tipo_valor === 'period_change' && a.Valor > 0);
  const temFGTS = msc.some(a => a.CONTA === '312230100' && a.Tipo_valor === 'period_change' && a.Valor > 0);
  if (temDespRGPS && !temINSS && !temFGTS) {
    results.push({
      ruleId: 'D2_00095',
      dimension: 'D2',
      description: 'Despesas previdenciárias RGPS sem INSS/FGTS',
      severity: 'warning',
      impactsCapag: false,
      affectedAccounts: ['311210101', '312210100', '312230100'],
      message: `Há despesas com pessoal ativo RGPS (311210101) mas sem registro de INSS patronal (312210100) nem FGTS (312230100). Verifique o registro das despesas previdenciárias.`,
    });
  }

  // D2_00028: Passivo Circulante Financeiro <= Passivo Circulante
  const vlPCF = msc.filter(a => a.CONTA.startsWith('21') && a.PO === 'F' && a.Tipo_valor === 'ending_balance').reduce((sum, a) => sum + a.Valor, 0);
  const vlPC = sumAccounts(msc, ['21'], 'ending_balance');
  if (vlPCF > vlPC + 0.01) {
    results.push({
      ruleId: 'D2_00028', dimension: 'D2', description: '', severity: 'error', impactsCapag: false,
      message: `O valor do Passivo Circulante Financeiro (R$ ${vlPCF.toFixed(2)}) não pode ser superior ao Passivo Circulante total (R$ ${vlPC.toFixed(2)}).`
    });
  }

  // D2_00030: Saldos negativos em contas de 3º nível (Ativo e Passivo)
  const negativosNivel3AB = msc.filter(a => (a.CONTA.startsWith('1') || a.CONTA.startsWith('2')) && a.CONTA.length >= 3 && a.Tipo_valor === 'ending_balance' && a.Valor < 0);
  if (negativosNivel3AB.length > 0) {
    results.push({
      ruleId: 'D2_00030', dimension: 'D2', description: '', severity: 'error', impactsCapag: false,
      message: `Existem ${negativosNivel3AB.length} conta(s) de Ativo/Passivo de 3º nível com saldo final negativo na MSC. O PCASP não permite saldos com sinal negativo (use a natureza correta).`
    });
  }

  // D2_00031: Saldos negativos em contas de 3º nível (VPA e VPD)
  const negativosNivel3HI = msc.filter(a => (a.CONTA.startsWith('3') || a.CONTA.startsWith('4')) && a.CONTA.length >= 3 && a.Tipo_valor === 'ending_balance' && a.Valor < 0);
  if (negativosNivel3HI.length > 0) {
    results.push({
      ruleId: 'D2_00031', dimension: 'D2', description: '', severity: 'error', impactsCapag: false,
      message: `Existem ${negativosNivel3HI.length} conta(s) de VPA/VPD de 3º nível com saldo final negativo na MSC.`
    });
  }

  // D2_00034: Saldos negativos em contas de 5º nível (VPA e VPD)
  const negativosNivel5HI = msc.filter(a => (a.CONTA.startsWith('3') || a.CONTA.startsWith('4')) && a.CONTA.length >= 5 && a.Tipo_valor === 'ending_balance' && a.Valor < 0);
  if (negativosNivel5HI.length > 0) {
    results.push({
      ruleId: 'D2_00034', dimension: 'D2', description: '', severity: 'error', impactsCapag: false,
      message: `Existem ${negativosNivel5HI.length} conta(s) de 5º nível de VPA/VPD com saldo final negativo na MSC.`
    });
  }

  // D2_00053: Ajustes para perdas de estoques (1158) > saldo de estoques (115 excl. 1158)
  const vlEstoquesBruto = sumAccounts(msc, ['115'], 'ending_balance', 'D', ['1158']);
  const vlPerdasEstoques = sumAccounts(msc, ['1158'], 'ending_balance', 'C');
  if (vlPerdasEstoques > vlEstoquesBruto + 0.01) {
    results.push({
      ruleId: 'D2_00053', dimension: 'D2', description: '', severity: 'error', impactsCapag: false,
      message: `Ajustes para perdas de estoques (R$ ${vlPerdasEstoques.toFixed(2)}) não podem superar o valor bruto dos estoques (R$ ${vlEstoquesBruto.toFixed(2)}).`
    });
  }

  // D2_00059: Ajustes para perdas de créditos (1129, 1219) > valor dos créditos (112, 121 excl. 1129, 1219)
  const vlCreditos = sumAccounts(msc, ['112', '121'], 'ending_balance', 'D', ['1129', '1219']);
  const vlPerdasCreditos = sumAccounts(msc, ['1129', '1219'], 'ending_balance', 'C');
  if (vlPerdasCreditos > vlCreditos + 0.01) {
    results.push({
      ruleId: 'D2_00059', dimension: 'D2', description: '', severity: 'error', impactsCapag: false,
      message: `Ajustes para perdas de créditos a curto/longo prazo (R$ ${vlPerdasCreditos.toFixed(2)}) não podem superar o valor bruto dos créditos (R$ ${vlCreditos.toFixed(2)}).`
    });
  }

  // D2_00060: Ajustes para perdas de demais créditos (1139, 1229) > demais créditos (113, 122 excl. 1139, 1229)
  const vlDemaisCreditos = sumAccounts(msc, ['113', '122'], 'ending_balance', 'D', ['1139', '1229']);
  const vlPerdasDemaisCreditos = sumAccounts(msc, ['1139', '1229'], 'ending_balance', 'C');
  if (vlPerdasDemaisCreditos > vlDemaisCreditos + 0.01) {
    results.push({
      ruleId: 'D2_00060', dimension: 'D2', description: '', severity: 'error', impactsCapag: false,
      message: `Ajustes para perdas de demais créditos (R$ ${vlPerdasDemaisCreditos.toFixed(2)}) não podem superar o valor bruto dos demais créditos (R$ ${vlDemaisCreditos.toFixed(2)}).`
    });
  }

  
  // D2_00044: Igualdade das receitas arrecadadas na MSC e Anexo I-C da DCA
  const vlReceitasMSC = sumAccounts(msc, ['6212'], 'ending_balance', 'C');
  if (data.dca) {
    const vlReceitasDCA = getDCAValue(data.dca, ['DCA-Anexo I-C', 'DCA Anexo I-C'], 'TOTAL DAS RECEITAS|RECEITAS ORÇAMENTÁRIAS', 1);
    if (vlReceitasDCA !== null && Math.abs(vlReceitasMSC - vlReceitasDCA) > 0.01) {
      results.push({
        ruleId: 'D2_00044', dimension: 'D2', description: '', severity: 'error', impactsCapag: false,
        message: `Receitas arrecadadas divergem. MSC (6212): R$ ${vlReceitasMSC.toFixed(2)} | DCA Anexo I-C: R$ ${vlReceitasDCA.toFixed(2)}.`
      });
    }
  }

  // D2_00049: Despesas empenhadas MSC x DCA Anexo I-D
  const vlEmpenhadasMSC = sumAccounts(msc, ['62213'], 'ending_balance', 'C');
  if (data.dca) {
    const vlEmpenhadasDCA = getDCAValue(data.dca, ['DCA-Anexo I-D', 'DCA Anexo I-D'], 'TOTAL DAS DESPESAS', 1);
    if (vlEmpenhadasDCA !== null && Math.abs(vlEmpenhadasMSC - vlEmpenhadasDCA) > 0.01) {
      results.push({
        ruleId: 'D2_00049', dimension: 'D2', description: '', severity: 'error', impactsCapag: false,
        message: `Despesas empenhadas divergem. MSC (62213): R$ ${vlEmpenhadasMSC.toFixed(2)} | DCA Anexo I-D: R$ ${vlEmpenhadasDCA.toFixed(2)}.`
      });
    }
  }

  return results;
}

export function validateD2_DCA(dca: any, _rulesMap: Map<string, RuleDefinition>): ValidationResult[] {
  const results: ValidationResult[] = [];

  // D2_00001: FUNDEB VPA no Anexo I-HI
  const vpaFundeb = getDCA_VPA_Fundeb(dca);
  if (vpaFundeb === null || vpaFundeb === 0) {
    results.push({
      ruleId: 'D2_00001', dimension: 'D2', description: '', severity: 'error', impactsCapag: false,
      message: 'Não há registro de Variação Patrimonial Aumentativa (VPA) do FUNDEB no Anexo I-HI da DCA.'
    });
  }

  // D2_00002: FUNDEB VPD no Anexo I-HI
  const vpdFundeb = getDCA_VPD_Fundeb(dca);
  if (vpdFundeb === null || vpdFundeb === 0) {
    results.push({
      ruleId: 'D2_00002', dimension: 'D2', description: '', severity: 'error', impactsCapag: false,
      message: 'Não há registro de Variação Patrimonial Diminutiva (VPD) do FUNDEB no Anexo I-HI da DCA.'
    });
  }

  // D2_00003: Deduções FUNDEB no Anexo I-C
  const deducoesFundeb = getDCA_DeducoesFundeb(dca);
  if (deducoesFundeb === null || deducoesFundeb === 0) {
    results.push({
      ruleId: 'D2_00003', dimension: 'D2', description: '', severity: 'error', impactsCapag: false,
      message: 'Não há informação de deduções de receitas para formação do FUNDEB no Anexo I-C da DCA.'
    });
  }

  // D2_00004: Receitas FUNDEB no Anexo I-C
  const receitasFundeb = getDCA_ReceitasFundeb(dca);
  if (receitasFundeb === null || receitasFundeb === 0) {
    results.push({
      ruleId: 'D2_00004', dimension: 'D2', description: '', severity: 'error', impactsCapag: false,
      message: 'Não há informação das receitas orçamentárias do FUNDEB no Anexo I-C da DCA.'
    });
  }

  // D2_00005: Encargos patronais no Anexo I-D
  const encargosPatronais = getDCA_EncargosPatronais(dca);
  if (encargosPatronais === null || encargosPatronais === 0) {
    results.push({
      ruleId: 'D2_00005', dimension: 'D2', description: '', severity: 'warning', impactsCapag: false,
      message: 'Não há informação das despesas orçamentárias com encargos patronais no Anexo I-D da DCA.'
    });
  }

  return results;
}
