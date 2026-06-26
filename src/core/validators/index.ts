import { ParsedData, ValidationResult, RuleDefinition } from '../types';
import { validateD1_Entrega, validateD1_MSC, validateMultiMonth, validateD1_Encerramento } from './rulesD1';
import { validateD2_MSC, validateD2_DCA, validateD2_MSC_Encerramento_DCA } from './rulesD2';
import { validateD3_RREO, validateD3_Fiscal, validateMSC_CAPAG } from './rulesD3';
import { validateD4_Cruzamentos } from './rulesD4';
import { findEncerramentoPeriod, isRegularMonthPeriod } from './utils';
import { enrichWithCorrectiveEntries } from '../correctiveEntries';

export const runValidations = async (data: ParsedData, rulesMap: Map<string, RuleDefinition>): Promise<ValidationResult[]> => {
  const results: ValidationResult[] = [];

  results.push(...(await validateD1_Entrega(data, rulesMap)));

  if (data.mscByPeriod && Object.keys(data.mscByPeriod).length > 0) {
    for (const [period, periodMsc] of Object.entries(data.mscByPeriod)) {
      if (isRegularMonthPeriod(period)) {
        results.push(...validateD1_MSC(periodMsc, rulesMap, period));
        results.push(...validateD2_MSC({ ...data, msc: periodMsc }, rulesMap, period));
      }
    }

    const encKey = findEncerramentoPeriod(data.mscByPeriod);
    if (encKey) {
      results.push(...validateD1_Encerramento(data.mscByPeriod[encKey], rulesMap, encKey));
      results.push(...validateD2_MSC_Encerramento_DCA(data, rulesMap));
    }
  } else if (data.msc) {
    results.push(...validateD1_MSC(data.msc, rulesMap));
    results.push(...validateD2_MSC(data, rulesMap));
  }

  if (data.msc) {
    results.push(...validateMSC_CAPAG(data, rulesMap));
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

  if ((data.msc && data.rreo) || (data.dca && data.rreo)) {
    results.push(...validateD4_Cruzamentos(data, rulesMap));
  }

  if (data.rreo && data.rgf) {
    results.push(...validateD3_Fiscal(data.rreo, data.rgf, rulesMap));
  }

  // Enriquecer metadados das regras via rulesMap
  const enriched = results.map(res => {
    const ruleDef = rulesMap.get(res.ruleId);
    if (ruleDef) {
      if (ruleDef.description) res.description = ruleDef.description;
      res.impactsCapag = ruleDef.impactsCapag;
      res.dimension = ruleDef.dimension;
    }
    return res;
  });

  // Adicionar lançamentos corretivos sugeridos (quando MSC disponível)
  return data.msc ? enrichWithCorrectiveEntries(enriched, data.msc) : enriched;
};
