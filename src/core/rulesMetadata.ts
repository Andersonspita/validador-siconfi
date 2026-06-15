import Papa from 'papaparse';
import { RuleDefinition } from './types';

export const loadRulesMetadata = async (): Promise<Map<string, RuleDefinition>> => {
  const rulesMap = new Map<string, RuleDefinition>();

  try {
    const response = await fetch('/data/Descricao_verificacoes.csv');
    const csvText = await response.text();
    
    // The CSV has headers: co_dimensao;no_verificacao;no_dimensao;no_aplicavel;no_desc;no_declaracao;no_anexo;no_finalidade;capag
    Papa.parse(csvText, {
      header: true,
      delimiter: ';',
      skipEmptyLines: true,
      complete: (results) => {
        results.data.forEach((row: any) => {
          const ruleId = row.no_verificacao;
          if (!ruleId) return;

          const description = row.no_desc || '';
          const capagStr = row.capag || '';
          const impactsCapag = capagStr.toUpperCase().includes('CAPAG');
          
          let dimension: 'D1' | 'D2' | 'D3' | 'D4' = 'D1';
          if (row.co_dimensao === 'DI') dimension = 'D1';
          else if (row.co_dimensao === 'DII') dimension = 'D2';
          else if (row.co_dimensao === 'DIII') dimension = 'D3';
          else if (row.co_dimensao === 'DIV') dimension = 'D4';

          rulesMap.set(ruleId, {
            ruleId,
            description,
            dimension,
            impactsCapag,
            aplicavel: row.no_aplicavel || '',
            finalidade: row.no_finalidade || ''
          });
        });
      }
    });

  } catch (err) {
    console.error("Failed to load rules metadata:", err);
  }

  return rulesMap;
};
