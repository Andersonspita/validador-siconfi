import Papa from 'papaparse';
import { RuleDefinition } from './types';

export const loadRulesMetadata = (): Promise<Map<string, RuleDefinition>> => {
  return fetch('./data/Descricao_verificacoes.csv')
    .then(response => {
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return response.text();
    })
    .then(csvText => {
      const rulesMap = new Map<string, RuleDefinition>();
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
            if (row.co_dimensao === 'DI')   dimension = 'D1';
            else if (row.co_dimensao === 'DII')  dimension = 'D2';
            else if (row.co_dimensao === 'DIII') dimension = 'D3';
            else if (row.co_dimensao === 'DIV')  dimension = 'D4';
            rulesMap.set(ruleId, {
              ruleId, description, dimension, impactsCapag,
              aplicavel: row.no_aplicavel || '',
              finalidade: row.no_finalidade || '',
            });
          });
        },
      });
      return rulesMap;
    })
    .catch(() => {
      // CSV não disponível — retorna Map vazio; validação funciona normalmente
      // sem descrições oficiais da STN
      return new Map<string, RuleDefinition>();
    });
};
