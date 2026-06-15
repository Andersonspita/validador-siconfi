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
  const result: ParsedData = {};

  for (const file of files) {
    if (file.name.endsWith('.csv')) {
      const text = await file.text();
      result.msc = await parseMSC(text);
    } else if (file.name.endsWith('.zip')) {
      const zip = new JSZip();
      const unzipped = await zip.loadAsync(file);
      
      // Look for CSV and XML files inside ZIP
      for (const [filename, zipEntry] of Object.entries(unzipped.files)) {
        if (!zipEntry.dir) {
          if (filename.toLowerCase().endsWith('.xml')) {
            const xmlText = await zipEntry.async("string");
            const parsedXml = xmlParser.parse(xmlText);
            
            if (filename.toLowerCase().includes('rreo')) result.rreo = parsedXml;
            else if (filename.toLowerCase().includes('rgf')) result.rgf = parsedXml;
            else if (filename.toLowerCase().includes('dca')) result.dca = parsedXml;
          } else if (filename.toLowerCase().endsWith('.csv')) {
            const csvText = await zipEntry.async("string");
            const parsedCsv = await parseMSC(csvText);
            
            // If multiple CSVs exist, you might need to handle them, but assuming one MSC per ZIP or accumulating
            if (!result.msc) {
              result.msc = parsedCsv;
            } else {
              result.msc = result.msc.concat(parsedCsv);
            }
          }
        }
      }
    } else if (file.name.endsWith('.xml')) {
      const xmlText = await file.text();
      const parsedXml = xmlParser.parse(xmlText);
      
      if (file.name.toLowerCase().includes('rreo')) result.rreo = parsedXml;
      else if (file.name.toLowerCase().includes('rgf')) result.rgf = parsedXml;
      else if (file.name.toLowerCase().includes('dca')) result.dca = parsedXml;
    } else if (file.name.endsWith('.xls') || file.name.endsWith('.xlsx')) {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: 'array' });
      
      const parsedXls: XLSReport = {};
      workbook.SheetNames.forEach(sheetName => {
        const worksheet = workbook.Sheets[sheetName];
        parsedXls[sheetName] = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
      });

      if (file.name.toLowerCase().includes('rreo')) result.rreo = parsedXls;
      else if (file.name.toLowerCase().includes('rgf')) result.rgf = parsedXls;
      else if (file.name.toLowerCase().includes('dca')) result.dca = parsedXls;
    }
  }

  return result;
};

const parseMSC = (csvText: string): Promise<MSCAccount[]> => {
  return new Promise((resolve) => {
    // Siconfi MSC exports often start with a metadata row (e.g., Institution Code).
    // We need to skip lines until we find the real header starting with "CONTA;".
    const lines = csvText.split(/\r?\n/);
    const startIdx = lines.findIndex(line => line.includes('CONTA;'));
    const cleanCsvText = startIdx >= 0 ? lines.slice(startIdx).join('\n') : csvText;

    Papa.parse(cleanCsvText, {
      header: true,
      skipEmptyLines: true,
      delimiter: ';', // Siconfi uses semicolon
      complete: (results) => {
        const data: MSCAccount[] = results.data.map((row: any) => {
          const getVal = (key: string) => {
             const foundKey = Object.keys(row).find(k => k.toLowerCase() === key.toLowerCase());
             return foundKey ? row[foundKey] : undefined;
          };
          return {
            CONTA: getVal('CONTA'),
            PO: getVal('IC1') || getVal('PO'),
            FP: getVal('IC2') || getVal('FP'),
            FR: getVal('IC3') || getVal('FR'),
            CO: getVal('IC4') || getVal('CO'),
            Valor: parseFloat(String(getVal('Valor') || '0').replace(',', '.')),
            Tipo_valor: getVal('Tipo_valor'),
            Natureza_valor: getVal('Natureza_valor'),
          };
        });
        resolve(data);
      }
    });
  });
};
