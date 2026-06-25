/** Constantes PCASP / MDF — externalizadas para facilitar atualização por edição do manual. */
export const MDF_VERSION = 'MDF 15ª edição';

/** Grupos do ativo com natureza devedora padrão (D1_00021). */
export const ATIVO_NATUREZA_D_PREFIXES = ['1111', '1121', '1125', '1231', '1232'];

/** Contas retificadoras do ativo — natureza credora legítima (depreciação/amortização acumulada). */
export const ATIVO_RETIFICADORA_PREFIXES = ['1238101', '1238102', '1238'];

/** Passivo circulante/não circulante — natureza credora padrão (D1_00025). */
export const PASSIVO_NATUREZA_C_PREFIXES = [
  '2111', '2112', '2113', '2114', '2121', '2122', '2123', '2124', '2125', '2126',
  '213', '214', '215', '221', '222', '223',
];

/** Patrimônio líquido — natureza credora padrão (D1_00026), exceto deduções. */
export const PL_NATUREZA_C_PREFIXES = ['2311', '2312', '232', '233', '234', '235', '236'];

/** Deduções do PL — natureza devedora legítima (MCASP). */
export const PL_DEDUCAO_PREFIXES = ['2312', '2321', '2322', '2331', '2341', '2351', '2361'];

/** Contas orçamentárias com natureza invertida legítima (cancelamentos/estornos — D1_00038). */
export const ORCAM_NATUREZA_EXCEPTION_PREFIXES = [
  '6213201', '6213202', '6213203',
  '6229201', '6229202', '6229203',
  '5110201', '5120201',
];

/** DDR — apenas subgrupos 7211 (devedora) e 8211 (credora), excluindo garantias/avais. */
export const DDR_DEVEDORA_PREFIXES = ['7211'];
export const DDR_CREDORA_PREFIXES = ['8211'];

/** Provisões obrigatórias quando há despesa de pessoal (D2_00081). */
export const PROVISAO_FERIAS_13_CONTAS = ['211110102', '211110103', '211110104'];

/** Tolerância de arredondamento em reais. */
export const TOLERANCIA_REAIS = 0.01;
