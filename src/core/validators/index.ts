import { ParsedData, ValidationResult, RuleDefinition } from '../types';
import { validateD1_Entrega, validateD1_MSC, validateMultiMonth, validateD1_Encerramento } from './rulesD1';
import { validateD2_MSC, validateD2_DCA } from './rulesD2';
import { validateD3_RREO, validateD3_Fiscal, validateMSC_CAPAG } from './rulesD3';
import { validateD4_Cruzamentos } from './rulesD4';

export const runValidations = async (data: ParsedData, rulesMap: Map<string, RuleDefinition>): Promise<ValidationResult[]> => {
  const results: ValidationResult[] = [];

  results.push(...(await validateD1_Entrega(data, rulesMap)));

  if (data.msc) {
    results.push(...validateD1_MSC(data.msc, rulesMap));
    results.push(...validateD2_MSC(data, rulesMap));
    results.push(...validateMSC_CAPAG(data.msc, rulesMap));

    if (data.mscPeriods?.some(p => { const m = parseInt(p.split('-')[1] ?? '0'); return m > 12 || m === 0; })) {
      results.push(...validateD1_Encerramento(data.msc, rulesMap));
    }
  }

  if (data.mscByPeriod && Object.keys(data.mscByPeriod).length >= 2) {
    results.push(...validateMultiMonth(data.mscByPeriod, rulesMap));
  }

  if (data.dca) {
    results.push(...validateD2_DCA(data.dca, rulesMap));
  }

  if (data.rreo) {
    results.push(...validateD3_RREO(data.rreo, rulesMap));
  }

  if (data.msc && data.rreo) {
    results.push(...validateD4_Cruzamentos(data, rulesMap));
  }

  if (data.rreo && data.rgf) {
    results.push(...validateD3_Fiscal(data.rreo, data.rgf, rulesMap));
  }

  return results.map(res => {
    const ruleDef = rulesMap.get(res.ruleId);
    if (ruleDef) {
      res.description = ruleDef.description;
      res.impactsCapag = ruleDef.impactsCapag;
      res.dimension = ruleDef.dimension;
    }
    return res;
  });
};
