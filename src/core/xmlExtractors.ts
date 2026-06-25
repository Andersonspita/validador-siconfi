/**
 * Extratores de dados dos demonstrativos fiscais (XLS/XML do Siconfi).
 * Todas as funções retornam `number | null`.
 * `null` significa que o dado não foi encontrado ou não pôde ser parseado —
 * o motor de validação deve pular a regra nesses casos (sem falso positivo).
 */

// Busca um valor numérico em uma planilha procurando o texto na primeira coluna.
const findValueInSheet = (
  sheet: any[][],
  searchTerm: string,
  startColOffset: number = 1
): number | null => {
  if (!Array.isArray(sheet)) return null;
  const regex = new RegExp(searchTerm, 'i');

  for (const row of sheet) {
    if (!Array.isArray(row)) continue;
    const matchIndex = row.findIndex(
      (cell, idx) => idx < 4 && typeof cell === 'string' && regex.test(cell)
    );
    if (matchIndex === -1) continue;

    for (let i = matchIndex + startColOffset; i < row.length; i++) {
      if (typeof row[i] === 'number') return row[i];           // inclui zero legítimo
      if (typeof row[i] === 'string') {
        const parsed = parseFloat(row[i].replace(/\./g, '').replace(',', '.'));
        if (!isNaN(parsed)) return parsed;                     // inclui zero legítimo
      }
    }
  }
  return null;
};

// Busca valor em linha imediatamente abaixo de um cabeçalho de seção.
// Útil para planilhas onde a linha "VALOR" fica separada do título da seção (ex: Anexo 04 RPPS).
const findValueInSection = (
  sheet: any[][],
  sectionTerm: string,
  valueTerm: string,
  maxLines: number = 8
): number | null => {
  if (!Array.isArray(sheet)) return null;
  const secRx = new RegExp(sectionTerm, 'i');
  const valRx = new RegExp(valueTerm, 'i');
  let inSection = false;
  let depth = 0;

  for (const row of sheet) {
    if (!Array.isArray(row)) continue;
    const cell = typeof row[0] === 'string' ? row[0] : '';

    if (!inSection && secRx.test(cell)) {
      inSection = true;
      depth = 0;
      continue;
    }

    if (inSection) {
      depth++;
      if (valRx.test(cell)) {
        for (let i = 1; i < row.length; i++) {
          if (typeof row[i] === 'number') return row[i];
          if (typeof row[i] === 'string') {
            const n = parseFloat(row[i].replace(/\./g, '').replace(',', '.'));
            if (!isNaN(n)) return n;
          }
        }
        return null;
      }
      if (depth > maxLines) inSection = false;
    }
  }
  return null;
};

// Tenta múltiplas variações de nome de aba para tolerar versões diferentes do Siconfi
const getSheet = (report: any, candidates: string[]): any[][] | null => {
  for (const name of candidates) {
    if (report[name] && Array.isArray(report[name])) return report[name];
  }
  return null;
};

// Busca o valor em uma linha usando o nome do cabeçalho da coluna em vez de um índice rígido numérico.
export const findValueInSheetByColumnName = (
  sheet: any[][],
  rowTerm: string,
  colHeaderTerm: string
): number | null => {
  if (!Array.isArray(sheet)) return null;

  const headerRegex = new RegExp(colHeaderTerm, 'i');
  let targetColIndex = -1;

  // 1. Vasculhar as primeiras linhas para encontrar o cabeçalho alvo e determinar seu índice de coluna
  for (const row of sheet) {
    if (!Array.isArray(row)) continue;
    const matchIndex = row.findIndex(c => typeof c === 'string' && headerRegex.test(c));
    if (matchIndex !== -1) {
      targetColIndex = matchIndex;
      break;
    }
  }

  // Se não encontrar a coluna, aborta
  if (targetColIndex === -1) return null;

  // 2. Procurar a linha desejada
  const rowRegex = new RegExp(rowTerm, 'i');
  for (const row of sheet) {
    if (!Array.isArray(row)) continue;
    const matchIndex = row.findIndex((c, i) => i < 4 && typeof c === 'string' && rowRegex.test(c));
    if (matchIndex === -1) continue;

    // 3. Obter a célula que está no cruzamento
    const cell = row[targetColIndex];
    if (typeof cell === 'number') return cell;
    if (typeof cell === 'string') {
      const parsed = parseFloat(cell.replace(/\./g, '').replace(',', '.'));
      if (!isNaN(parsed)) return parsed;
    }
  }
  return null;
};

// Antiga busca rígida (mantida temporariamente caso algum legacy dependa)
export const findValueByColumnIndex = (sheet: any[][], rowTerm: string, colIndex: number): number | null => {
  if (!Array.isArray(sheet)) return null;
  const rx = new RegExp(rowTerm, 'i');
  for (const row of sheet) {
    if (!Array.isArray(row)) continue;
    const match = row.findIndex((c, i) => i < 4 && typeof c === 'string' && rx.test(c));
    if (match === -1) continue;
    const cell = row[colIndex];
    if (typeof cell === 'number') return cell;
    if (typeof cell === 'string') {
      const n = parseFloat(cell.replace(/\./g, '').replace(',', '.'));
      if (!isNaN(n)) return n;
    }
  }
  return null;
};

// Export que aceita tanto colIndex estático ou colHeader string
export const extractByColumnFromReport = (
  report: any,
  sheetCandidates: string[],
  rowTerm: string,
  colQuery: number | string
): number | null => {
  const sheet = getSheet(report, sheetCandidates);
  if (!sheet) return null;
  if (typeof colQuery === 'number') {
    return findValueByColumnIndex(sheet, rowTerm, colQuery);
  }
  return findValueInSheetByColumnName(sheet, rowTerm, colQuery);
};

// Extrator genérico: dado o report, os candidatos de aba e o termo de busca
export const extractFromReport = (
  report: any,
  sheetCandidates: string[],
  searchTerm: string,
  colOffset: number = 1
): number | null => {
  const sheet = getSheet(report, sheetCandidates);
  return sheet ? findValueInSheet(sheet, searchTerm, colOffset) : null;
};

// ─── RCL ─────────────────────────────────────────────────────────────────────

export const getRCLFromRREO = (rreo: any): number | null => {
  const sheet = getSheet(rreo, ['RREO-Anexo 03', 'RREO Anexo 03', 'Anexo 03']);
  if (!sheet) return null;
  return findValueInSheet(sheet, 'RECEITA CORRENTE L[IÍ]QUIDA.*\\(III\\)');
};

export const getRCLFromRGF = (rgf: any): number | null => {
  const sheet = getSheet(rgf, ['RGF-Anexo 01', 'RGF Anexo 01', 'Anexo 01']);
  if (!sheet) return null;
  // Padrão primário: linha que contém "- RCL" ou "(RCL)" — distingue da linha "AJUSTADA"
  return findValueInSheet(sheet, 'RECEITA CORRENTE L[IÍ]QUIDA.*-.*RCL\\b|RECEITA CORRENTE L[IÍ]QUIDA.*\\(RCL\\)');
};

// ─── RREO Anexo 01 ───────────────────────────────────────────────────────────

export const getReceitasArrecadadasRREO = (rreo: any): number | null =>
  extractFromReport(rreo, ['RREO-Anexo 01', 'RREO Anexo 01'], 'RECEITAS.*EXCETO INTRA');

export const getEquilibrioOrcamentario = (rreo: any): { comDeficit: number | null; comSuperavit: number | null } => {
  const sheet = getSheet(rreo, ['RREO-Anexo 01', 'RREO Anexo 01']);
  if (!sheet) return { comDeficit: null, comSuperavit: null };
  return {
    comDeficit:   findValueInSheet(sheet, 'TOTAL COM D[EÉ]FICIT'),
    comSuperavit: findValueInSheet(sheet, 'TOTAL COM SUPER[AÁ]VIT'),
  };
};

export const getTotalDespesasAnexo01 = (rreo: any): number | null =>
  extractFromReport(rreo, ['RREO-Anexo 01', 'RREO Anexo 01'], 'SUBTOTAL DAS DESPESAS.*\\(X\\)');

// D3_00032: Recursos RPPS arrecadados em exercícios anteriores — Anexo 01
export const getRPPSExercAnt_A01 = (rreo: any): number | null =>
  extractFromReport(rreo, ['RREO-Anexo 01', 'RREO Anexo 01'], 'Recursos Arrecadados.*Exerc.*Anteriores.*RPPS|RPPS.*Exerc.*Anteriores');

// D3_00033: Superávit financeiro para créditos adicionais — Anexo 01
export const getSuperavitFinanceiro_A01 = (rreo: any): number | null =>
  extractFromReport(rreo, ['RREO-Anexo 01', 'RREO Anexo 01'], 'Super[aá]vit Financeiro.*Cr[eé]ditos Adicionais');

// D3_00034: Reserva do RPPS — Anexo 01
export const getReservaRPPS_A01 = (rreo: any): number | null =>
  extractFromReport(rreo, ['RREO-Anexo 01', 'RREO Anexo 01'], 'RESERVA DO RPPS|RESERVA.*RPPS');

// D3_00035: Reserva de Contingência — Anexo 01
export const getReservaContingencia_A01 = (rreo: any): number | null =>
  extractFromReport(rreo, ['RREO-Anexo 01', 'RREO Anexo 01'], 'RESERVA DE CONTING[EÊ]NCIA');

// ─── RREO Anexo 02 ───────────────────────────────────────────────────────────

export const getDespesasAnexo02 = (rreo: any): number | null =>
  extractFromReport(rreo, ['RREO-Anexo 02', 'RREO Anexo 02'], 'DESPESAS.*EXCETO INTRA.*\\(I\\)');

// D4_00030 a D4_00034: Extraindo Despesas Empenhadas (coluna 'Até o Bimestre') do Anexo 02
export const getDespesasPrevSocial_A02 = (rreo: any): number | null =>
  extractByColumnFromReport(rreo, ['RREO-Anexo 02', 'RREO Anexo 02'], '09.*Previdência|09.*Previdencia', 'Até o Bimestre');

export const getDespesasSaude_A02 = (rreo: any): number | null =>
  extractByColumnFromReport(rreo, ['RREO-Anexo 02', 'RREO Anexo 02'], '10.*Saúde|10.*Saude', 'Até o Bimestre');

export const getDespesasEducacao_A02 = (rreo: any): number | null =>
  extractByColumnFromReport(rreo, ['RREO-Anexo 02', 'RREO Anexo 02'], '12.*Educação|12.*Educacao', 'Até o Bimestre');

export const getDespesasExcetoIntra_A02_Empenhadas = (rreo: any): number | null =>
  extractByColumnFromReport(rreo, ['RREO-Anexo 02', 'RREO Anexo 02'], 'DESPESAS.*EXCETO INTRA.*\\(I\\)', 'Até o Bimestre');

export const getDespesasExcetoIntra_A02_Liquidadas = (rreo: any): number | null =>
  extractByColumnFromReport(rreo, ['RREO-Anexo 02', 'RREO Anexo 02'], 'DESPESAS.*EXCETO INTRA.*\\(I\\)', 'Despesas Liquidadas.*Bimestre');

export const getDespesasIntra_A02_Empenhadas = (rreo: any): number | null =>
  extractByColumnFromReport(rreo, ['RREO-Anexo 02', 'RREO Anexo 02'], 'DESPESAS.*INTRA.*\\(II\\)', 'Até o Bimestre');

// ─── RREO Anexo 04 (RPPS) ────────────────────────────────────────────────────

// D3_00030: Total receitas do RPPS (Fundo em Capitalização) — Anexo 04
export const getTotalReceitasRPPS_A04 = (rreo: any): number | null =>
  extractFromReport(rreo, ['RREO-Anexo 04', 'RREO Anexo 04'], 'TOTAL DAS RECEITAS DO FUNDO.*\\(IV\\)');

// D3_00030: Receitas com fontes RPPS no Anexo 06 (soma das linhas com FONTES RPPS)
export const getReceitasRPPS_A06 = (rreo: any): number | null =>
  extractFromReport(rreo, ['RREO-Anexo 06', 'RREO Anexo 06'], 'RECEITAS PRIMÁRIAS CORRENTES.*COM FONTES RPPS.*\\(V\\)|RECEITAS.*COM FONTES RPPS.*\\(V\\)');
export const getRGF_PisoEnfermagem = (rgf: any): number | null =>
  extractFromReport(rgf, ['RGF-Anexo 01', 'RGF Anexo 01', 'Anexo 1'], 'Parcela dedut.vel referente ao piso salarial do Enfermeir');
// D4_00045: Recursos Extraorçamentários (RGF Anexo 07)
export const getRecursosExtraorcamentarios_A07_RGF = (rgf: any): number | null =>
  extractFromReport(rgf, ['RGF-Anexo 07', 'RGF Anexo 07', 'Anexo 07', 'Anexo 7'], 'Recursos Extraorçamentários');

// D3_00032: Recursos RPPS exercícios anteriores — Anexo 04
// O valor fica em linha "  VALOR" abaixo do cabeçalho de seção
export const getRPPSExercAnt_A04 = (rreo: any): number | null => {
  const sheet = getSheet(rreo, ['RREO-Anexo 04', 'RREO Anexo 04']);
  return sheet ? findValueInSection(sheet, 'Recursos.*RPPS.*Arrecadados.*Exerc.*Anteriores', 'VALOR') : null;
};

// D3_00034: Reserva RPPS — Anexo 04
export const getReservaRPPS_A04 = (rreo: any): number | null => {
  const sheet = getSheet(rreo, ['RREO-Anexo 04', 'RREO Anexo 04']);
  return sheet ? findValueInSection(sheet, 'Reserva.*RPPS|RPPS.*Reserva', 'VALOR') : null;
};

// ─── RREO Anexo 06 (Resultado Primário/Nominal) ──────────────────────────────

// D3_00006: DCL no Anexo 06
export const getDCL_RREO_A06 = (rreo: any): number | null =>
  extractFromReport(rreo, ['RREO-Anexo 06', 'RREO Anexo 06'], 'DÍVIDA CONSOLIDADA LÍQUIDA.*\\(XLII\\)|DCL.*XLII');

// D3_00032: Recursos RPPS anteriores — Anexo 06 (seção "Informações Adicionais")
export const getRPPSExercAnt_A06 = (rreo: any): number | null =>
  extractFromReport(rreo, ['RREO-Anexo 06', 'RREO Anexo 06'], 'Recursos Arrecadados.*Exerc.*Anteriores.*RPPS|RPPS.*Exerc.*Anteriores');

// D3_00033: Superávit financeiro — Anexo 06
export const getSuperavitFinanceiro_A06 = (rreo: any): number | null =>
  extractFromReport(rreo, ['RREO-Anexo 06', 'RREO Anexo 06'], 'Super[aá]vit Financeiro.*Cr[eé]ditos Adicionais|Super[aá]vit Financeiro.*Abertura');

// D3_00034: Reserva RPPS — Anexo 06
export const getReservaRPPS_A06 = (rreo: any): number | null =>
  extractFromReport(rreo, ['RREO-Anexo 06', 'RREO Anexo 06'], 'RESERVA.*RPPS|RESERVA ORÇAMENTÁRIA.*RPPS');

// D3_00035: Reserva Contingência — Anexo 06
export const getReservaContingencia_A06 = (rreo: any): number | null =>
  extractFromReport(rreo, ['RREO-Anexo 06', 'RREO Anexo 06'], 'RESERVA DE CONTING[EÊ]NCIA.*\\(XXIX\\)|RESERVA DE CONTING[EÊ]NCIA');

// D3_00028: Receitas Realizadas Até o Bimestre
export const getReceitasRealizadasTotal_A01 = (rreo: any): number | null =>
  extractByColumnFromReport(rreo, ['RREO-Anexo 01', 'RREO Anexo 01'], 'SUBTOTAL DAS RECEITAS.*\\(III\\)', 'Até o Bimestre|Bimestre');

export const getReceitasRealizadasTotal_A06 = (rreo: any): number | null =>
  extractByColumnFromReport(rreo, ['RREO-Anexo 06', 'RREO Anexo 06'], 'RECEITA PRIMÁRIA TOTAL.*\\(XVI\\)', 'Até o Bimestre|Bimestre');

// D3_00027: Dotação atualizada e Despesas Empenhadas/Liquidadas — para comparação A01 × A06
export const getDotacaoAtualizada_A01 = (rreo: any): number | null =>
  extractByColumnFromReport(rreo, ['RREO-Anexo 01', 'RREO Anexo 01'], 'SUBTOTAL DAS DESPESAS.*\\(X\\)', 'Dotação Atualizada|Dotação.*Atualizada');
export const getDespesasEmpenhadas_A01 = (rreo: any): number | null =>
  extractByColumnFromReport(rreo, ['RREO-Anexo 01', 'RREO Anexo 01'], 'SUBTOTAL DAS DESPESAS.*\\(X\\)', 'Despesas Empenhadas.*Bimestre|Empenhadas.*Bimestre');
export const getDespesasLiquidadas_A01 = (rreo: any): number | null =>
  extractByColumnFromReport(rreo, ['RREO-Anexo 01', 'RREO Anexo 01'], 'SUBTOTAL DAS DESPESAS.*\\(X\\)', 'Despesas Liquidadas.*Bimestre|Liquidadas.*Bimestre');

export const getDotacaoAtualizada_A06 = (rreo: any): number | null =>
  extractByColumnFromReport(rreo, ['RREO-Anexo 06', 'RREO Anexo 06'], 'DESPESA PRIMÁRIA TOTAL.*\\(XXXII\\)', 'Dotação Atualizada|Dotação.*Atualizada');
export const getDespesasEmpenhadas_A06 = (rreo: any): number | null =>
  extractByColumnFromReport(rreo, ['RREO-Anexo 06', 'RREO Anexo 06'], 'DESPESA PRIMÁRIA TOTAL.*\\(XXXII\\)', 'Despesas Empenhadas.*Bimestre|Empenhadas.*Bimestre|Até o Bimestre');
export const getDespesasLiquidadas_A06 = (rreo: any): number | null =>
  extractByColumnFromReport(rreo, ['RREO-Anexo 06', 'RREO Anexo 06'], 'DESPESA PRIMÁRIA TOTAL.*\\(XXXII\\)', 'Despesas Liquidadas.*Bimestre|Liquidadas.*Bimestre|Até o Bimestre');

// D3_00022: Receitas Correntes (exceto intra)
export const getReceitasCorrentes_A01 = (rreo: any): number | null =>
  extractByColumnFromReport(rreo, ['RREO-Anexo 01', 'RREO Anexo 01'], 'RECEITAS CORRENTES\\s*$|^\\s+RECEITAS CORRENTES\\s+$', 'Até o Bimestre|Bimestre');

// D3_00023: Receitas de Capital (exceto intra)
export const getReceitasCapital_A01 = (rreo: any): number | null =>
  extractByColumnFromReport(rreo, ['RREO-Anexo 01', 'RREO Anexo 01'], 'RECEITAS DE CAPITAL', 'Até o Bimestre|Bimestre');

// D3_00024: Despesas Correntes (exceto intra)
export const getDespesasCorrentes_A01 = (rreo: any): number | null =>
  extractByColumnFromReport(rreo, ['RREO-Anexo 01', 'RREO Anexo 01'], 'DESPESAS CORRENTES\\s*$|^\\s+DESPESAS CORRENTES\\s+$', 'Despesas Liquidadas.*Bimestre|Liquidadas.*Bimestre');

// D3_00025: Despesas de Capital (exceto intra)
export const getDespesasCapital_A01 = (rreo: any): number | null =>
  extractByColumnFromReport(rreo, ['RREO-Anexo 01', 'RREO Anexo 01'], 'DESPESAS DE CAPITAL', 'Despesas Liquidadas.*Bimestre|Liquidadas.*Bimestre');

// D4_00025: Despesas empenhadas/liquidadas/pagas
export const getDespesasEmpenhadas_SubtotalA01 = (rreo: any): number | null =>
  extractByColumnFromReport(rreo, ['RREO-Anexo 01', 'RREO Anexo 01'], 'SUBTOTAL DAS DESPESAS.*\\(X\\)', 'Despesas Empenhadas.*Bimestre|Empenhadas.*Bimestre');
export const getDespesasLiquidadas_SubtotalA01 = (rreo: any): number | null =>
  extractByColumnFromReport(rreo, ['RREO-Anexo 01', 'RREO Anexo 01'], 'SUBTOTAL DAS DESPESAS.*\\(X\\)', 'Despesas Liquidadas.*Bimestre|Liquidadas.*Bimestre');
export const getDespesasPagas_SubtotalA01 = (rreo: any): number | null =>
  extractByColumnFromReport(rreo, ['RREO-Anexo 01', 'RREO Anexo 01'], 'SUBTOTAL DAS DESPESAS.*\\(X\\)', 'Despesas Pagas.*Bimestre|Pagas.*Bimestre');

// A01: Inscrições em RPNP
export const getRPNP_inscricoes_A01 = (rreo: any): number | null =>
  extractByColumnFromReport(rreo, ['RREO-Anexo 01', 'RREO Anexo 01'], 'SUBTOTAL DAS DESPESAS.*\\(X\\)', 'Inscritas.*Não Processados|RPNP|Restos a Pagar Não Processados');

// ─── RREO Anexo 07 (Restos a Pagar) ─────────────────────────────────────────

// D3_00045: Valores negativos em Restos a Pagar
export const findNegativosRP_A07 = (rreo: any): { label: string; value: number }[] => {
  const sheet = getSheet(rreo, ['RREO-Anexo 07', 'RREO Anexo 07']);
  if (!sheet) return [];
  const result: { label: string; value: number }[] = [];
  for (const row of sheet) {
    if (!Array.isArray(row)) continue;
    const label = typeof row[0] === 'string' ? row[0].trim() : '';
    if (/TOTAL|SUBTOTAL/i.test(label)) continue;
    for (let c = 1; c < row.length; c++) {
      if (typeof row[c] === 'number' && row[c] < 0) {
        result.push({ label: label.slice(0, 60), value: row[c] });
        break;
      }
    }
  }
  return result;
};

// D3_00017: Total RP (exceto intra + intra) — Anexo 07 coluna "Pagos no Exercício"
export const getTotalRPPagos_A07 = (rreo: any): number | null =>
  extractByColumnFromReport(rreo, ['RREO-Anexo 07', 'RREO Anexo 07'], 'TOTAL\\s*\\(III\\)\\s*=\\s*\\(I\\s*\\+\\s*II\\)', 'Pagos|Pagos no Exerc[ií]cio');

// D3_00009: Total RP (Saldo/Inscritos) — Anexo 07
export const getTotalRPSaldo_A07 = (rreo: any): number | null =>
  extractByColumnFromReport(rreo, ['RREO-Anexo 07', 'RREO Anexo 07'], 'TOTAL\\s*\\(III\\)\\s*=\\s*\\(I\\s*\\+\\s*II\\)', 'Saldo|Inscritos');

// D3_00017: Total RP Pagos (Anexo 06)
export const getTotalRPPagos_A06 = (rreo: any): number | null =>
  extractByColumnFromReport(rreo, ['RREO-Anexo 06', 'RREO Anexo 06'], 'RESTOS A PAGAR PROCESSADOS E NÃO PROCESSADOS LIQUIDADOS PAGOS', 'Até o Bimestre|Bimestre|Pagos');

// ─── RGF Anexo 01 ────────────────────────────────────────────────────────────

// D3_00015: Transferências emendas individuais — RGF Anexo 01
export const getTransfEmendasIndividuais_RGF_A01 = (rgf: any): number | null =>
  extractFromReport(rgf, ['RGF-Anexo 01', 'RGF Anexo 01'],
    'Emendas Individuais.*166-A|Transferências.*Emendas.*Individuais|166-A.*Emendas');

// D3_00011: Deduções de inativos/pensionistas com recursos vinculados — RGF Anexo 01
export const getDedInativos_RGF_A01 = (rgf: any): number | null =>
  extractFromReport(rgf, ['RGF-Anexo 01', 'RGF Anexo 01'],
    'Inativos.*Pensionistas.*Recursos Vinculados|Recursos Vinculados.*Inativos');

// D3_00011: Total inativos e pensionistas — RGF Anexo 01
export const getTotalInativos_RGF_A01 = (rgf: any): number | null =>
  extractFromReport(rgf, ['RGF-Anexo 01', 'RGF Anexo 01'],
    'Inativos e Pensionistas(?!.*Recursos)');

// ─── RGF Anexo 02 ────────────────────────────────────────────────────────────

// D3_00006: DCL — RGF Anexo 02
export const getDCL_RGF_A02 = (rgf: any): number | null =>
  extractFromReport(rgf, ['RGF-Anexo 02', 'RGF Anexo 02'],
    'DÍVIDA CONSOLIDADA LÍQUIDA.*DCL.*\\(III\\)|DÍVIDA CONSOLIDADA LÍQUIDA.*\\(III\\)');

// D3_00014: Transferências emendas individuais — RGF Anexo 02
export const getTransfEmendasIndividuais_RGF_A02 = (rgf: any): number | null =>
  extractFromReport(rgf, ['RGF-Anexo 02', 'RGF Anexo 02'],
    'Emendas Individuais|166-A.*§.*1');

// ─── RREO Anexo 03 ───────────────────────────────────────────────────────────

// D3_00015: Transferências emendas individuais — RREO Anexo 03
export const getTransfEmendasIndividuais_RREO_A03 = (rreo: any): number | null =>
  extractFromReport(rreo, ['RREO-Anexo 03', 'RREO Anexo 03'],
    'Emendas Individuais|166-A.*§.*1');

// D3_00016: Transferências emendas de bancada — RREO Anexo 03
export const getTransfEmendasBancada_RREO_A03 = (rreo: any): number | null =>
  extractFromReport(rreo, ['RREO-Anexo 03', 'RREO Anexo 03'],
    'emendas de bancada|166.*§.*16');

// D3_00016: Transferências emendas de bancada — RGF Anexo 01
export const getTransfEmendasBancada_RGF_A01 = (rgf: any): number | null =>
  extractFromReport(rgf, ['RGF-Anexo 01', 'RGF Anexo 01'],
    'emendas de bancada|166.*§.*16');

// D3_00044: Transferências agentes comunitários de saúde — RREO Anexo 03
export const getTransfAgentesSaude_RREO_A03 = (rreo: any): number | null =>
  extractFromReport(rreo, ['RREO-Anexo 03', 'RREO Anexo 03'],
    'agentes comunit[aá]rios|198.*§.*11');

// D3_00044: Transferências agentes comunitários de saúde — RGF Anexo 01
export const getTransfAgentesSaude_RGF_A01 = (rgf: any): number | null =>
  extractFromReport(rgf, ['RGF-Anexo 01', 'RGF Anexo 01'],
    'agentes comunit[aá]rios|198.*§.*11');

// D4_00023: Tributos Municipais — RREO Anexo 03
export const getTributosMunicipais_A03 = (rreo: any): number | null =>
  extractByColumnFromReport(rreo, ['RREO-Anexo 03', 'RREO Anexo 03'], 'Impostos.*Taxas.*Contribui[çc][õo]es.*Melhoria', 'Até o Bimestre');

// D4_00025: Transferências Constitucionais Municipais — RREO Anexo 03
export const getTransferenciasMunicipais_A03 = (rreo: any): number | null => {
  const fpm = extractByColumnFromReport(rreo, ['RREO-Anexo 03', 'RREO Anexo 03'], 'Cota-Parte.*FPM', 'Até o Bimestre') || 0;
  const icms = extractByColumnFromReport(rreo, ['RREO-Anexo 03', 'RREO Anexo 03'], 'Cota-Parte.*ICMS', 'Até o Bimestre') || 0;
  const ipva = extractByColumnFromReport(rreo, ['RREO-Anexo 03', 'RREO Anexo 03'], 'Cota-Parte.*IPVA', 'Até o Bimestre') || 0;
  const itr = extractByColumnFromReport(rreo, ['RREO-Anexo 03', 'RREO Anexo 03'], 'Cota-Parte.*ITR', 'Até o Bimestre') || 0;
  const fundeb = extractByColumnFromReport(rreo, ['RREO-Anexo 03', 'RREO Anexo 03'], 'Transfer[êe]ncias.*FUNDEB', 'Até o Bimestre') || 0;
  const lc87 = extractByColumnFromReport(rreo, ['RREO-Anexo 03', 'RREO Anexo 03'], 'Transfer[êe]ncias.*LC.*87', 'Até o Bimestre') || 0;
  const lc61 = extractByColumnFromReport(rreo, ['RREO-Anexo 03', 'RREO Anexo 03'], 'Transfer[êe]ncias.*LC.*61', 'Até o Bimestre') || 0;
  
  const total = fpm + icms + ipva + itr + fundeb + lc87 + lc61;
  return total > 0 ? total : null;
};

// ─── RREO Anexo 04 ───────────────────────────────────────────────────────────

// D3_00030: Receitas Previdenciárias no Anexo 04
export const getReceitasPrevidenciarias_A04 = (rreo: any): number | null =>
  extractFromReport(rreo, ['RREO-Anexo 04', 'RREO Anexo 04'], 'TOTAL.*RECEITAS.*PREVIDENCI[AÁ]RIAS');

// D3_00008: Restos a pagar não processados inscritos (RGF Anexo 05)
export const getRPNP_A05_RGF = (rgf: any): number | null =>
  extractFromReport(rgf, ['RGF-Anexo 05', 'RGF Anexo 05'],
    'RESTOS A PAGAR EMPENHADOS E NÃO LIQUIDADOS|RPNP');

// D3_00009: Restos a pagar processados (RGF Anexo 05)
export const getRPP_A05_RGF = (rgf: any): number | null =>
  extractFromReport(rgf, ['RGF-Anexo 05', 'RGF Anexo 05'],
    'RESTOS A PAGAR LIQUIDADOS E NÃO PAGOS|RPP');

// ─── Utilitários ─────────────────────────────────────────────────────────────

// Retorna valores negativos em qualquer aba do demonstrativo
export const findNegativeValues = (report: any): { sheet: string; row: number; value: number; label: string }[] => {
  const found: { sheet: string; row: number; value: number; label: string }[] = [];
  for (const [sheetName, rows] of Object.entries(report)) {
    if (!Array.isArray(rows)) continue;
    (rows as any[][]).forEach((row, rowIdx) => {
      if (!Array.isArray(row)) return;
      const label = typeof row[0] === 'string' ? row[0].trim() : '';
      if (/DEFICIT|DÉFICIT|SUPERÁV|RESULTADO/i.test(label)) return;
      for (let col = 1; col < row.length; col++) {
        const v = row[col];
        if (typeof v === 'number' && v < 0) {
          found.push({ sheet: sheetName, row: rowIdx + 1, value: v, label: label.slice(0, 60) });
          break;
        }
      }
    });
  }
  return found;
};

// Extrai metadados de identificação do demonstrativo (ente, período, exercício)
export const extractXLSMetadata = (report: any): { ente?: string; periodo?: string; exercicio?: string } => {
  const meta: { ente?: string; periodo?: string; exercicio?: string } = {};
  const firstSheet = report[Object.keys(report)[0]];
  if (!Array.isArray(firstSheet)) return meta;

  for (const row of firstSheet.slice(0, 15)) {
    if (!Array.isArray(row) || typeof row[0] !== 'string') continue;
    const cell = row[0].trim();
    if (cell.startsWith('Ente:')) meta.ente = cell.replace('Ente:', '').trim();
    if (cell.startsWith('Período:')) meta.periodo = cell.replace('Período:', '').trim();
    if (cell.startsWith('Exercício:')) meta.exercicio = cell.replace('Exercício:', '').trim();
  }
  return meta;
};


// =============================================================================
// DCA - Declaração de Contas Anuais
// =============================================================================

export const hasValueInDCA = (
  dca: any,
  sheetNames: string[],
  searchTerm: string,
  startColOffset: number = 1
): boolean => {
  const sheet = getSheet(dca, sheetNames);
  if (!sheet) return false;
  
  const val = findValueInSheet(sheet, searchTerm, startColOffset);
  return val !== null && val !== 0;
};

export const getDCAValue = (
  dca: any,
  sheetNames: string[],
  searchTerm: string,
  colOffset: number = 1
): number | null => {
  return extractFromReport(dca, sheetNames, searchTerm, colOffset);
};

// D2_00001: FUNDEB VPA (Anexo I-HI)
export const getDCA_VPA_Fundeb = (dca: any): number | null =>
  getDCAValue(dca, ['DCA-Anexo I-HI', 'Anexo I-HI'], '4\\.5\\.2\\.2\\.0\\.00\\.00.*Transfer[eê]ncias do FUNDEB');

// D2_00002: FUNDEB VPD (Anexo I-HI)
export const getDCA_VPD_Fundeb = (dca: any): number | null =>
  getDCAValue(dca, ['DCA-Anexo I-HI', 'Anexo I-HI'], '3\\.5\\.2\\.2\\.0\\.00\\.00.*Transfer[eê]ncias ao FUNDEB');

// D2_00003: Deduções FUNDEB (Anexo I-C)
// Procuramos pela coluna "Deduções - FUNDEB" ou similar na linha de Transferências
export const getDCA_DeducoesFundeb = (dca: any): number | null =>
  extractByColumnFromReport(dca, ['DCA-Anexo I-C', 'Anexo I-C'], '1\\.7\\.1\\.5|1\\.7\\.5\\.1', 'Dedu[cç][oõ]es.*FUNDEB');

// D2_00004: Receitas FUNDEB (Anexo I-C)
export const getDCA_ReceitasFundeb = (dca: any): number | null =>
  extractByColumnFromReport(dca, ['DCA-Anexo I-C', 'Anexo I-C'], '1\\.7\\.5\\.1\\.00\\.0\\.0.*FUNDEB', 'Receitas Brutas Realizadas|Receitas.*Realizadas');

// D2_00005: Encargos patronais (Anexo I-D)
// 3.1.90.13.00 ou 3.1.91.13.00
export const getDCA_EncargosPatronais = (dca: any): number | null => {
  const val1 = getDCAValue(dca, ['DCA-Anexo I-D', 'Anexo I-D'], '3\\.1\\.90\\.13\\.00.*Obriga[cç][oõ]es Patronais');
  const val2 = getDCAValue(dca, ['DCA-Anexo I-D', 'Anexo I-D'], '3\\.1\\.91\\.13\\.00.*Contribui[cç][oõ]es Patronais');
  if (val1 === null && val2 === null) return null;
  return (val1 || 0) + (val2 || 0);
};
// D2_00006: Despesas com Pessoal (Anexo I-D)
export const getDCA_DespesasPessoal = (dca: any): number | null =>
  getDCAValue(dca, ['DCA-Anexo I-D', 'Anexo I-D'], '3\\.1\\.00\\.00\\.00.*Pessoal e Encargos');

// D2_00007: Despesas de Custeio (Anexo I-D)
export const getDCA_DespesasCusteio = (dca: any): number | null =>
  getDCAValue(dca, ['DCA-Anexo I-D', 'Anexo I-D'], '3\\.3\\.00\\.00\\.00.*Outras Despesas Correntes');

// D2_00008: Despesas por função (Anexo I-E)
export const hasDCA_DespesasFuncao = (dca: any): boolean => {
  const sheet = getSheet(dca, ['DCA-Anexo I-E', 'Anexo I-E']);
  if (!sheet) return false;
  // Verifica se alguma linha que começa com número (ex: "01 - Legislativa") tem valor > 0
  for (const row of sheet) {
    if (Array.isArray(row) && typeof row[0] === 'string' && /^\d{2}\s*-/.test(row[0].trim())) {
      for (let i = 1; i < row.length; i++) {
        if (typeof row[i] === 'number' && row[i] > 0) return true;
      }
    }
  }
  return false;
};

// D2_00010: Receitas de Transferências Intergovernamentais (Anexo I-C)
export const getDCA_ReceitasTransferencias = (dca: any): number | null =>
  extractByColumnFromReport(dca, ['DCA-Anexo I-C', 'Anexo I-C'], '1\\.7\\.1.*Transfer[eê]ncias|1\\.7\\.2.*Transfer[eê]ncias', 'Receitas Brutas Realizadas|Receitas.*Realizadas');

// D2_00011: Receitas Tributárias (Anexo I-C)
export const getDCA_ReceitasTributarias = (dca: any): number | null =>
  extractByColumnFromReport(dca, ['DCA-Anexo I-C', 'Anexo I-C'], '1\\.1\\.0.*Impostos.*Taxas', 'Receitas Brutas Realizadas|Receitas.*Realizadas');

// D2_00012: Receitas orçamentárias menores que suas deduções (Anexo I-C)
export const checkDCA_ReceitasMenoresDeducoes = (dca: any): { row: string; receita: number; deducao: number }[] => {
  const results: { row: string; receita: number; deducao: number }[] = [];
  const sheet = getSheet(dca, ['DCA-Anexo I-C', 'Anexo I-C']);
  if (!sheet) return results;

  const headerRowIdx = sheet.findIndex((r: any[]) => r.some(c => typeof c === 'string' && c.includes('Receitas Brutas Realizadas')));
  if (headerRowIdx === -1) return results;
  const header = sheet[headerRowIdx];
  
  const colReceita = header.findIndex((c: any) => typeof c === 'string' && c.includes('Receitas Brutas Realizadas'));
  const colsDeducao = header.map((c: any, i: number) => typeof c === 'string' && c.toLowerCase().includes('dedu') ? i : -1).filter((i: number) => i !== -1);
  
  if (colReceita === -1 || colsDeducao.length === 0) return results;

  for (let i = headerRowIdx + 1; i < sheet.length; i++) {
    const row = sheet[i];
    if (!Array.isArray(row) || typeof row[0] !== 'string') continue;
    const desc = row[0];
    const rec = typeof row[colReceita] === 'number' ? row[colReceita] : 0;
    const deducao = colsDeducao.reduce((acc: number, colIdx: number) => acc + (typeof row[colIdx] === 'number' ? row[colIdx] : 0), 0);
    
    if (rec > 0 && rec < deducao) {
      results.push({ row: desc, receita: rec, deducao });
    }
  }
  return results;
};

// D2_00015 / D2_00018: Bens Móveis (Anexo I-AB)
export const getDCA_BensMoveis = (dca: any): number | null =>
  getDCAValue(dca, ['DCA-Anexo I-AB', 'Anexo I-AB'], '1\\.2\\.3\\.1\\.1\\.00\\.00.*Bens M[oó]veis');

// D2_00016 / D2_00018: Depreciação acumulada Bens Móveis (Anexo I-AB)
export const getDCA_DepreciacaoMoveis = (dca: any): number | null =>
  getDCAValue(dca, ['DCA-Anexo I-AB', 'Anexo I-AB'], '1\\.2\\.3\\.8\\.1\\.01\\.00.*Deprecia[cç][ãa]o Acumulada.*Bens M[oó]veis');

// D2_00019 / D2_00021: Bens Imóveis (Anexo I-AB)
export const getDCA_BensImoveis = (dca: any): number | null =>
  getDCAValue(dca, ['DCA-Anexo I-AB', 'Anexo I-AB'], '1\\.2\\.3\\.2\\.1\\.00\\.00.*Bens Im[oó]veis');

// D2_00020 / D2_00021: Depreciação acumulada Bens Imóveis (Anexo I-AB)
export const getDCA_DepreciacaoImoveis = (dca: any): number | null =>
  getDCAValue(dca, ['DCA-Anexo I-AB', 'Anexo I-AB'], '1\\.2\\.3\\.8\\.1\\.02\\.00.*Deprecia[cç][ãa]o Acumulada.*Bens Im[oó]veis');
// =============================================================================
// Lote 3: DCA (Regras D2)
// =============================================================================

export const checkDCA_SaldosNegativosNivel = (dca: any, sheetNames: string[], nivelRegex: RegExp): { row: string; value: number }[] => {
  const results: { row: string; value: number }[] = [];
  const sheet = getSheet(dca, sheetNames);
  if (!sheet) return results;

  for (const row of sheet) {
    if (Array.isArray(row) && typeof row[0] === 'string') {
      const desc = row[0].trim();
      // O padrão típico PCASP: "X.X.X.0.0.00.00"
      if (nivelRegex.test(desc)) {
        for (let i = 1; i < row.length; i++) {
          if (typeof row[i] === 'number' && row[i] < 0) {
            results.push({ row: desc, value: row[i] });
            break;
          }
        }
      }
    }
  }
  return results;
};

// I-D Despesas Totais
export const getDCA_DespesasTotais = (dca: any): { empenhadas: number, liquidadas: number, pagas: number, rpnp: number, rpp: number } | null => {
  const sheet = getSheet(dca, ['DCA-Anexo I-D', 'Anexo I-D']);
  if (!sheet) return null;
  const headerIdx = sheet.findIndex((r: any[]) => r.some(c => typeof c === 'string' && c.includes('Despesas Empenhadas')));
  if (headerIdx === -1) return null;
  const header = sheet[headerIdx];
  const colEmp = header.findIndex((c: any) => typeof c === 'string' && c.includes('Empenhadas'));
  const colLiq = header.findIndex((c: any) => typeof c === 'string' && c.includes('Liquidadas'));
  const colPag = header.findIndex((c: any) => typeof c === 'string' && c.includes('Pagas'));
  // Fallback para as colunas se não achar perfeitamente por string
  let idxEmp = colEmp !== -1 ? colEmp : 1;
  let idxLiq = colLiq !== -1 ? colLiq : 2;
  let idxPag = colPag !== -1 ? colPag : 3;
  let idxRpnp = 4; // Posição padrão
  let idxRpp = 5; // Posição padrão

  for (const row of sheet) {
    if (Array.isArray(row) && typeof row[0] === 'string' && row[0].includes('Total Geral da Despesa')) {
      return {
        empenhadas: typeof row[idxEmp] === 'number' ? row[idxEmp] : 0,
        liquidadas: typeof row[idxLiq] === 'number' ? row[idxLiq] : 0,
        pagas: typeof row[idxPag] === 'number' ? row[idxPag] : 0,
        rpnp: typeof row[idxRpnp] === 'number' ? row[idxRpnp] : 0,
        rpp: typeof row[idxRpp] === 'number' ? row[idxRpp] : 0
      };
    }
  }
  return null;
};

// I-AB: Créditos a Curto e Longo Prazos
export const getDCA_CreditosCurtoLongoPrazo = (dca: any): number | null =>
  getDCAValue(dca, ['DCA-Anexo I-AB', 'Anexo I-AB'], '^1\\.1\\.2\\.1|^1\\.1\\.2\\.2|^1\\.2\\.1\\.1');

export const getDCA_AjustePerdasCreditos = (dca: any): number | null =>
  getDCAValue(dca, ['DCA-Anexo I-AB', 'Anexo I-AB'], 'Ajuste de Perdas de Cr[ée]ditos a Curto Prazo|Ajuste de Perdas de Cr[ée]ditos a Longo Prazo');

// I-AB: Demais Créditos
export const getDCA_DemaisCreditos = (dca: any): number | null =>
  getDCAValue(dca, ['DCA-Anexo I-AB', 'Anexo I-AB'], '^1\\.1\\.2\\.3|^1\\.1\\.2\\.4|^1\\.1\\.2\\.5|^1\\.2\\.1\\.2');

export const getDCA_AjustePerdasDemaisCreditos = (dca: any): number | null =>
  getDCAValue(dca, ['DCA-Anexo I-AB', 'Anexo I-AB'], 'Ajuste de Perdas de Demais Cr[ée]ditos');

// I-HI: VPD Depreciação
export const getDCA_VPD_Depreciacao = (dca: any): number | null =>
  getDCAValue(dca, ['DCA-Anexo I-HI', 'Anexo I-HI'], '3\\.3\\.1\\.1\\.1\\.00\\.00.*Deprecia[cç][ãa]o');

// I-AB: Passivos
export const getDCA_PassivoCirculanteFinanceiro = (dca: any): number | null =>
  getDCAValue(dca, ['DCA-Anexo I-AB', 'Anexo I-AB'], '^2\\.1\\.0\\.0\\.0\\.00\\.00.*Financeiro');

export const getDCA_PassivoCirculante = (dca: any): number | null =>
  getDCAValue(dca, ['DCA-Anexo I-AB', 'Anexo I-AB'], '^2\\.1\\.0\\.0\\.0\\.00\\.00.*Passivo Circulante$');

// I-AB: Dívida Ativa
export const getDCA_AjusteDividaAtiva = (dca: any): number | null =>
  getDCAValue(dca, ['DCA-Anexo I-AB', 'Anexo I-AB'], 'Ajuste de Perdas de D[ií]vida Ativa');

// I-C: Deduções negativas
export const checkDCA_DeducoesNegativas = (dca: any): { row: string; value: number }[] => {
  const results: { row: string; value: number }[] = [];
  const sheet = getSheet(dca, ['DCA-Anexo I-C', 'Anexo I-C']);
  if (!sheet) return results;
  const headerIdx = sheet.findIndex((r: any[]) => r.some(c => typeof c === 'string' && c.includes('Receitas Brutas Realizadas')));
  if (headerIdx === -1) return results;
  const colsDeducao = sheet[headerIdx].map((c: any, i: number) => typeof c === 'string' && c.toLowerCase().includes('dedu') ? i : -1).filter((i: number) => i !== -1);
  if (colsDeducao.length === 0) return results;

  for (let i = headerIdx + 1; i < sheet.length; i++) {
    const row = sheet[i];
    if (Array.isArray(row) && typeof row[0] === 'string') {
      for (const colIdx of colsDeducao) {
        if (typeof row[colIdx] === 'number' && row[colIdx] < 0) {
          results.push({ row: row[0].trim(), value: row[colIdx] });
          break;
        }
      }
    }
  }
  return results;
};

// I-AB: Créditos Previdenciários
export const getDCA_CreditosPrevidenciarios = (dca: any): number | null =>
  getDCAValue(dca, ['DCA-Anexo I-AB', 'Anexo I-AB'], 'Cr[ée]ditos Previdenci[áa]rios');

// I-AB: Intangível
export const getDCA_AtivoIntangivel = (dca: any): number | null =>
  getDCAValue(dca, ['DCA-Anexo I-AB', 'Anexo I-AB'], '^1\\.2\\.4\\.0\\.0\\.00\\.00|^1\\.2\\.4\\..*Intang[íi]vel');

export const getDCA_AmortizacaoIntangivel = (dca: any): number | null =>
  getDCAValue(dca, ['DCA-Anexo I-AB', 'Anexo I-AB'], 'Amortiza[cç][ãa]o Acumulada.*Intang[íi]vel');

// I-AB: Estoques
export const getDCA_Estoques = (dca: any): number | null =>
  getDCAValue(dca, ['DCA-Anexo I-AB', 'Anexo I-AB'], '^1\\.1\\.3\\.0\\.0\\.00\\.00|^1\\.1\\.3\\..*Estoques');

export const getDCA_AjustePerdasEstoques = (dca: any): number | null =>
  getDCAValue(dca, ['DCA-Anexo I-AB', 'Anexo I-AB'], 'Ajuste de Perdas de Estoques');
// =============================================================================
// Lote 4: Cruzamentos D3 (RREO e RGF)
// =============================================================================

// RREO Anexo 06
export const getDespesasAnexo06 = (rreo: any): number | null =>
  extractByColumnFromReport(rreo, ['RREO-Anexo 06', 'RREO Anexo 06'], 'Despesas Orçamentárias', 'Despesas Liquidadas Até o Bimestre');

export const getReceitasAnexo06 = (rreo: any): number | null =>
  extractByColumnFromReport(rreo, ['RREO-Anexo 06', 'RREO Anexo 06'], 'Receitas Orçamentárias', 'Receitas Realizadas Até o Bimestre');

// RREO Anexo 09
export const getInvestimentos_A09 = (rreo: any): number | null =>
  extractByColumnFromReport(rreo, ['RREO-Anexo 09', 'RREO Anexo 09'], 'Investimentos', 'Despesas Liquidadas Até o Bimestre');

export const getInversoesFinanceiras_A09 = (rreo: any): number | null =>
  extractByColumnFromReport(rreo, ['RREO-Anexo 09', 'RREO Anexo 09'], 'Inversões Financeiras', 'Despesas Liquidadas Até o Bimestre');

export const getAmortizacaoDivida_A09 = (rreo: any): number | null =>
  extractByColumnFromReport(rreo, ['RREO-Anexo 09', 'RREO Anexo 09'], 'Amortização da Dívida', 'Despesas Liquidadas Até o Bimestre');

export const getOperacoesCredito_A09 = (rreo: any): number | null =>
  extractByColumnFromReport(rreo, ['RREO-Anexo 09', 'RREO Anexo 09'], 'Operações de Crédito', 'Receitas Realizadas Até o Bimestre');

// RREO Anexo 01 Despesas de Capital (para bater com Anexo 09)
export const getInvestimentos_A01 = (rreo: any): number | null =>
  extractByColumnFromReport(rreo, ['RREO-Anexo 01', 'RREO Anexo 01'], 'Investimentos', 'Despesas Liquidadas Até o Bimestre');

export const getInversoesFinanceiras_A01 = (rreo: any): number | null =>
  extractByColumnFromReport(rreo, ['RREO-Anexo 01', 'RREO Anexo 01'], 'Inversões Financeiras', 'Despesas Liquidadas Até o Bimestre');

export const getAmortizacaoDivida_A01 = (rreo: any): number | null =>
  extractByColumnFromReport(rreo, ['RREO-Anexo 01', 'RREO Anexo 01'], 'Amortização da Dívida', 'Despesas Liquidadas Até o Bimestre');

export const getOperacoesCredito_A01 = (rreo: any): number | null =>
  extractByColumnFromReport(rreo, ['RREO-Anexo 01', 'RREO Anexo 01'], 'Operações de Crédito', 'Receitas Realizadas Até o Bimestre');

// RGF Anexo 05
export const getCaixaTotal_A05_RGF = (rgf: any): number | null =>
  extractFromReport(rgf, ['RGF-Anexo 05', 'RGF Anexo 05'], 'TOTAL DOS RECURSOS VINCULADOS \\(I\\)');

export const getCaixaTotalNaoVinculado_A05_RGF = (rgf: any): number | null =>
  extractFromReport(rgf, ['RGF-Anexo 05', 'RGF Anexo 05'], 'TOTAL DOS RECURSOS NÃO VINCULADOS \\(II\\)');

export const getRPNP_A05_RGF_Total = (rgf: any): number | null => {
  const v1 = extractFromReport(rgf, ['RGF-Anexo 05', 'RGF Anexo 05'], 'Restos a Pagar Empenhados e Não Liquidados do Exercício');
  if (v1 === null) return null;
  return v1; // Simplificado temporariamente
};

export const getRPP_A05_RGF_Total = (rgf: any): number | null => {
  const v1 = extractFromReport(rgf, ['RGF-Anexo 05', 'RGF Anexo 05'], 'Restos a Pagar Liquidados e Não Pagos');
  if (v1 === null) return null;
  return v1; // Simplificado temporariamente
};

// ─── DCA Cruzamentos RREO ────────────────────────────────────────────────────

export const getDCA_ReceitasAlienacao = (dca: any): number | null =>
  extractByColumnFromReport(dca, ['DCA-Anexo I-C', 'Anexo I-C'], '2\\.2\\.0.*Aliena[cç][ãa]o de Bens|Aliena[cç][ãa]o de Ativos', 'Receitas Brutas Realizadas|Receitas.*Realizadas');

export const getDCA_TransferenciasMunicipais = (dca: any): number | null => {
  const fpm = extractByColumnFromReport(dca, ['DCA-Anexo I-C', 'Anexo I-C'], '1\\.7\\.1\\.8\\.01.*Cota-Parte do FPM|Cota-Parte do FPM', 'Receitas Brutas Realizadas|Receitas.*Realizadas') || 0;
  const icms = extractByColumnFromReport(dca, ['DCA-Anexo I-C', 'Anexo I-C'], '1\\.7\\.2\\.8\\.01.*Cota-Parte do ICMS|Cota-Parte do ICMS', 'Receitas Brutas Realizadas|Receitas.*Realizadas') || 0;
  const ipva = extractByColumnFromReport(dca, ['DCA-Anexo I-C', 'Anexo I-C'], '1\\.7\\.2\\.8\\.01.*Cota-Parte do IPVA|Cota-Parte do IPVA', 'Receitas Brutas Realizadas|Receitas.*Realizadas') || 0;
  const itr = extractByColumnFromReport(dca, ['DCA-Anexo I-C', 'Anexo I-C'], '1\\.7\\.1\\.8\\.06.*Cota-Parte do ITR|Cota-Parte do ITR', 'Receitas Brutas Realizadas|Receitas.*Realizadas') || 0;
  const fundeb = getDCA_ReceitasFundeb(dca) || 0;
  const total = fpm + icms + ipva + itr + fundeb;
  return total > 0 ? total : null;
};

export const getDCA_ContribuicoesServidores = (dca: any): number | null =>
  extractByColumnFromReport(dca, ['DCA-Anexo I-C', 'Anexo I-C'], '1\\.2\\.1.*Contribui[cç][õo]es.*Servidor|Contribui[cç][õo]es dos Servidores', 'Receitas Brutas Realizadas|Receitas.*Realizadas');

export const getDCA_DespesasCapital = (dca: any): number | null =>
  getDCAValue(dca, ['DCA-Anexo I-D', 'Anexo I-D'], '4\\.0\\.00\\.00\\.00\\.00.*Despesas de Capital');

export const getReceitasAlienacao_A11 = (rreo: any): number | null =>
  extractFromReport(rreo, ['RREO-Anexo 11', 'RREO Anexo 11'], 'RECEITAS DE ALIENAÇÃO DE ATIVOS.*\\(I\\)|ALIENAÇÃO DE ATIVOS');

export const getTributosMunicipais_A06 = (rreo: any): number | null =>
  extractByColumnFromReport(rreo, ['RREO-Anexo 06', 'RREO Anexo 06'], 'RECEITA DE IMPOSTOS.*TAXAS E CONTRIBUIÇÕES DE MELHORIA|Impostos, Taxas e Contribuições de Melhoria', 'Até o Bimestre|Bimestre');

export const getTransferenciasMunicipais_A06 = (rreo: any): number | null => {
  const fpm = extractByColumnFromReport(rreo, ['RREO-Anexo 06', 'RREO Anexo 06'], 'Cota-Parte.*FPM', 'Até o Bimestre|Bimestre') || 0;
  const icms = extractByColumnFromReport(rreo, ['RREO-Anexo 06', 'RREO Anexo 06'], 'Cota-Parte.*ICMS', 'Até o Bimestre|Bimestre') || 0;
  const ipva = extractByColumnFromReport(rreo, ['RREO-Anexo 06', 'RREO Anexo 06'], 'Cota-Parte.*IPVA', 'Até o Bimestre|Bimestre') || 0;
  const itr = extractByColumnFromReport(rreo, ['RREO-Anexo 06', 'RREO Anexo 06'], 'Cota-Parte.*ITR', 'Até o Bimestre|Bimestre') || 0;
  const fundeb = extractByColumnFromReport(rreo, ['RREO-Anexo 06', 'RREO Anexo 06'], 'Transfer[êe]ncias.*FUNDEB', 'Até o Bimestre|Bimestre') || 0;
  const lc87 = extractByColumnFromReport(rreo, ['RREO-Anexo 06', 'RREO Anexo 06'], 'Transfer[êe]ncias.*LC.*87', 'Até o Bimestre|Bimestre') || 0;
  const lc61 = extractByColumnFromReport(rreo, ['RREO-Anexo 06', 'RREO Anexo 06'], 'Transfer[êe]ncias.*LC.*61', 'Até o Bimestre|Bimestre') || 0;
  
  const total = fpm + icms + ipva + itr + fundeb + lc87 + lc61;
  return total > 0 ? total : null;
};

export const getContribuicoesServidores_A03 = (rreo: any): number | null =>
  extractByColumnFromReport(rreo, ['RREO-Anexo 03', 'RREO Anexo 03'], 'Contribui[cç][õo]es', 'Até o Bimestre|Bimestre');

export const getDespesasCapital_A09 = (rreo: any): number | null =>
  extractByColumnFromReport(rreo, ['RREO-Anexo 09', 'RREO Anexo 09'], 'DESPESAS DE CAPITAL', 'Despesas Empenhadas');

// ─── Lote 7: D4_00028, D4_00036, D4_00037, D4_00043 (Caixa e Consórcios RGF/DCA) ───
export const getDCA_CaixaEquivalentes = (dca: any): number | null =>
  getDCAValue(dca, ['DCA-Anexo I-AB', 'Anexo I-AB'], '^[1-9]\\.1\\.1\\.0\\.0\\.00\\.00|^1\\.1\\.1\\..*Caixa e Equivalentes');

export const getDisponibilidadeCaixaBruta_A02_RGF = (rgf: any): number | null =>
  extractFromReport(rgf, ['RGF-Anexo 02', 'RGF Anexo 02'], 'Disponibilidade de Caixa Bruta');

export const getDisponibilidadeCaixaBruta_A05_RGF = (rgf: any): number | null => {
  let val = extractFromReport(rgf, ['RGF-Anexo 05', 'RGF Anexo 05'], 'TOTAL DA DISPONIBILIDADE DE CAIXA E EQUIVALENTES DE CAIXA');
  if (val === null) {
    const v1 = getCaixaTotal_A05_RGF(rgf) || 0;
    const v2 = getCaixaTotalNaoVinculado_A05_RGF(rgf) || 0;
    if (v1 || v2) val = v1 + v2;
  }
  return val;
};

export const getConsorciosPublicos_A05_RGF = (rgf: any): number | null =>
  extractFromReport(rgf, ['RGF-Anexo 05', 'RGF Anexo 05'], 'Cons[óo]rcios P[úu]blicos|Valores vinculados a cons[óo]rcios p[úu]blicos');

// ─── Lote Final: D4 DCA vs RREO ───
export const getDCA_ReceitaRealizadaTotal_IC = (dca: any): number | null =>
  extractByColumnFromReport(dca, ['DCA-Anexo I-C', 'Anexo I-C'], 'TOTAL DAS RECEITAS', 'Receitas Brutas Realizadas|Receitas.*Realizadas');

export const getTotalReceitas_A01 = (rreo: any): number | null =>
  extractByColumnFromReport(rreo, ['RREO-Anexo 01', 'RREO Anexo 01'], 'TOTAL DAS RECEITAS', 'At[ée] o Bimestre|Bimestre');

export const getDCA_DespesaFuncaoExcetoIntra_IE = (dca: any): number | null =>
  extractByColumnFromReport(dca, ['DCA-Anexo I-E', 'Anexo I-E'], 'TOTAL.*EXCETO INTRA', 'Despesas Liquidadas');

export const getDCA_RP_Pagos_IF = (dca: any): number | null =>
  extractByColumnFromReport(dca, ['DCA-Anexo I-F', 'Anexo I-F'], 'TOTAL', 'Pagos');

export const getDCA_RPNP_Pagos_IG = (dca: any): number | null =>
  extractByColumnFromReport(dca, ['DCA-Anexo I-G', 'Anexo I-G'], 'TOTAL', 'Pagos');

export const getTotalRPPagos_A07_RPP = (rreo: any): number | null =>
  extractByColumnFromReport(rreo, ['RREO-Anexo 07', 'RREO Anexo 07'], 'RESTOS A PAGAR PROCESSADOS.*\(I\)', 'Pagos');

export const getTotalRPPagos_A07_RPNP = (rreo: any): number | null =>
  extractByColumnFromReport(rreo, ['RREO-Anexo 07', 'RREO Anexo 07'], 'RESTOS A PAGAR N[ÃA]O PROCESSADOS.*\(II\)', 'Pagos');

export const getDCA_PassivoFinanceiro = (dca: any): number | null =>
  getDCAValue(dca, ['DCA-Anexo I-AB', 'Anexo I-AB'], '^2\\.1\\.0\\.0\\.0\\.00\\.00.*Financeiro');

export const getTotalRPInscritos_A07 = (rreo: any): number | null =>
  extractByColumnFromReport(rreo, ['RREO-Anexo 07', 'RREO Anexo 07'], 'TOTAL\\s*\\(III\\)\\s*=\\s*\\(I\\s*\\+\\s*II\\)', 'Inscritos.*Exerc[ií]cios Anteriores');

export const getTotalRPInscritos31Dez_A07 = (rreo: any): number | null =>
  extractByColumnFromReport(rreo, ['RREO-Anexo 07', 'RREO Anexo 07'], 'TOTAL\\s*\\(III\\)\\s*=\\s*\\(I\\s*\\+\\s*II\\)', 'Inscritos.*31 de dezembro');

