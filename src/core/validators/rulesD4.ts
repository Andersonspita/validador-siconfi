import { ParsedData, ValidationResult, RuleDefinition } from '../types';
import { sumAccounts, validatePairEquality } from './utils';
import {
  getReceitasCorrentes_A01, getReceitasCapital_A01, getDespesasCorrentes_A01,
  getDespesasCapital_A01, getDespesasEmpenhadas_SubtotalA01, getDespesasLiquidadas_SubtotalA01,
  getDespesasPagas_SubtotalA01, getRPNP_inscricoes_A01, getReceitasArrecadadasRREO,
  getDespesasPrevSocial_A02, getDespesasSaude_A02, getDespesasEducacao_A02,
  getDespesasExcetoIntra_A02_Empenhadas, getDespesasExcetoIntra_A02_Liquidadas, getDespesasIntra_A02_Empenhadas,
  getTributosMunicipais_A03, getTransferenciasMunicipais_A03,
  getDCA_ReceitasAlienacao, getDCA_TransferenciasMunicipais,
  getDCA_ContribuicoesServidores, getDCA_DespesasCapital, getReceitasAlienacao_A11,
  getTributosMunicipais_A06, getTransferenciasMunicipais_A06,
  getContribuicoesServidores_A03, getDespesasCapital_A09, getDCA_DespesasTotais,
  getDCA_ReceitasTributarias, getTotalRPPagos_A07,
  getDCA_CaixaEquivalentes, getDisponibilidadeCaixaBruta_A02_RGF,
  getDisponibilidadeCaixaBruta_A05_RGF, getConsorciosPublicos_A05_RGF,
  getDCA_ReceitaRealizadaTotal_IC, getTotalReceitas_A01, getDCA_DespesaFuncaoExcetoIntra_IE,
  getDCA_RP_Pagos_IF, getDCA_RPNP_Pagos_IG, getTotalRPPagos_A07_RPP, getTotalRPPagos_A07_RPNP,
  getDCA_PassivoFinanceiro, getTotalRPInscritos_A07, getTotalRPInscritos31Dez_A07, getTotalRPSaldo_A07,
  getRGF_PisoEnfermagem, getRecursosExtraorcamentarios_A07_RGF
} from '../xmlExtractors';

export function validateD4_Cruzamentos(data: ParsedData, _rulesMap: Map<string, RuleDefinition>): ValidationResult[] {
  const results: ValidationResult[] = [];

  // D4_00045: Recursos Extraorçamentários (MSC vs RGF Anexo 07)
  // Contas começadas por 1113, FRs 860, 861, 862, 869, do executivo (PO 2).
  if (data.mscByPeriod && data.rgf) {
    const encPeriodKey = Object.keys(data.mscByPeriod).find(p => p.endsWith('-12') || p.endsWith('-13') || p.endsWith('-00'));
    if (encPeriodKey) {
      const mscDec = data.mscByPeriod[encPeriodKey];
      const mscRecursos = mscDec
        .filter(a => a.CONTA.startsWith('1113') &&
                     ['860', '861', '862', '869'].includes(a.FR || '') &&
                     (a.PO || '').startsWith('2') &&
                     a.Tipo_valor === 'ending_balance')
        .reduce((sum, a) => sum + Math.abs(a.Valor), 0);
      
      const rgfRecursos = getRecursosExtraorcamentarios_A07_RGF(data.rgf);
      if (rgfRecursos !== null && rgfRecursos < mscRecursos - 0.01) {
        results.push({
          ruleId: 'D4_00045', dimension: 'D4', description: 'Relação entre restituíveis (MSC) e Recursos Extraorçamentários (RGF)', severity: 'error', impactsCapag: true,
          message: `O valor de Recursos Extraorçamentários no RGF (R$ ${rgfRecursos.toFixed(2)}) é menor que o valor apurado de restituíveis na MSC (R$ ${mscRecursos.toFixed(2)}).`
        });
      }
    }
  }

  // D3_00029: Piso da Enfermagem (RGF Anexo 1 vs MSC)
  // Requerido que a parcela dedutível do RGF seja <= 90% do repasse da União na MSC
  if (data.mscByPeriod && data.rgf) {
    const encPeriodKey = Object.keys(data.mscByPeriod).find(p => {
      const m = parseInt(p.split('-')[1] || '0');
      return m > 12 || m === 0; // Tenta achar encerramento
    }) || Object.keys(data.mscByPeriod).find(p => p.endsWith('-12')); // Fallback para Dezembro

    if (encPeriodKey) {
      const mscDec = data.mscByPeriod[encPeriodKey];
      const rgfPiso = getRGF_PisoEnfermagem(data.rgf) || 0;
      
      const mscEnfRepasses = mscDec
        .filter(a => ['6221303', '6221304', '6221305', '6221306', '6221307'].some(c => a.CONTA.startsWith(c))
                  && ['2', '3', '4', '8'].some(p => (a.PO || '').startsWith(p))
                  && a.FR === '605'
                  && a.Tipo_valor === 'ending_balance')
        .reduce((sum, a) => sum + Math.abs(a.Valor), 0);

      // A regra diz: Parcela dedutível <= 90% do somatório MSC.
      if (rgfPiso > mscEnfRepasses * 0.90 + 0.01) {
        results.push({
          ruleId: 'D3_00029', dimension: 'D3', description: 'Piso da Enfermagem vs Repasse União', severity: 'error', impactsCapag: true,
          message: `O valor deduzido para piso da enfermagem no RGF Anexo 1 (R$ ${rgfPiso.toFixed(2)}) é maior que o limite de 90% dos repasses da União mapeados na MSC agregada (R$ ${(mscEnfRepasses * 0.90).toFixed(2)}).`
        });
      }
    }
  }

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
    // D4_00029 a D4_00034: Cruzamentos de Despesas por Função (MSC de dezembro vs RREO Anexo 02)
    // A regra foca no grupo 62213 (Crédito Empenhado).
    // A modalidade de aplicação 91 (intraorçamentária) fica no 3º e 4º dígito de ND (quando tem 6) ou 5º e 6º (quando tem 8).
    // Para simplificar, verificaremos o atributo 'ND'. No PCASP, '91' na modalidade é intra.
    const isIntra = (nd?: string) => {
      if (!nd || nd.length < 4) return false;
      // Geralmente GND+Mod = 3390... então a modalidade é o 3º e 4º caractere de uma ND de 6 dígitos.
      // Se tiver 8 dígitos (incluindo desdobramentos), a modalidade ainda é os caracteres 2 e 3 (0-indexed).
      return nd.substring(2, 4) === '91';
    };

    let mscIntra = 0, mscPrev = 0, mscSaude = 0, mscEducacao = 0, mscDemais = 0;
    
    decMSC.forEach(a => {
      if (a.CONTA.startsWith('62213') && a.Tipo_valor === 'ending_balance') {
        if (isIntra(a.ND)) {
          mscIntra += a.Valor;
        } else {
          if (a.FS?.startsWith('09')) mscPrev += a.Valor;
          else if (a.FS?.startsWith('10')) mscSaude += a.Valor;
          else if (a.FS?.startsWith('12')) mscEducacao += a.Valor;
          else mscDemais += a.Valor;
        }
      }
    });

    results.push(...validatePairEquality('D4_00029', 'D4',
      { label: `MSC Dezembro Função 09 (Previdência)`, val: mscPrev || null },
      { label: `RREO A02 Previdência (Empenhadas)`, val: getDespesasPrevSocial_A02(data.rreo) },
      'Despesas com Previdência Social divergem entre MSC e RREO Anexo 02.', false
    ));

    results.push(...validatePairEquality('D4_00030', 'D4',
      { label: `MSC Dezembro Função 10 (Saúde)`, val: mscSaude || null },
      { label: `RREO A02 Saúde (Empenhadas)`, val: getDespesasSaude_A02(data.rreo) },
      'Despesas com Saúde divergem entre MSC e RREO Anexo 02.', false
    ));

    results.push(...validatePairEquality('D4_00031', 'D4',
      { label: `MSC Dezembro Função 12 (Educação)`, val: mscEducacao || null },
      { label: `RREO A02 Educação (Empenhadas)`, val: getDespesasEducacao_A02(data.rreo) },
      'Despesas com Educação divergem entre MSC e RREO Anexo 02.', false
    ));

    const rreoExcetoIntraTotal = getDespesasExcetoIntra_A02_Empenhadas(data.rreo);
    const rreoDemais = rreoExcetoIntraTotal !== null
      ? rreoExcetoIntraTotal - (getDespesasPrevSocial_A02(data.rreo) || 0) - (getDespesasSaude_A02(data.rreo) || 0) - (getDespesasEducacao_A02(data.rreo) || 0)
      : null;

    results.push(...validatePairEquality('D4_00032', 'D4',
      { label: `MSC Dezembro Demais Funções`, val: mscDemais || null },
      { label: `RREO A02 Demais Funções (Estimado)`, val: rreoDemais },
      'Despesas com Demais Funções divergem entre MSC e RREO Anexo 02.', false
    ));

    results.push(...validatePairEquality('D4_00033', 'D4',
      { label: `MSC Dezembro Intraorçamentárias (Mod 91)`, val: mscIntra || null },
      { label: `RREO A02 Intraorçamentárias (Empenhadas)`, val: getDespesasIntra_A02_Empenhadas(data.rreo) },
      'Despesas Intraorçamentárias divergem entre MSC e RREO Anexo 02.', false
    ));

    // D4_00023 e D4_00025: Receitas de Tributos e Transferências Municipais (MSC de dezembro vs RREO Anexo 03)
    // Tributos Municipais (Impostos, Taxas e Contribuições de Melhoria) = Natureza da Receita iniciando em '11'
    let mscTributosMunicipais = 0;
    // Transferências Municipais Constitucionais (FPM, ICMS, IPVA, ITR, FUNDEB) = Natureza iniciando nas categorias de transf
    let mscTransfMunicipais = 0;

    decMSC.forEach(a => {
      // Considera apenas as contas de receita arrecadada (6212, 62132, 62139) e Saldo Final
      if ((a.CONTA.startsWith('6212') || a.CONTA.startsWith('62132') || a.CONTA.startsWith('62139')) && a.Tipo_valor === 'ending_balance') {
        const nr = (a.CO ?? '').trim();
        // '11' corresponde a Impostos, Taxas e Contribuições de Melhoria (natureza da receita — CO, não D/C)
        if (nr.startsWith('11')) {
          mscTributosMunicipais += a.Valor;
        }
        // Transferências Municipais
        else if (
          nr.startsWith('171801') || // FPM
          nr.startsWith('171806') || // ITR
          nr.startsWith('172801') || // ICMS / IPVA
          nr.startsWith('175')       // FUNDEB
        ) {
          mscTransfMunicipais += a.Valor;
        }
      }
    });

    results.push(...validatePairEquality('D4_00022', 'D4',
      { label: `MSC Dezembro Tributos Municipais`, val: mscTributosMunicipais || null },
      { label: `RREO A03 Tributos Municipais`, val: getTributosMunicipais_A03(data.rreo) },
      'Receitas de Tributos Municipais divergem entre MSC e RREO Anexo 03.', false
    ));
    results.push(...validatePairEquality('D4_00023', 'D4',
      { label: `MSC Dezembro Tributos Municipais`, val: mscTributosMunicipais || null },
      { label: `RREO A03 Tributos Municipais`, val: getTributosMunicipais_A03(data.rreo) },
      'Receitas de Tributos Municipais divergem entre MSC e RREO Anexo 03.', false
    ));

    results.push(...validatePairEquality('D4_00024', 'D4',
      { label: `MSC Dezembro Transf. Municipais (Constitucionais)`, val: mscTransfMunicipais || null },
      { label: `RREO A03 Transf. Constitucionais Municipais`, val: getTransferenciasMunicipais_A03(data.rreo) },
      'Receitas de Transferências Constitucionais Municipais divergem entre MSC e RREO Anexo 03.', false
    ));
    results.push(...validatePairEquality('D4_00025', 'D4',
      { label: `MSC Dezembro Transf. Municipais (Constitucionais)`, val: mscTransfMunicipais || null },
      { label: `RREO A03 Transf. Constitucionais Municipais`, val: getTransferenciasMunicipais_A03(data.rreo) },
      'Receitas de Transferências Constitucionais Municipais divergem entre MSC e RREO Anexo 03.', false
    ));

    // D4_00021: Receitas arrecadadas MSC Dez vs RREO A01 (contas 6212 e 6213)
    let mscReceitasArrecadadas = 0;
    decMSC.forEach(a => {
      if ((a.CONTA.startsWith('6212') || a.CONTA.startsWith('6213')) && a.Tipo_valor === 'ending_balance' && a.Natureza_valor) {
        mscReceitasArrecadadas += a.Valor;
      }
    });
    results.push(...validatePairEquality('D4_00021', 'D4',
      { label: `MSC Dezembro (6212 e 6213)`, val: mscReceitasArrecadadas || null },
      { label: `RREO Anexo 01 Receitas Arrecadadas`, val: getReceitasArrecadadasRREO(data.rreo) },
      'Receitas Arrecadadas totais divergem entre MSC de Dezembro e RREO Anexo 01.', true
    ));

    // D4_00027: RPNP Inscritos MSC Dez vs RREO A01 (contas 6221305 e 6221306)
    let mscRPNPInscritos = 0;
    decMSC.forEach(a => {
      if ((a.CONTA.startsWith('6221305') || a.CONTA.startsWith('6221306')) && a.Tipo_valor === 'ending_balance' && a.ND) {
        mscRPNPInscritos += a.Valor;
      }
    });
    results.push(...validatePairEquality('D4_00027', 'D4',
      { label: `MSC Dezembro RPNP (6221305, 6221306)`, val: mscRPNPInscritos || null },
      { label: `RREO Anexo 01 RPNP Inscritos`, val: getRPNP_inscricoes_A01(data.rreo) },
      'Restos a Pagar Não Processados inscritos divergem entre MSC e RREO Anexo 01.', false
    ));

    // D4_00035: RP Pagos MSC Dez vs RREO A07 (contas 6314 e 6322)
    let mscRPPagos = 0;
    decMSC.forEach(a => {
      if ((a.CONTA.startsWith('6314') || a.CONTA.startsWith('6322')) && a.Tipo_valor === 'ending_balance') {
        mscRPPagos += a.Valor;
      }
    });
    results.push(...validatePairEquality('D4_00035', 'D4',
      { label: `MSC Dezembro RP Pagos (6314, 6322)`, val: mscRPPagos || null },
      { label: `RREO Anexo 07 Total RP Pagos`, val: getTotalRPPagos_A07(data.rreo) },
      'Saldos de Restos a Pagar Pagos divergem entre MSC e RREO Anexo 07.', false
    ));

    // D4_00039: Tributos Municipais MSC Dez vs RREO A06
    results.push(...validatePairEquality('D4_00038', 'D4',
      { label: `MSC Dezembro Tributos Municipais`, val: mscTributosMunicipais || null },
      { label: `RREO A06 Tributos Municipais`, val: getTributosMunicipais_A06(data.rreo) },
      'Receitas de Tributos Municipais divergem entre MSC e RREO Anexo 06.', true
    ));
    results.push(...validatePairEquality('D4_00039', 'D4',
      { label: `MSC Dezembro Tributos Municipais`, val: mscTributosMunicipais || null },
      { label: `RREO A06 Tributos Municipais`, val: getTributosMunicipais_A06(data.rreo) },
      'Receitas de Tributos Municipais divergem entre MSC e RREO Anexo 06.', true
    ));

    // D4_00041: Transferências Municipais MSC Dez vs RREO A06
    results.push(...validatePairEquality('D4_00040', 'D4',
      { label: `MSC Dezembro Transf. Municipais (Constitucionais)`, val: mscTransfMunicipais || null },
      { label: `RREO A06 Transf. Constitucionais Municipais`, val: getTransferenciasMunicipais_A06(data.rreo) },
      'Receitas de Transferências Constitucionais Municipais divergem entre MSC e RREO Anexo 06.', true
    ));
    results.push(...validatePairEquality('D4_00041', 'D4',
      { label: `MSC Dezembro Transf. Municipais (Constitucionais)`, val: mscTransfMunicipais || null },
      { label: `RREO A06 Transf. Constitucionais Municipais`, val: getTransferenciasMunicipais_A06(data.rreo) },
      'Receitas de Transferências Constitucionais Municipais divergem entre MSC e RREO Anexo 06.', true
    ));

  }

  // D4_00026: Restos a Pagar Não Processados — MSC dezembro (213xxx) vs RREO Anexo 01 col[10]
  if (data.rreo) {
    const decKey = data.mscByPeriod
      ? Object.keys(data.mscByPeriod).find(p => p.endsWith('-12'))
      : undefined;
    const mscForRpnp = decKey && data.mscByPeriod ? data.mscByPeriod[decKey] : data.msc;
    if (mscForRpnp) {
      const rpnpMSC = sumAccounts(mscForRpnp, ['213'], 'ending_balance', 'C');
      const rpnpRREO = getRPNP_inscricoes_A01(data.rreo);

      if (rpnpRREO === null) {
        results.push({
          ruleId: 'D4_00026', dimension: 'D4', description: '', severity: 'info', impactsCapag: false,
          message: `Não foi possível extrair o valor de RPNP do RREO Anexo 01 para verificação D4_00026.`,
        });
      } else if (Math.abs(rpnpMSC - rpnpRREO) > 0.01) {
        results.push({
          ruleId: 'D4_00026', dimension: 'D4', description: '', severity: 'error', impactsCapag: false,
          message: `Restos a Pagar Não Processados divergem. MSC${decKey ? ` (${decKey})` : ''} (213xxx): R$ ${rpnpMSC.toLocaleString('pt-BR', {minimumFractionDigits:2})} | RREO Anexo 01 (col RPNP): R$ ${rpnpRREO.toLocaleString('pt-BR', {minimumFractionDigits:2})}.`,
        });
      }
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

  // ─── D4 DCA x RREO ─────────────────────────────────────────────────────────

  if (data.dca && data.rreo) {
    // D4_00003: Execução da despesa (DCA Anexo I-D vs RREO Anexo 01)
    const despesasDCA = getDCA_DespesasTotais(data.dca);
    if (despesasDCA) {
      results.push(...validatePairEquality('D4_00003', 'D4',
        { label: `DCA Anexo I-D (Empenhadas)`, val: despesasDCA.empenhadas },
        { label: `RREO Anexo 01 (Empenhadas)`, val: getDespesasEmpenhadas_SubtotalA01(data.rreo) },
        'Despesas Empenhadas divergem entre DCA e RREO Anexo 01.', true
      ));
      results.push(...validatePairEquality('D4_00003', 'D4',
        { label: `DCA Anexo I-D (Liquidadas)`, val: despesasDCA.liquidadas },
        { label: `RREO Anexo 01 (Liquidadas)`, val: getDespesasLiquidadas_SubtotalA01(data.rreo) },
        'Despesas Liquidadas divergem entre DCA e RREO Anexo 01.', true
      ));
      results.push(...validatePairEquality('D4_00003', 'D4',
        { label: `DCA Anexo I-D (Pagas)`, val: despesasDCA.pagas },
        { label: `RREO Anexo 01 (Pagas)`, val: getDespesasPagas_SubtotalA01(data.rreo) },
        'Despesas Pagas divergem entre DCA e RREO Anexo 01.', true
      ));
      results.push(...validatePairEquality('D4_00003', 'D4',
        { label: `DCA Anexo I-D (RPNP Inscritos)`, val: despesasDCA.rpnp },
        { label: `RREO Anexo 01 (RPNP Inscritos)`, val: getRPNP_inscricoes_A01(data.rreo) },
        'Inscrição de Restos a Pagar Não Processados divergem entre DCA e RREO Anexo 01.', true
      ));
    }

    // D4_00009: Alienação de Ativos (DCA Anexo I-C vs RREO Anexo 11)
    results.push(...validatePairEquality('D4_00009', 'D4',
      { label: `DCA Anexo I-C (Alienação)`, val: getDCA_ReceitasAlienacao(data.dca) },
      { label: `RREO Anexo 11 (Alienação)`, val: getReceitasAlienacao_A11(data.rreo) },
      'Receitas com alienação de ativos divergem entre DCA e RREO Anexo 11.', false
    ));

    // D4_00014: Tributos Municipais (DCA Anexo I-C vs RREO Anexo 06)
    results.push(...validatePairEquality('D4_00014', 'D4',
      { label: `DCA Anexo I-C (Tributos Municipais)`, val: getDCA_ReceitasTributarias(data.dca) },
      { label: `RREO Anexo 06 (Tributos Municipais)`, val: getTributosMunicipais_A06(data.rreo) },
      'Tributos Municipais divergem entre DCA e RREO Anexo 06.', true
    ));
    // D4_00015: Tributos Municipais (DCA Anexo I-C vs RREO Anexo 06)
    results.push(...validatePairEquality('D4_00015', 'D4',
      { label: `DCA Anexo I-C (Tributos Municipais)`, val: getDCA_ReceitasTributarias(data.dca) },
      { label: `RREO Anexo 06 (Tributos Municipais)`, val: getTributosMunicipais_A06(data.rreo) },
      'Receitas de tributos municipais divergem entre DCA e RREO Anexo 06.', false
    ));
    // D4_00010: Tributos Municipais (DCA Anexo I-C vs RREO Anexo 03)
    results.push(...validatePairEquality('D4_00010', 'D4',
      { label: `DCA Anexo I-C (Tributos Municipais)`, val: getDCA_ReceitasTributarias(data.dca) },
      { label: `RREO Anexo 03 (Tributos Municipais)`, val: getTributosMunicipais_A03(data.rreo) },
      'Tributos Municipais divergem entre DCA e RREO Anexo 03.', false
    ));
    // D4_00011: Tributos Municipais (DCA Anexo I-C vs RREO Anexo 03)
    results.push(...validatePairEquality('D4_00011', 'D4',
      { label: `DCA Anexo I-C (Tributos Municipais)`, val: getDCA_ReceitasTributarias(data.dca) },
      { label: `RREO Anexo 03 (Tributos Municipais)`, val: getTributosMunicipais_A03(data.rreo) },
      'Tributos Municipais divergem entre DCA e RREO Anexo 03.', false
    ));

    // D4_00012: Transferências Municipais (DCA Anexo I-C vs RREO Anexo 03)
    results.push(...validatePairEquality('D4_00012', 'D4',
      { label: `DCA Anexo I-C (Transf. Municipais)`, val: getDCA_TransferenciasMunicipais(data.dca) },
      { label: `RREO Anexo 03 (Transf. Municipais)`, val: getTransferenciasMunicipais_A03(data.rreo) },
      'Transferências Municipais divergem entre DCA e RREO Anexo 03.', false
    ));
    // D4_00013: Transferências Municipais (DCA Anexo I-C vs RREO Anexo 03)
    results.push(...validatePairEquality('D4_00013', 'D4',
      { label: `DCA Anexo I-C (Transf. Municipais)`, val: getDCA_TransferenciasMunicipais(data.dca) },
      { label: `RREO Anexo 03 (Transf. Municipais)`, val: getTransferenciasMunicipais_A03(data.rreo) },
      'Transferências Municipais divergem entre DCA e RREO Anexo 03.', false
    ));

    // D4_00015: Tributos Municipais (DCA Anexo I-C vs RREO Anexo 06)
    // Usaremos a mesma rotina de tributos da DCA contra o Anexo 06 do RREO.
    results.push(...validatePairEquality('D4_00015', 'D4',
      { label: `DCA Anexo I-C (Tributos Municipais)`, val: getDCA_ReceitasTributarias(data.dca) },
      { label: `RREO Anexo 06 (Tributos Municipais)`, val: getTributosMunicipais_A06(data.rreo) },
      'Receitas de tributos municipais divergem entre DCA e RREO Anexo 06.', false
    ));

    // D4_00016: Transferências Municipais (DCA Anexo I-C vs RREO Anexo 06)
    results.push(...validatePairEquality('D4_00016', 'D4',
      { label: `DCA Anexo I-C (Transf. Municipais)`, val: getDCA_TransferenciasMunicipais(data.dca) },
      { label: `RREO Anexo 06 (Transf. Municipais)`, val: getTransferenciasMunicipais_A06(data.rreo) },
      'Transferências Municipais divergem entre DCA e RREO Anexo 06.', true
    ));
    // D4_00017: Transferências Municipais (DCA Anexo I-C vs RREO Anexo 06)
    results.push(...validatePairEquality('D4_00017', 'D4',
      { label: `DCA Anexo I-C (Transf. Municipais)`, val: getDCA_TransferenciasMunicipais(data.dca) },
      { label: `RREO Anexo 06 (Transf. Municipais)`, val: getTransferenciasMunicipais_A06(data.rreo) },
      'Transferências Municipais divergem entre DCA e RREO Anexo 06.', true
    ));

    // D4_00019: Contribuições dos Servidores (DCA Anexo I-C vs RREO Anexo 03)
    results.push(...validatePairEquality('D4_00019', 'D4',
      { label: `DCA Anexo I-C (Contrib. Servidores)`, val: getDCA_ContribuicoesServidores(data.dca) },
      { label: `RREO Anexo 03 (Contrib. Servidores)`, val: getContribuicoesServidores_A03(data.rreo) },
      'Contribuições dos servidores divergem entre DCA e RREO Anexo 03.', true
    ));

    // D4_00020: Despesas de Capital (DCA Anexo I-D vs RREO Anexo 09)
    results.push(...validatePairEquality('D4_00020', 'D4',
      { label: `DCA Anexo I-D (Despesas de Capital)`, val: getDCA_DespesasCapital(data.dca) },
      { label: `RREO Anexo 09 (Despesas de Capital)`, val: getDespesasCapital_A09(data.rreo) },
      'Despesas de Capital divergem entre DCA e RREO Anexo 09.', false
    ));

    // D4_00002: Receita Realizada (DCA Anexo I-C vs RREO Anexo 01)
    results.push(...validatePairEquality('D4_00002', 'D4',
      { label: `DCA Anexo I-C (Receita Realizada)`, val: getDCA_ReceitaRealizadaTotal_IC(data.dca) },
      { label: `RREO Anexo 01 (Receita Realizada)`, val: getTotalReceitas_A01(data.rreo) },
      'Receita realizada total diverge entre DCA e RREO Anexo 01.', true
    ));

    // D4_00004: Despesa por Função exceto intra (DCA Anexo I-E vs RREO Anexo 02)
    results.push(...validatePairEquality('D4_00004', 'D4',
      { label: `DCA Anexo I-E (Despesa Função exceto Intra)`, val: getDCA_DespesaFuncaoExcetoIntra_IE(data.dca) },
      { label: `RREO Anexo 02 (Despesa Função exceto Intra)`, val: getDespesasExcetoIntra_A02_Liquidadas(data.rreo) },
      'Despesa por função diverge entre DCA e RREO Anexo 02.', false
    ));

    // D4_00006: Execução de RP (DCA Anexo I-F/I-G vs RREO Anexo 07)
    // A regra diz "valores dos restos a pagar processados e não processados" do Anexo I-F (provavelmente o saldo ou pagamentos). Vamos comparar os Pagamentos totais.
    const dcaRpPagos = (getDCA_RP_Pagos_IF(data.dca) || 0) + (getDCA_RPNP_Pagos_IG(data.dca) || 0);
    const rreoRpPagos = (getTotalRPPagos_A07_RPP(data.rreo) || 0) + (getTotalRPPagos_A07_RPNP(data.rreo) || 0);
    if (dcaRpPagos || rreoRpPagos) {
      results.push(...validatePairEquality('D4_00006', 'D4',
        { label: `DCA Execução RP (I-F + I-G)`, val: dcaRpPagos },
        { label: `RREO Anexo 07 (Pagos RPP + RPNP)`, val: rreoRpPagos },
        'Execução de Restos a Pagar diverge entre DCA e RREO Anexo 07.', false
      ));
    }

    // D4_00007: Execução de RPNP (DCA Anexo I-G vs RREO Anexo 07)
    results.push(...validatePairEquality('D4_00007', 'D4',
      { label: `DCA Anexo I-G (Pagamentos RPNP)`, val: getDCA_RPNP_Pagos_IG(data.dca) },
      { label: `RREO Anexo 07 (Pagamentos RPNP)`, val: getTotalRPPagos_A07_RPNP(data.rreo) },
      'Execução de RPNP diverge entre DCA e RREO Anexo 07.', false
    ));

    // D4_00008: Execução de RPP (DCA Anexo I-G vs RREO Anexo 07) -> A regra fala Anexo I-G mas RPP fica no I-F! O CSV diz I-G. Vamos ler do I-F para RPP.
    results.push(...validatePairEquality('D4_00008', 'D4',
      { label: `DCA Anexo I-F (Pagamentos RPP)`, val: getDCA_RP_Pagos_IF(data.dca) },
      { label: `RREO Anexo 07 (Pagamentos RPP)`, val: getTotalRPPagos_A07_RPP(data.rreo) },
      'Execução de RPP diverge entre DCA e RREO Anexo 07.', false
    ));

    // D4_00042: Passivo Financeiro >= Inscrição de RP + RP Pendentes
    const passivoFin = getDCA_PassivoFinanceiro(data.dca);
    const rreoRpInscritosAnt = getTotalRPInscritos_A07(data.rreo) || 0;
    const rreoRpInscritosDez = getTotalRPInscritos31Dez_A07(data.rreo) || 0;
    const rpInscritos = rreoRpInscritosAnt + rreoRpInscritosDez;
    const rpPendentes = getTotalRPSaldo_A07(data.rreo) || 0;
    const sumRp = rpInscritos + rpPendentes;

    if (passivoFin !== null) {
      if (passivoFin < sumRp - 0.01) {
        results.push({
          ruleId: 'D4_00042', dimension: 'D4', description: '', severity: 'error', impactsCapag: true,
          message: `O Passivo Financeiro na DCA (R$ ${passivoFin.toLocaleString('pt-BR')}) deve ser maior ou igual à soma de inscrições de RP e RP pendentes (R$ ${sumRp.toLocaleString('pt-BR')}).`,
        });
      }
    }

  }

  // ── D4 Cruzamentos RGF ──────────────────────────────────────────────────
  if (data.dca && data.rgf) {
    // D4_00028: DCA Anexo I-AB (Caixa e Equivalentes) vs RGF Anexo 02 (Disponibilidade de Caixa Bruta)
    const dcaCaixa = getDCA_CaixaEquivalentes(data.dca);
    const rgfA02Caixa = getDisponibilidadeCaixaBruta_A02_RGF(data.rgf);
    if (dcaCaixa !== null && rgfA02Caixa !== null) {
      if (dcaCaixa > rgfA02Caixa + 0.01) {
        results.push({
          ruleId: 'D4_00028', dimension: 'D4', description: '', severity: 'error', impactsCapag: false,
          message: `DCA Caixa e Equivalentes (R$ ${dcaCaixa.toLocaleString('pt-BR')}) não pode ser maior que Disponibilidade de Caixa Bruta do RGF Anexo 02 (R$ ${rgfA02Caixa.toLocaleString('pt-BR')}).`,
        });
      }
    }
  }

  if (decPeriodKey && data.mscByPeriod && data.rgf) {
    const decMSC = data.mscByPeriod[decPeriodKey];
    
    // Caixa na MSC = Contas que começam com 111 (ending_balance)
    const mscCaixa = decMSC
      .filter(a => a.CONTA.startsWith('111') && a.Tipo_valor === 'ending_balance')
      .reduce((s, a) => s + a.Valor, 0);

    // D4_00037: MSC Caixa vs RGF Anexo 02 (Disponibilidade de Caixa Bruta)
    const rgfA02Caixa = getDisponibilidadeCaixaBruta_A02_RGF(data.rgf);
    if (rgfA02Caixa !== null && Math.abs(mscCaixa - rgfA02Caixa) > 0.01) {
      results.push({
        ruleId: 'D4_00037', dimension: 'D4', description: '', severity: 'error', impactsCapag: false,
        message: `Disponibilidade de Caixa diverge. MSC (111xxx): R$ ${mscCaixa.toLocaleString('pt-BR')} | RGF Anexo 02: R$ ${rgfA02Caixa.toLocaleString('pt-BR')}.`,
      });
    }

    // D4_00036: MSC Caixa vs RGF Anexo 05 (Disponibilidade de Caixa Bruta)
    const rgfA05Caixa = getDisponibilidadeCaixaBruta_A05_RGF(data.rgf);
    if (rgfA05Caixa !== null) {
      if (Math.abs(mscCaixa - rgfA05Caixa) > 0.01) {
        results.push({
          ruleId: 'D4_00036', dimension: 'D4', description: '', severity: 'error', impactsCapag: true,
          message: `Disponibilidade de Caixa diverge. MSC (111xxx): R$ ${mscCaixa.toLocaleString('pt-BR')} | RGF Anexo 05: R$ ${rgfA05Caixa.toLocaleString('pt-BR')}.`,
        });
      }
    } else {
      results.push({
        ruleId: 'D4_00036', dimension: 'D4', description: '', severity: 'info', impactsCapag: false,
        message: 'Regra ignorada: Anexo 05 do RGF não disponível (aplicável apenas no último ano de mandato).',
      });
    }

    // D4_00043: Consórcios Públicos (MSC vs RGF Anexo 05)
    // MSC = 2188 + 2288 + 218910105 + 218910108 com FS em (860, 861, 862, 869)
    let mscConsorcios = 0;
    const consorcioSources = ['860', '861', '862', '869'];
    decMSC.forEach(a => {
      if ((a.CONTA.startsWith('2188') || a.CONTA.startsWith('2288') || a.CONTA === '218910105' || a.CONTA === '218910108') && a.Tipo_valor === 'ending_balance') {
        const fs = a.FS || '';
        if (consorcioSources.some(f => fs.startsWith(f))) {
          mscConsorcios += a.Valor;
        }
      }
    });
    
    const rgfA05Consorcios = getConsorciosPublicos_A05_RGF(data.rgf);
    if (rgfA05Consorcios !== null) {
      if (Math.abs(mscConsorcios - rgfA05Consorcios) > 0.01) {
        results.push({
          ruleId: 'D4_00043', dimension: 'D4', description: '', severity: 'error', impactsCapag: true,
          message: `Valores de Consórcios Públicos divergem. MSC (2188/2288 FS=860..): R$ ${mscConsorcios.toLocaleString('pt-BR')} | RGF Anexo 05: R$ ${rgfA05Consorcios.toLocaleString('pt-BR')}.`,
        });
      }
    } else {
      results.push({
        ruleId: 'D4_00043', dimension: 'D4', description: '', severity: 'info', impactsCapag: false,
        message: 'Regra ignorada: Anexo 05 do RGF não disponível.',
      });
    }
  }

  return results;
}

