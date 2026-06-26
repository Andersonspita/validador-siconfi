import fs from 'node:fs';
import path from 'node:path';
import JSZip from 'jszip';
import { parseMSCWithMeta, decodeTextFromBytes } from '../src/core/parsers.ts';
import { runValidations } from '../src/core/validators/index.ts';
import { generatePDFBuffer } from '../src/core/pdfGenerator.ts';
import type { ParsedData, RuleDefinition, ValidationResult } from '../src/core/types.ts';

const rulesMap = new Map<string, RuleDefinition>();

async function parseZip(zipPath: string): Promise<ParsedData> {
  const buffer = fs.readFileSync(zipPath);
  const zip = await JSZip.loadAsync(buffer);
  const result: ParsedData = { mscPeriods: [], mscByPeriod: {} };

  for (const [filename, entry] of Object.entries(zip.files)) {
    if (entry.dir) continue;
    const lname = filename.toLowerCase();
    if (lname.endsWith('.csv')) {
      const rawBuf = await entry.async('arraybuffer');
      const csvText = decodeTextFromBytes(new Uint8Array(rawBuf));
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
  }
  if (result.mscByPeriod && Object.keys(result.mscByPeriod).length > 0) {
    result.msc = Object.values(result.mscByPeriod).flat();
    result.mscPeriods = Object.keys(result.mscByPeriod).sort();
  }
  return result;
}

const zipArg = process.argv[2];
const pdfOut = process.argv[3] ?? 'relatorio_validacao.pdf';
if (!zipArg) { console.error('Uso: npx tsx scripts/test-and-pdf.mts <arquivo.zip>'); process.exit(1); }

console.log('\n🔍 Parsing:', path.basename(zipArg));
const data = await parseZip(path.resolve(zipArg));
console.log(`   Ente     : ${data.enteId ?? '(não detectado)'}`);
console.log(`   Período  : ${data.mscPeriods?.join(', ') ?? 'N/A'}`);
console.log(`   Linhas   : ${data.msc?.length ?? 0}`);

console.log('\n⚙️  Validando...');
const results: ValidationResult[] = await runValidations(data, rulesMap);
const errors   = results.filter(r => r.severity === 'error');
const warnings = results.filter(r => r.severity === 'warning');
const infos    = results.filter(r => r.severity === 'info');

console.log(`\n📊 ${errors.length} impeditivo(s) | ${warnings.length} aviso(s) | ${infos.length} orientação(ões)`);

if (errors.length) {
  console.log('\n❌ IMPEDITIVOS:');
  errors.forEach(r => {
    console.log(`\n  [${r.ruleId}] ${r.message}`);
    if (r.actionPlan) console.log(`  → ${r.actionPlan}`);
    r.detailedItems?.slice(0, 3).forEach(d =>
      console.log(`    · ${d.conta}${d.detalhe ? ' — '+d.detalhe : ''}${d.valor!=null?' R$'+d.valor.toFixed(2):''}`)
    );
    if ((r.detailedItems?.length ?? 0) > 3) console.log(`    ... +${r.detailedItems!.length-3} lançamento(s)`);
  });
}
if (warnings.length) {
  console.log('\n⚠️  AVISOS:');
  warnings.forEach(r => console.log(`  [${r.ruleId}] ${r.message.slice(0,200)}${r.message.length>200?'…':''}`));
}
if (infos.length) {
  console.log(`\nℹ️  ${infos.length} ORIENTAÇÕES (verificar no portal SICONFI)`);
  infos.slice(0,3).forEach(r => console.log(`  [${r.ruleId}] ${r.message.slice(0,100)}…`));
}

console.log(`\n📄 Gerando PDF...`);
const pdfBytes = generatePDFBuffer(results, { enteId: data.enteId, periodo: data.mscPeriods?.join(', ') });
fs.writeFileSync(pdfOut, Buffer.from(pdfBytes));
const kb = Math.round(Buffer.from(pdfBytes).byteLength / 1024);
console.log(`✅ PDF salvo: ${pdfOut} (${kb} KB)\n`);
