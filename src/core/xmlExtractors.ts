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

// Busca o valor em uma linha da planilha pelo texto + índice absoluto de coluna.
// Necessário quando a planilha tem múltiplas colunas (ex: col[5] = "Receitas Realizadas Até o Bimestre").
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

export const extractByColumnFromReport = (
  report: any, sheetCandidates: string[], rowTerm: string, colIndex: number
): number | null => {
  const sheet = getSheet(report, sheetCandidates);
  return sheet ? findValueByColumnIndex(sheet, rowTerm, colIndex) : null;
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

// ─── RREO Anexo 04 (RPPS) ────────────────────────────────────────────────────

// D3_00030: Total receitas do RPPS (Fundo em Capitalização) — Anexo 04
export const getTotalReceitasRPPS_A04 = (rreo: any): number | null =>
  extractFromReport(rreo, ['RREO-Anexo 04', 'RREO Anexo 04'], 'TOTAL DAS RECEITAS DO FUNDO.*\\(IV\\)');

// D3_00030: Receitas com fontes RPPS no Anexo 06 (soma das linhas com FONTES RPPS)
export const getReceitasRPPS_A06 = (rreo: any): number | null =>
  extractFromReport(rreo, ['RREO-Anexo 06', 'RREO Anexo 06'], 'RECEITAS PRIMÁRIAS CORRENTES.*COM FONTES RPPS.*\\(V\\)|RECEITAS.*COM FONTES RPPS.*\\(V\\)');

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
// A01: "SUBTOTAL DAS RECEITAS (III)" col[5] = Receitas Realizadas Até o Bimestre
export const getReceitasRealizadasTotal_A01 = (rreo: any): number | null =>
  extractByColumnFromReport(rreo, ['RREO-Anexo 01', 'RREO Anexo 01'], 'SUBTOTAL DAS RECEITAS.*\\(III\\)', 5);

// A06: "RECEITA PRIMÁRIA TOTAL (XVI)" col[2] = Receitas Realizadas
// Nota: A06 exclui fontes RPPS; para municípios com RPPS, os valores podem diferir levemente.
export const getReceitasRealizadasTotal_A06 = (rreo: any): number | null =>
  extractByColumnFromReport(rreo, ['RREO-Anexo 06', 'RREO Anexo 06'], 'RECEITA PRIMÁRIA TOTAL.*\\(XVI\\)', 2);

// D3_00027: Dotação atualizada e Despesas Empenhadas/Liquidadas — para comparação A01 × A06
// A01 col indices: [2]=DotAtual, [4]=EmpenhAté, [7]=LiquidAté
export const getDotacaoAtualizada_A01 = (rreo: any): number | null =>
  extractByColumnFromReport(rreo, ['RREO-Anexo 01', 'RREO Anexo 01'], 'SUBTOTAL DAS DESPESAS.*\\(X\\)', 2);
export const getDespesasEmpenhadas_A01 = (rreo: any): number | null =>
  extractByColumnFromReport(rreo, ['RREO-Anexo 01', 'RREO Anexo 01'], 'SUBTOTAL DAS DESPESAS.*\\(X\\)', 4);
export const getDespesasLiquidadas_A01 = (rreo: any): number | null =>
  extractByColumnFromReport(rreo, ['RREO-Anexo 01', 'RREO Anexo 01'], 'SUBTOTAL DAS DESPESAS.*\\(X\\)', 7);

// A06 col indices: [1]=DotAtual, [2]=EmpenhAté, [3]=LiquidAté
export const getDotacaoAtualizada_A06 = (rreo: any): number | null =>
  extractByColumnFromReport(rreo, ['RREO-Anexo 06', 'RREO Anexo 06'], 'DESPESA PRIMÁRIA TOTAL.*\\(XXXII\\)', 1);
export const getDespesasEmpenhadas_A06 = (rreo: any): number | null =>
  extractByColumnFromReport(rreo, ['RREO-Anexo 06', 'RREO Anexo 06'], 'DESPESA PRIMÁRIA TOTAL.*\\(XXXII\\)', 2);
export const getDespesasLiquidadas_A06 = (rreo: any): number | null =>
  extractByColumnFromReport(rreo, ['RREO-Anexo 06', 'RREO Anexo 06'], 'DESPESA PRIMÁRIA TOTAL.*\\(XXXII\\)', 3);

// D3_00022: Receitas Correntes (exceto intra) — col[5] = Realizadas Até o Bimestre
export const getReceitasCorrentes_A01 = (rreo: any): number | null =>
  extractByColumnFromReport(rreo, ['RREO-Anexo 01', 'RREO Anexo 01'], 'RECEITAS CORRENTES\\s*$|^\\s+RECEITAS CORRENTES\\s+$', 5);

// D3_00023: Receitas de Capital (exceto intra) — col[5]
export const getReceitasCapital_A01 = (rreo: any): number | null =>
  extractByColumnFromReport(rreo, ['RREO-Anexo 01', 'RREO Anexo 01'], 'RECEITAS DE CAPITAL', 5);

// D3_00024: Despesas Correntes (exceto intra) — col[7] = Liquidadas Até o Bimestre
export const getDespesasCorrentes_A01 = (rreo: any): number | null =>
  extractByColumnFromReport(rreo, ['RREO-Anexo 01', 'RREO Anexo 01'], 'DESPESAS CORRENTES\\s*$|^\\s+DESPESAS CORRENTES\\s+$', 7);

// D3_00025: Despesas de Capital (exceto intra) — col[7]
export const getDespesasCapital_A01 = (rreo: any): number | null =>
  extractByColumnFromReport(rreo, ['RREO-Anexo 01', 'RREO Anexo 01'], 'DESPESAS DE CAPITAL', 7);

// D4_00025: Despesas empenhadas/liquidadas/pagas — col[4]=emp, col[7]=liq, col[9]=pagas
export const getDespesasEmpenhadas_SubtotalA01 = (rreo: any): number | null =>
  extractByColumnFromReport(rreo, ['RREO-Anexo 01', 'RREO Anexo 01'], 'SUBTOTAL DAS DESPESAS.*\\(X\\)', 4);
export const getDespesasLiquidadas_SubtotalA01 = (rreo: any): number | null =>
  extractByColumnFromReport(rreo, ['RREO-Anexo 01', 'RREO Anexo 01'], 'SUBTOTAL DAS DESPESAS.*\\(X\\)', 7);
export const getDespesasPagas_SubtotalA01 = (rreo: any): number | null =>
  extractByColumnFromReport(rreo, ['RREO-Anexo 01', 'RREO Anexo 01'], 'SUBTOTAL DAS DESPESAS.*\\(X\\)', 9);

// D4_00025/026: valores para cruzamento MSC × RREO (A01)
// A01: Inscrições em RPNP (col[10] do subtotal de despesas)
export const getRPNP_inscricoes_A01 = (rreo: any): number | null =>
  extractByColumnFromReport(rreo, ['RREO-Anexo 01', 'RREO Anexo 01'], 'SUBTOTAL DAS DESPESAS.*\\(X\\)', 10);

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
// Nota: Anexo 07 tem múltiplas colunas; "TOTAL (III)" retorna a primeira, que pode não ser "Pagos".
// Implementação completa pendente de mapeamento de colunas.
// export const getTotalRPPagos_A07 = ...

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
  startColOffset: number = 1
): number | null => {
  const sheet = getSheet(dca, sheetNames);
  if (!sheet) return null;
  return findValueInSheet(sheet, searchTerm, startColOffset);
};
