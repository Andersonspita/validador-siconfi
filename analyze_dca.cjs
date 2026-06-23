const fs = require('fs');
const file = fs.readFileSync('PM Cocos preenchidas - SICONFI_DCA_2908101_20260105_v14 (2).xls', 'latin1');
console.log('File length:', file.length);
console.log('Start:', file.substring(0, 100));
const matches = [...file.matchAll(/<Worksheet ss:Name="([^"]+)"/g)];
console.log('Abas XML:', matches.map(m => m[1]));

// Tenta via bibliotecas
try {
  const xlsx = require('xlsx');
  const wb = xlsx.readFile('PM Cocos preenchidas - SICONFI_DCA_2908101_20260105_v14 (2).xls');
  console.log('Abas XLSX:', wb.SheetNames);
} catch (e) {
  console.log('Nao abriu via XLSX:', e.message);
}
