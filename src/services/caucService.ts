/**
 * caucService.ts
 * O CAUC (Cadastro Único de Convênios) não possui API REST pública.
 * A STN disponibiliza os dados em arquivos semanais (CSV/XLSX) no
 * Tesouro Transparente e via portal autenticado (sti.tesouro.gov.br/ng/).
 *
 * Esta função retorna a URL correta para consulta direta.
 */

export interface CaucLinks {
  portalNovo: string;      // Novo CAUC (mar/2026) — requer login gov.br
  transfereGov: string;    // TransfereGov.br — canal oficial
  dadosAbertos: string;    // Arquivo semanal CSV no Tesouro Transparente
}

export function getCaucLinks(): CaucLinks {
  return {
    portalNovo:   'https://sti.tesouro.gov.br/ng/',
    transfereGov: 'https://portal.transferegov.sistema.gov.br/portal/home',
    dadosAbertos: 'https://www.tesourotransparente.gov.br/temas/estados-e-municipios/cauc-sistema-de-informacoes-sobre-requisitos-fiscais',
  };
}

export interface CaucResult {
  carregado: boolean;
  erro?: string;
}

/** Mantida por compatibilidade — redireciona para o portal oficial */
export async function consultarCauc(_ibge: string, _ano?: number): Promise<CaucResult> {
  return { carregado: false, erro: 'sem_api_publica' };
}
