import Papa from 'papaparse';
import JSZip from 'jszip';
import { XMLParser } from 'fast-xml-parser';
import * as XLSX from 'xlsx';
import { ParsedData, MSCAccount, XLSReport } from './types';

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_"
});

export const parseFiles = async (files: File[]): Promise<ParsedData> => {
  const result: ParsedData = { mscPeriods: [] };

  for (const file of files) {
    if (file.name.endsWith('.csv')) {
      const text = await file.text();
      const { accounts, period } = parseMSCWithMeta(text);
      const parsed = await accounts;
      result.msc = result.msc ? result.msc.concat(parsed) : parsed;
      if (period) result.mscPeriods!.push(period);

    } else if (file.name.endsWith('.zip')) {
      const zip = new JSZip();
      const unzipped = await zip.loadAsync(file);

      for (const [filename, zipEntry] of Object.entries(unzipped.files)) {
        if (zipEntry.dir) continue;
        const lname = filename.toLowerCase();

        if (lname.endsWith('.xml')) {
          const xmlText = await zipEntry.async("string");
          const parsedXml = xmlParser.parse(xmlText);
          if (lname.includes('rreo')) result.rreo = parsedXml;
          else if (lname.includes('rgf')) result.rgf = parsedXml;
          else if (lname.includes('dca')) result.dca = parsedXml;

        } else if (lname.endsWith('.csv')) {
          const csvText = await zipEntry.async("string");
          const { accounts, period } = parseMSCWithMeta(csvText);
          const parsed = await accounts;
          result.msc = result.msc ? result.msc.concat(parsed) : parsed;
          if (period) result.mscPeriods!.push(period);
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
      const workbook = XLSX.read(buffer, { type: 'array' });
      const parsedXls: XLSReport = {};
      workbook.SheetNames.forEach(sheetName => {
        parsedXls[sheetName] = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { header: 1 });
      });
      const lname = file.name.toLowerCase();
      if (lname.includes('rreo')) result.rreo = parsedXls;
      else if (lname.includes('rgf')) result.rgf = parsedXls;
      else if (lname.includes('dca')) result.dca = parsedXls;
    }
  }

  return result;
};

// Extrai o período (YYYY-MM) do cabeçalho do CSV da MSC antes de parsear as contas.
// Formato esperado da linha 1: "Codigo de Instituicao Siconfi;YYYY-MM;..."
const parseMSCWithMeta = (csvText: string): { accounts: Promise<MSCAccount[]>; period: string | null } => {
  const lines = csvText.split(/\r?\n/);
  let period: string | null = null;

  // Tenta extrair período da primeira linha antes do cabeçalho CONTA
  if (lines.length > 0) {
    const firstLineParts = lines[0].split(';');
    if (firstLineParts.length >= 2) {
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

          // IC2 pode ser FP (atributo superávit financeiro) ou FS (função/subfunção, contas 622xxx).
          // Prioridade: coluna TIPO2 da linha → fallback pelo prefixo da conta → fallback por nome de coluna legado.
          const conta = getVal('CONTA') ?? '';
          const tipo2 = getVal('TIPO2');
          const ic2   = getVal('IC2');
          const isDespOrcamentaria = conta.startsWith('622');
          const fp = tipo2 === 'FP' ? ic2
                   : tipo2 === 'FS' ? undefined
                   : !tipo2 && !isDespOrcamentaria ? ic2    // sem TIPO2: infere pelo prefixo
                   : undefined;
          const fs = tipo2 === 'FS' ? ic2
                   : tipo2 === 'FP' ? undefined
                   : !tipo2 && isDespOrcamentaria ? ic2     // sem TIPO2: infere pelo prefixo
                   : undefined;

          // IC5 é ND (natureza da despesa) para contas 622xxx.
          const tipo5 = getVal('TIPO5');
          const ic5   = getVal('IC5');
          const nd = tipo5 === 'ND' ? ic5
                   : !tipo5 && isDespOrcamentaria ? ic5     // sem TIPO5: infere pelo prefixo
                   : undefined;

          return {
            CONTA: getVal('CONTA') ?? '',
            PO: getVal('IC1') || getVal('PO'),
            FP: fp || getVal('FP'),
            FS: fs || getVal('FS'),
            FR: getVal('IC3') || getVal('FR'),
            CO: getVal('IC4') || getVal('CO'),
            ND: nd || getVal('ND'),
            Valor: parseFloat(String(getVal('Valor') || '0').replace(',', '.')),
            Tipo_valor: getVal('Tipo_valor') as MSCAccount['Tipo_valor'],
            Natureza_valor: getVal('Natureza_valor') as MSCAccount['Natureza_valor'],
          };
        });
        resolve(data);
      }
    });
  });

  return { accounts, period };
};
