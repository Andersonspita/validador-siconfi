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
          else if (isMSCXbrl(parsedXml)) {
            // MSC entregue em XBRL-GL (formato padrão do SICONFI). Antes desta
            // correção era silenciosamente descartada, e nenhuma regra rodava.
            const { accounts, period, enteId } = parseMSCXBRL(parsedXml);
            if (enteId) result.enteId = enteId;
            storeMSC(result, accounts, period);
          }

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
      else if (isMSCXbrl(parsedXml)) {
        const { accounts, period, enteId } = parseMSCXBRL(parsedXml);
        if (enteId) result.enteId = enteId;
        storeMSC(result, accounts, period);
      }

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
          const ai = findIcByTipo('AI') ?? getVal('AI');

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
            AI: ai,
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

/**
 * Detecta se um documento XML já parseado (fast-xml-parser) é uma MSC em XBRL-GL.
 * A MSC do SICONFI é entregue nesse formato (xbrli:xbrl + gl-cor:accountingEntries),
 * e NÃO como CSV. Antes desta correção o arquivo era parseado e descartado, pois
 * o roteamento só reconhecia nomes contendo "rreo"/"rgf"/"dca".
 */
export const isMSCXbrl = (parsedXml: any): boolean => {
  const root = parsedXml?.['xbrli:xbrl'] ?? parsedXml?.xbrl;
  if (!root) return false;
  return !!(root['gl-cor:accountingEntries'] ?? root.accountingEntries);
};

const asArray = <T,>(v: T | T[] | undefined): T[] =>
  v === undefined ? [] : Array.isArray(v) ? v : [v];

// Extrai o texto de um nó que pode vir como string ou como objeto { '#text': ... }
const nodeText = (v: any): string | undefined => {
  if (v === undefined || v === null) return undefined;
  if (typeof v === 'object') {
    const t = v['#text'];
    return t === undefined || t === null ? undefined : String(t).trim();
  }
  const s = String(v).trim();
  return s === '' ? undefined : s;
};

/**
 * Converte uma MSC em XBRL-GL (já parseada pelo fast-xml-parser) para o mesmo
 * shape { accounts, period, enteId } produzido por parseMSCWithMeta, de modo que
 * o restante do pipeline de validação funcione sem alterações.
 */
export const parseMSCXBRL = (
  parsedXml: any
): { accounts: MSCAccount[]; period: string | null; enteId: string | null } => {
  const root = parsedXml['xbrli:xbrl'] ?? parsedXml.xbrl;
  const entries = root['gl-cor:accountingEntries'] ?? root.accountingEntries;

  // Ente: xbrli:context > xbrli:entity > xbrli:identifier (código IBGE, ex.: 2916807EX)
  let enteId: string | null = null;
  const contexts = asArray(root['xbrli:context'] ?? root.context);
  for (const ctx of contexts) {
    const ident = ctx?.['xbrli:entity']?.['xbrli:identifier'] ?? ctx?.entity?.identifier;
    const raw = nodeText(ident);
    if (raw) { enteId = normalizeEnteId(raw) || raw; break; }
  }

  // Período: gl-bus:periodIdentifier (YYYY-MM) ou derivado de periodEnd (YYYY-MM-DD)
  let period: string | null = null;
  const ei = entries?.['gl-cor:entityInformation'] ?? entries?.entityInformation;
  const cal = ei?.['gl-bus:reportingCalendar'] ?? ei?.reportingCalendar;
  const calPeriod = cal?.['gl-bus:reportingCalendarPeriod'] ?? cal?.reportingCalendarPeriod;
  const periodId = nodeText(calPeriod?.['gl-bus:periodIdentifier'] ?? calPeriod?.periodIdentifier);
  const periodEnd = nodeText(calPeriod?.['gl-bus:periodEnd'] ?? calPeriod?.periodEnd);
  if (periodId && /^\d{4}-\d{1,2}$/.test(periodId)) {
    const [y, m] = periodId.split('-');
    period = `${y}-${m.padStart(2, '0')}`;
  } else if (periodEnd && /^\d{4}-\d{2}-\d{2}$/.test(periodEnd)) {
    period = periodEnd.slice(0, 7);
  }

  // xbrlInclude -> Tipo_valor da MSC
  const TIPO_MAP: Record<string, MSCAccount['Tipo_valor']> = {
    beginning_balance: 'beginning_balance',
    period_change: 'period_change',
    ending_balance: 'ending_balance',
  };

  const accounts: MSCAccount[] = [];
  const headers = asArray(entries?.['gl-cor:entryHeader'] ?? entries?.entryHeader);

  for (const header of headers) {
    const details = asArray(header?.['gl-cor:entryDetail'] ?? header?.entryDetail);
    for (const d of details) {
      const acc = d['gl-cor:account'] ?? d.account;
      if (!acc) continue;
      const conta = nodeText(acc['gl-cor:accountMainID'] ?? acc.accountMainID);
      if (!conta) continue;

      const subs: Record<string, string | undefined> = {};
      for (const sub of asArray(acc['gl-cor:accountSub'] ?? acc.accountSub)) {
        const type = nodeText(sub['gl-cor:accountSubType'] ?? sub.accountSubType);
        const id = nodeText(sub['gl-cor:accountSubID'] ?? sub.accountSubID);
        if (type) subs[type] = id;
      }

      const valorRaw = nodeText(d['gl-cor:amount'] ?? d.amount);
      const dc = nodeText(d['gl-cor:debitCreditCode'] ?? d.debitCreditCode);
      const xbrlInfo = d['gl-cor:xbrlInfo'] ?? d.xbrlInfo;
      const inc = nodeText(xbrlInfo?.['gl-cor:xbrlInclude'] ?? xbrlInfo?.xbrlInclude);

      const tipo = inc ? TIPO_MAP[inc] : undefined;
      if (!tipo) continue; // ignora linhas sem tipo de saldo reconhecido

      accounts.push({
        CONTA: conta,
        PO: subs['PO'],
        FP: subs['FP'],
        FS: subs['FS'],
        FR: subs['FR'],
        CO: subs['CO'],
        ND: subs['ND'],
        Valor: valorRaw ? (parseFloat(valorRaw) || 0) : 0,
        Tipo_valor: tipo,
        Natureza_valor: (dc === 'D' ? 'D' : 'C'),
      });
    }
  }

  return { accounts, period, enteId };
};
