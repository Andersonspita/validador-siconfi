/**
 * Extratores de dados dos demonstrativos fiscais (XLS/XML do Siconfi).
 * Todas as funções retornam `number | null`.
 * `null` significa que o dado não foi encontrado ou não pôde ser parseado —
 * o motor de validação deve pular a regra nesses casos (sem falso positivo).
 */

// Busca um valor numérico em uma planilha procurando o texto na primeira coluna.
// Aceita variações de acento (ex: LIQUIDA / LÍQUIDA) via regex case-insensitive.
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
      if (typeof row[i] === 'number' && row[i] !== 0) return row[i];
      if (typeof row[i] === 'string') {
        const parsed = parseFloat(row[i].replace(/\./g, '').replace(',', '.'));
        if (!isNaN(parsed) && parsed !== 0) return parsed;
      }
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

export const getRCLFromRREO = (rreo: any): number | null => {
  const sheet = getSheet(rreo, ['RREO-Anexo 03', 'RREO Anexo 03', 'Anexo 03']);
  if (!sheet) return null;
  // "RECEITA CORRENTE LÍQUIDA (III) = (I - II)"
  return findValueInSheet(sheet, 'RECEITA CORRENTE L[IÍ]QUIDA.*\\(III\\)');
};

export const getRCLFromRGF = (rgf: any): number | null => {
  const sheet = getSheet(rgf, ['RGF-Anexo 01', 'RGF Anexo 01', 'Anexo 01']);
  if (!sheet) return null;
  // "RECEITA CORRENTE LIQUIDA - RCL (IV)" ou "RECEITA CORRENTE LÍQUIDA - RCL"
  return findValueInSheet(sheet, 'RECEITA CORRENTE L[IÍ]QUIDA.*RCL|RECEITA CORRENTE L[IÍ]QUIDA');
};

export const getReceitasArrecadadasRREO = (rreo: any): number | null => {
  const sheet = getSheet(rreo, ['RREO-Anexo 01', 'RREO Anexo 01', 'Anexo 01']);
  if (!sheet) return null;
  // "RECEITAS (EXCETO INTRA-ORÇAMENTÁRIAS) (I)"
  return findValueInSheet(sheet, 'RECEITAS.*EXCETO INTRA', 1);
};

// Retorna todos os valores numéricos negativos presentes nas abas de um demonstrativo XLS
export const findNegativeValues = (report: any): { sheet: string; row: number; value: number; label: string }[] => {
  const found: { sheet: string; row: number; value: number; label: string }[] = [];
  for (const [sheetName, rows] of Object.entries(report)) {
    if (!Array.isArray(rows)) continue;
    (rows as any[][]).forEach((row, rowIdx) => {
      if (!Array.isArray(row)) return;
      const label = typeof row[0] === 'string' ? row[0].trim() : '';
      // Ignora linhas de total/subtotal (geralmente podem ter sinal oposto por convenção)
      if (/DEFICIT|DÉFICIT|SUPERÁV|RESULTADO/i.test(label)) return;
      for (let col = 1; col < row.length; col++) {
        const v = row[col];
        if (typeof v === 'number' && v < 0) {
          found.push({ sheet: sheetName, row: rowIdx + 1, value: v, label: label.slice(0, 60) });
          break; // um por linha é suficiente
        }
      }
    });
  }
  return found;
};

// RREO Anexo 01 — equilíbrio: TOTAL COM DÉFICIT (VII) e TOTAL COM SUPERÁVIT (XIV)
export const getEquilibrioOrcamentario = (rreo: any): { comDeficit: number | null; comSuperavit: number | null } => {
  const sheet = getSheet(rreo, ['RREO-Anexo 01', 'RREO Anexo 01']);
  if (!sheet) return { comDeficit: null, comSuperavit: null };
  return {
    comDeficit:   findValueInSheet(sheet, 'TOTAL COM D[EÉ]FICIT'),
    comSuperavit: findValueInSheet(sheet, 'TOTAL COM SUPER[AÁ]VIT'),
  };
};

// RREO Anexo 01 — total das despesas (exceto + intra)
export const getTotalDespesasAnexo01 = (rreo: any): number | null => {
  const sheet = getSheet(rreo, ['RREO-Anexo 01', 'RREO Anexo 01']);
  if (!sheet) return null;
  return findValueInSheet(sheet, 'SUBTOTAL DAS DESPESAS.*\\(X\\)');
};

// RREO Anexo 02 — total das despesas exceto intra (para comparar com Anexo 01)
export const getDespesasAnexo02 = (rreo: any): number | null => {
  const sheet = getSheet(rreo, ['RREO-Anexo 02', 'RREO Anexo 02']);
  if (!sheet) return null;
  return findValueInSheet(sheet, 'DESPESAS.*EXCETO INTRA.*\\(I\\)');
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
