import Papa from 'papaparse';
import JSZip from 'jszip';
import { XMLParser } from 'fast-xml-parser';
import * as XLSX from 'xlsx';
import { ParsedData, MSCAccount, XLSReport } from './types';

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_"
});

/** Detecta encoding e decodifica bytes de MSC CSV (UTF-8, windows-1252, iso-8859-1).
 *  Lança erro explícito se o conteúdo não for uma MSC SICONFI válida (sem cabeçalho CONTA;).
 *  Correção QA-002/QA-004.
 */
export function decodeTextFromBytes(bytes: Uint8Array): string {
  const tryDecode = (label: string): string | null => {
    try {
      const text = new TextDecoder(label).decode(bytes);
      if (text.includes('CONTA;') || text.includes('conta;')) return text.replace(/^\uFEFF/, '');
      return null;
    } catch {
      return null;
    }
  };

  const result = tryDecode('utf-8') ?? tryDecode('windows-1252') ?? tryDecode('iso-8859-1');
  if (result) return result;

  // Fallback: retorna UTF-8 mas lança erro se não for uma MSC reconhecível
  const fallback = new TextDecoder('utf-8').decode(bytes).replace(/^\uFEFF/, '');
  if (!fallback.includes('CONTA;') && !fallback.includes('conta;')) {
    throw new Error(
      'Arquivo não reconhecido como MSC SICONFI. ' +
      'O cabeçalho "CONTA;" não foi encontrado. Verifique se o arquivo é uma MSC válida e se está no encoding correto.'
    );
  }
  return fallback;
}

/** Lê texto do arquivo tentando UTF-8, depois Windows-1252 / ISO-8859-1. */
export async function readTextWithEncoding(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  return decodeTextFromBytes(bytes);
}

const normalizeEnteId = (raw: string): string =>
  raw.replace(/[^0-9]/g, '').slice(0, 7);

const storeMSC = (result: ParsedData, parsed: MSCAccount[], period: string | null) => {
  if (period) {
    if (!result.mscPeriods!.includes(period)) {
      result.mscPeriods!.push(period);
    }
    if (!result.mscByPeriod) result.mscByPeriod = {};
    result.mscByPeriod[period] = parsed;
    result.anoReferencia = period.split('-')[0];
  } else {
    result.msc = result.msc ? result.msc.concat(parsed) : parsed;
  }
};

const rebuildAggregatedMsc = (result: ParsedData) => {
  if (result.mscByPeriod && Object.keys(result.mscByPeriod).length > 0) {
    result.msc = Object.values(result.mscByPeriod).flat();
    result.mscPeriods = Object.keys(result.mscByPeriod).sort();
  }
};

export const parseFiles = async (files: File[]): Promise<ParsedData> => {
  const result: ParsedData = { mscPeriods: [], mscByPeriod: {} };

  for (const file of files) {
    if (file.name.endsWith('.csv')) {
      const text = await readTextWithEncoding(file);
      const { accounts, period, enteId } = parseMSCWithMeta(text);
      if (enteId) result.enteId = enteId;
      storeMSC(result, await accounts, period);

    } else if (file.name.endsWith('.zip')) {
      const zip = new JSZip();
      const unzipped = await zip.loadAsync(file);

      for (const [filename, zipEntry] of Object.entries(unzipped.files)) {
        if (zipEntry.dir) continue;
        const lname = filename.toLowerCase();

        if (lname.endsWith('.xml')) {
          const xmlText = await zipEntry.async('string');
          const parsedXml = xmlParser.parse(xmlText);
          if (lname.includes('rreo')) result.rreo = parsedXml;
          else if (lname.includes('rgf')) result.rgf = parsedXml;
          else if (lname.includes('dca')) result.dca = parsedXml;

        } else if (lname.endsWith('.csv')) {
          // QA-002: usar arraybuffer para detecção de encoding (windows-1252 de sistemas legados)
          const csvBuffer = await zipEntry.async('arraybuffer');
          const csvBytes = new Uint8Array(csvBuffer);
          const csvText = decodeTextFromBytes(csvBytes);
          const { accounts, period, enteId } = parseMSCWithMeta(csvText);
          if (enteId) result.enteId = enteId;
          storeMSC(result, await accounts, period);

        } else if (lname.endsWith('.xls') || lname.endsWith('.xlsx')) {
          // QA-003: processar XLS/XLSX dentro de ZIP (antes eram silenciosamente ignorados)
          const xlsBuffer = await zipEntry.async('arraybuffer');
          const workbook = XLSX.read(xlsBuffer, { type: 'array', cellDates: true, dateNF: 'dd/mm/yyyy' });
          const parsedXls: XLSReport = {};
          workbook.SheetNames.forEach(sheetName => {
            parsedXls[sheetName] = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { header: 1, defval: '' });
          });
          if (lname.includes('rreo')) result.rreo = parsedXls;
          else if (lname.includes('rgf')) result.rgf = parsedXls;
          else if (lname.includes('dca')) result.dca = parsedXls;
        }
      }

    } else if (file.name.endsWith('.xml')) {
      const xmlText = await file.text();
      const parsedXml = xmlParser.parse(xmlText);
      const lname = file.name.toLowerCase();
      if (lname.includes('rreo')) result.rreo = parsedXml;
      else if (lname.includes('rgf')) result.rgf = parsedXml;
      else if (lname.includes('dca')) result.dca = parsedXml;

    } else if (file.name.endsWith('.xls') || file.name.endsWith('.xlsx')) {
      const buffer = await file.arrayBuffer();
      // QA-011: cellDates evita que datas virem número serial Excel
      const workbook = XLSX.read(buffer, { type: 'array', cellDates: true, dateNF: 'dd/mm/yyyy' });
      const parsedXls: XLSReport = {};
      workbook.SheetNames.forEach(sheetName => {
        parsedXls[sheetName] = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { header: 1, defval: '' });
      });
      const lname = file.name.toLowerCase();
      if (lname.includes('rreo')) result.rreo = parsedXls;
      else if (lname.includes('rgf')) result.rgf = parsedXls;
      else if (lname.includes('dca')) result.dca = parsedXls;
    }
  }

  rebuildAggregatedMsc(result);
  return result;
};

export const parseMSCWithMeta = (csvText: string): { accounts: Promise<MSCAccount[]>; period: string | null; enteId: string | null } => {
  const lines = csvText.split(/\r?\n/);
  let period: string | null = null;
  let enteId: string | null = null;

  if (lines.length > 0) {
    const firstLineParts = lines[0].split(';');
    if (firstLineParts.length >= 2) {
      const rawEnte = firstLineParts[0].trim();
      enteId = normalizeEnteId(rawEnte) || rawEnte;
      const candidate = firstLineParts[1].trim();
      if (/^\d{4}-\d{2}$/.test(candidate)) period = candidate;
    }
  }

  const startIdx = lines.findIndex(line => line.includes('CONTA;'));
  const cleanCsvText = startIdx >= 0 ? lines.slice(startIdx).join('\n') : csvText;

  const accounts = new Promise<MSCAccount[]>(resolve => {
    Papa.parse(cleanCsvText, {
      header: true,
      skipEmptyLines: true,
      delimiter: ';',
      complete: (results) => {
        const data: MSCAccount[] = results.data.map((row: any) => {
          const getVal = (key: string): string | undefined => {
            const foundKey = Object.keys(row).find(k => k.toLowerCase() === key.toLowerCase());
            const v = foundKey ? String(row[foundKey] ?? '').trim() : undefined;
            return v === '' ? undefined : v;
          };

          const parseValor = (raw: string | undefined): number => {
            if (!raw) return 0;
            const s = raw.trim();
            if (/e/i.test(s)) return parseFloat(s.replace(',', '.')) || 0;
            // Formato BR: 1.234,56 — remove separador de milhar e troca vírgula decimal
            if (s.includes(',')) {
              return parseFloat(s.replace(/\./g, '').replace(',', '.')) || 0;
            }
            // Formato SICONFI: 51729049.40
            return parseFloat(s) || 0;
          };

          const conta = getVal('CONTA') ?? '';
          const isDespOrcamentaria = conta.startsWith('622');

          const findIcByTipo = (tipoName: string): string | undefined => {
            for (let i = 1; i <= 6; i++) {
              if (getVal(`TIPO${i}`) === tipoName) {
                return getVal(`IC${i}`);
              }
            }
            return undefined;
          };

          let po = findIcByTipo('PO') ?? getVal('PO');
          let fp = findIcByTipo('FP') ?? getVal('FP');
          let fs = findIcByTipo('FS') ?? getVal('FS');
          let fr = findIcByTipo('FR') ?? getVal('FR');
          let co = findIcByTipo('CO') ?? getVal('CO');
          let nd = findIcByTipo('ND') ?? getVal('ND');

          const hasTipoCols = Object.keys(row).some(k => k.toUpperCase().startsWith('TIPO') && k.toUpperCase() !== 'TIPO_VALOR');

          if (!hasTipoCols) {
            if (!po) po = getVal('IC1');
            if (!fp && !isDespOrcamentaria) fp = getVal('IC2');
            if (!fs && isDespOrcamentaria) fs = getVal('IC2');
            if (!fr) fr = getVal('IC3');
            if (!co) co = getVal('IC4');
            if (!nd && isDespOrcamentaria) nd = getVal('IC5');
          }

          const valorRaw = getVal('VALOR') ?? getVal('Valor');
          const tipoRaw = getVal('TIPO_VALOR') ?? getVal('Tipo_valor');
          const naturezaRaw = getVal('NATUREZA_VALOR') ?? getVal('Natureza_valor');

          return {
            CONTA: conta,
            PO: po,
            FP: fp,
            FS: fs,
            FR: fr,
            CO: co,
            ND: nd,
            Valor: parseValor(valorRaw),
            Tipo_valor: tipoRaw as MSCAccount['Tipo_valor'],
            Natureza_valor: naturezaRaw as MSCAccount['Natureza_valor'],
          };
        });
        resolve(data);
      }
    });
  });

  return { accounts, period, enteId };
};
