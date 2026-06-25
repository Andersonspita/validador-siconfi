import fs from 'node:fs';
import path from 'node:path';
import JSZip from 'jszip';
import Papa from 'papaparse';
import { parseMSCWithMeta } from '../src/core/parsers.ts';
import { runValidations } from '../src/core/validators/index.ts';
import type { ParsedData, RuleDefinition } from '../src/core/types.ts';

async function loadRulesFromDisk(): Promise<Map<string, RuleDefinition>> {
  const csvPath = path.resolve('public/data/Descricao_verificacoes.csv');
  const csvText = fs.readFileSync(csvPath, 'utf-8');
  const rulesMap = new Map<string, RuleDefinition>();

  Papa.parse(csvText, {
    header: true,
    delimiter: ';',
    skipEmptyLines: true,
    complete: (results) => {
      results.data.forEach((row: any) => {
        const ruleId = row.no_verificacao;
        if (!ruleId) return;
        let dimension: RuleDefinition['dimension'] = 'D1';
        if (row.co_dimensao === 'DI') dimension = 'D1';
        else if (row.co_dimensao === 'DII') dimension = 'D2';
        else if (row.co_dimensao === 'DIII') dimension = 'D3';
        else if (row.co_dimensao === 'DIV') dimension = 'D4';
        rulesMap.set(ruleId, {
          ruleId,
          description: row.no_desc || '',
          dimension,
          impactsCapag: (row.capag || '').toUpperCase().includes('CAPAG'),
          aplicavel: row.no_aplicavel || '',
          finalidade: row.no_finalidade || '',
        });
      });
    },
  });

  return rulesMap;
}

async function parseZipMsc(zipPath: string): Promise<ParsedData> {
  const buffer = fs.readFileSync(zipPath);
  const zip = await JSZip.loadAsync(buffer);
  const result: ParsedData = { mscPeriods: [], mscByPeriod: {} };

  for (const [filename, entry] of Object.entries(zip.files)) {
    if (entry.dir || !filename.toLowerCase().endsWith('.csv')) continue;

    const csvText = await entry.async('string');
    const { accounts, period, enteId } = parseMSCWithMeta(csvText);
    const parsed = await accounts;

    if (enteId) result.enteId = enteId;
    if (period) {
      if (!result.mscPeriods!.includes(period)) result.mscPeriods!.push(period);
      result.mscByPeriod![period] = parsed;
      result.anoReferencia = period.split('-')[0];
    } else {
      result.msc = parsed;
    }
  }

  if (result.mscByPeriod && Object.keys(result.mscByPeriod).length > 0) {
    result.msc = Object.values(result.mscByPeriod).flat();
    result.mscPeriods = Object.keys(result.mscByPeriod).sort();
  }

  return result;
}

const zipArg = process.argv[2];
if (!zipArg) {
  console.error('Uso: npx tsx scripts/run-local-validation.mts <arquivo.zip>');
  process.exit(1);
}

const zipPath = path.resolve(zipArg);
const rulesMap = await loadRulesFromDisk();
const data = await parseZipMsc(zipPath);
const results = await runValidations(data, rulesMap);

const errors = results.filter(r => r.severity === 'error');
const warnings = results.filter(r => r.severity === 'warning');
const infos = results.filter(r => r.severity === 'info');

console.log('\n=== Validador SICONFI — Teste Local ===');
console.log(`Arquivo: ${path.basename(zipPath)}`);
console.log(`Ente IBGE: ${data.enteId ?? '(não detectado)'}`);
console.log(`Período(s) MSC: ${data.mscPeriods?.join(', ') ?? 'N/A'}`);
console.log(`Linhas MSC: ${data.msc?.length ?? 0}`);
console.log(`\nResultado: ${errors.length} erro(s) | ${warnings.length} aviso(s) | ${infos.length} orientação(ões)`);

if (errors.length > 0) {
  console.log('\n--- ERROS (IMPEDITIVOS) ---');
  errors.forEach(r => {
    console.log(`\n[${r.ruleId}] ${r.description || r.message}`);
    console.log(`  ${r.message}`);
    if (r.detailedItems?.length) {
      r.detailedItems.slice(0, 3).forEach(d =>
        console.log(`  · ${d.conta} ${d.detalhe ?? ''} ${d.valor !== undefined ? `R$ ${d.valor}` : ''}`)
      );
      if (r.detailedItems.length > 3) console.log(`  ... +${r.detailedItems.length - 3} lançamento(s)`);
    }
  });
}

if (warnings.length > 0) {
  console.log('\n--- AVISOS ---');
  warnings.slice(0, 15).forEach(r => {
    console.log(`[${r.ruleId}] ${r.message.slice(0, 200)}${r.message.length > 200 ? '...' : ''}`);
  });
  if (warnings.length > 15) console.log(`... +${warnings.length - 15} aviso(s) adicionais`);
}

console.log('\n=== Fim ===\n');
