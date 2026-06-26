/**
 * reportEngine.ts
 * Extrai e agrega dados de execução orçamentária da MSC (Classe 6)
 * para geração de relatórios analíticos por Função, Subfunção, Fonte, etc.
 */

import { MSCAccount } from './types';

// ── Mapeamentos de referência ──────────────────────────────────────────────

export const FUNCOES: Record<string, string> = {
  '01': 'Legislativa', '02': 'Judiciária', '03': 'Essencial à Justiça',
  '04': 'Administração', '05': 'Def. Nacional', '06': 'Segurança Pública',
  '07': 'Rel. Exteriores', '08': 'Assistência Social', '09': 'Previdência Social',
  '10': 'Saúde', '11': 'Trabalho', '12': 'Educação', '13': 'Cultura',
  '14': 'Dir. Cidadania', '15': 'Urbanismo', '16': 'Habitação',
  '17': 'Saneamento', '18': 'Gestão Ambiental', '19': 'Ciência e Tecnologia',
  '20': 'Agricultura', '21': 'Org. Agrária', '22': 'Indústria', '23': 'Comércio e Serviços',
  '24': 'Comunicações', '25': 'Energia', '26': 'Transporte',
  '27': 'Desporto e Lazer', '28': 'Encargos Especiais',
};

// Contas PCASP por estágio de execução (Classe 622)
const CONTAS_EMPENHADO  = ['622130100'];
const CONTAS_LIQUIDADO  = ['622130200', '622130300', '622130400'];
const CONTAS_PAGO       = ['622130300', '622130400'];

// Tipo de saldo: 'period_change' (mês) ou 'ending_balance' (acumulado)
export type TipoSaldo = 'period_change' | 'ending_balance';

// Agrupamentos disponíveis
export type Agrupamento = 'funcao' | 'subfuncao' | 'fonte' | 'natureza' | 'orgao';

export interface ReportRow {
  chave: string;        // valor do agrupamento (ex: '10', '10301', '1500')
  label: string;        // descrição legível
  empenhado: number;
  liquidado: number;
  pago: number;
  hasChildren: boolean; // se há drill-down disponível
}

export interface ReportResult {
  agrupamento: Agrupamento;
  tipoSaldo: TipoSaldo;
  periodos: string[];
  rows: ReportRow[];
  totais: { empenhado: number; liquidado: number; pago: number };
}

// ── Helpers internos ────────────────────────────────────────────────────────

function netValue(
  msc: MSCAccount[],
  contas: string[],
  tipo: TipoSaldo,
  filterFn?: (a: MSCAccount) => boolean
): number {
  return msc
    .filter(a =>
      contas.some(c => a.CONTA.startsWith(c)) &&
      a.Tipo_valor === tipo &&
      (filterFn ? filterFn(a) : true)
    )
    .reduce((sum, a) => sum + (a.Natureza_valor === 'C' ? a.Valor : -a.Valor), 0);
}

function getKey(a: MSCAccount, agrupamento: Agrupamento): string | null {
  switch (agrupamento) {
    case 'funcao':    return a.FS ? a.FS.slice(0, 2) : null;
    case 'subfuncao': return a.FS ?? null;
    case 'fonte':     return a.FR ?? null;
    case 'natureza':  return a.ND ? a.ND.slice(0, 6) : null;
    case 'orgao':     return a.PO ?? null;
  }
}

function getLabel(chave: string, agrupamento: Agrupamento): string {
  switch (agrupamento) {
    case 'funcao':
      return FUNCOES[chave] ? `${chave} - ${FUNCOES[chave]}` : chave;
    case 'subfuncao': {
      const fn = chave.slice(0, 2);
      return FUNCOES[fn] ? `${chave} (${FUNCOES[fn]})` : chave;
    }
    case 'fonte':
      return `Fonte ${chave}`;
    case 'natureza':
      return `ND ${chave}`;
    case 'orgao':
      return `Órgão ${chave}`;
  }
}

function hasNextLevel(agrupamento: Agrupamento): boolean {
  return agrupamento !== 'fonte' && agrupamento !== 'natureza' && agrupamento !== 'orgao';
}

// ── API pública ──────────────────────────────────────────────────────────────

/**
 * Gera relatório agregado da execução orçamentária.
 * @param msc Dados da MSC (um ou mais períodos, já concatenados)
 * @param agrupamento Campo de agrupamento
 * @param tipoSaldo 'period_change' (movimentação) ou 'ending_balance' (acumulado)
 * @param filtros Filtros adicionais (ex: só Função 12, só Fonte 1540)
 */
export function gerarRelatorio(
  msc: MSCAccount[],
  agrupamento: Agrupamento,
  tipoSaldo: TipoSaldo = 'period_change',
  filtros?: {
    funcao?: string;
    subfuncao?: string;
    fonte?: string;
    orgao?: string;
  }
): ReportResult {
  // Filtrar contas de despesa orçamentária com FS preenchido
  const base622 = msc.filter(a =>
    a.CONTA.startsWith('622') &&
    a.FS &&
    a.Tipo_valor === tipoSaldo &&
    // Aplicar filtros opcionais
    (!filtros?.funcao    || (a.FS && a.FS.slice(0, 2) === filtros.funcao)) &&
    (!filtros?.subfuncao || a.FS === filtros.subfuncao) &&
    (!filtros?.fonte     || a.FR === filtros.fonte) &&
    (!filtros?.orgao     || a.PO === filtros.orgao)
  );

  // Coletar chaves únicas para o agrupamento solicitado
  const chaves = new Set<string>();
  base622.forEach(a => {
    const k = getKey(a, agrupamento);
    if (k) chaves.add(k);
  });

  // Para cada chave, calcular os três estágios
  const rows: ReportRow[] = [];

  chaves.forEach(chave => {
    const filterByKey = (a: MSCAccount) => {
      const k = getKey(a, agrupamento);
      return k === chave;
    };

    const empenhado = netValue(msc, CONTAS_EMPENHADO, tipoSaldo, a =>
      a.CONTA.startsWith('622') && a.FS != null &&
      filterByKey(a) &&
      (!filtros?.funcao    || (!!a.FS && a.FS.slice(0, 2) === filtros.funcao)) &&
      (!filtros?.subfuncao || a.FS === filtros.subfuncao) &&
      (!filtros?.fonte     || a.FR === filtros.fonte)
    );

    const liquidado = netValue(msc, CONTAS_LIQUIDADO, tipoSaldo, a =>
      a.CONTA.startsWith('622') && a.FS != null &&
      filterByKey(a) &&
      (!filtros?.funcao    || (!!a.FS && a.FS.slice(0, 2) === filtros.funcao)) &&
      (!filtros?.subfuncao || a.FS === filtros.subfuncao) &&
      (!filtros?.fonte     || a.FR === filtros.fonte)
    );

    const pago = netValue(msc, CONTAS_PAGO, tipoSaldo, a =>
      a.CONTA.startsWith('622') && a.FS != null &&
      filterByKey(a) &&
      (!filtros?.funcao    || (!!a.FS && a.FS.slice(0, 2) === filtros.funcao)) &&
      (!filtros?.subfuncao || a.FS === filtros.subfuncao) &&
      (!filtros?.fonte     || a.FR === filtros.fonte)
    );

    // Só inclui se tiver algum valor
    if (Math.abs(empenhado) > 0.01 || Math.abs(liquidado) > 0.01 || Math.abs(pago) > 0.01) {
      rows.push({
        chave,
        label: getLabel(chave, agrupamento),
        empenhado: Math.max(0, empenhado),
        liquidado: Math.max(0, liquidado),
        pago:      Math.max(0, pago),
        hasChildren: hasNextLevel(agrupamento),
      });
    }
  });

  // Ordenar por empenhado desc
  rows.sort((a, b) => b.empenhado - a.empenhado);

  const totais = rows.reduce(
    (acc, r) => ({ empenhado: acc.empenhado + r.empenhado, liquidado: acc.liquidado + r.liquidado, pago: acc.pago + r.pago }),
    { empenhado: 0, liquidado: 0, pago: 0 }
  );

  return { agrupamento, tipoSaldo, periodos: [], rows, totais };
}

/** Próximo nível de drill-down. */
export function proximoNivel(atual: Agrupamento, chave: string): { agrupamento: Agrupamento; filtro: Record<string, string> } {
  switch (atual) {
    case 'funcao':    return { agrupamento: 'subfuncao', filtro: { funcao: chave } };
    case 'subfuncao': return { agrupamento: 'fonte',     filtro: { subfuncao: chave } };
    case 'orgao':     return { agrupamento: 'funcao',    filtro: { orgao: chave } };
    default:          return { agrupamento: atual,       filtro: {} };
  }
}

/** Formata valor em BRL. */
export function brl(v: number): string {
  return v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
