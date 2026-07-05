export interface ExtratoEntrega {
  exercicio: number;
  cod_ibge: string;
  populacao: number;
  instituicao: string;
  // Nome real do campo devolvido pela API (confirmado no schema de /extrato_entregas).
  // Ex.: "MSC Agregada", "Relatório Resumido de Execução Orçamentária",
  //      "Relatório de Gestão Fiscal", "Declaração de Contas Anuais".
  // O campo "relatorio" (usado antes aqui) NÃO existe na API — por isso o filtro
  // antigo em rulesD1.ts nunca casava nada e todo D1_00001 saía como IMPEDITIVO.
  entregavel: string;
  periodo: number;
  periodicidade: string; // 'M' (mensal/MSC), 'B' (bimestral/RREO), 'Q' ou 'S' (RGF), 'A' (anual/DCA)...
  // Código curto de status observado na API (ex.: "HO" = Homologado). Pode vir vazio/nulo
  // quando o item é uma matriz (MSC) enviada mas sem "homologação" formal em si.
  status_relatorio: string | null;
  data_status: string; // ISO 8601, ex.: "2026-03-11T13:24:26Z"
  forma_envio: string;
  tipo_relatorio: string | null;
}

/**
 * Mapeia a sigla usada internamente no Validador (RREO/RGF/DCA/MSC) para os
 * termos que efetivamente aparecem no campo "entregavel" da API do Siconfi.
 * Usamos includes() com múltiplas variações porque a STN já mudou a grafia
 * exata desse texto entre versões da API.
 */
const ENTREGAVEL_KEYWORDS: Record<string, string[]> = {
  RREO: ['resumido', 'execução orçamentária', 'execucao orcamentaria', 'rreo'],
  RGF: ['gestão fiscal', 'gestao fiscal', 'rgf'],
  DCA: ['contas anuais', 'dca'],
  MSC: ['matriz de saldos', 'msc'],
};

/**
 * Códigos/termos que indicam homologação. A STN retorna um código curto em
 * "status_relatorio" (ex.: "HO"). Verificamos tanto o código quanto o texto
 * por extenso, para não depender de uma única convenção — CONFIRME empiricamente
 * com console.log(entregas) na primeira execução real, pois a STN não documenta
 * esses códigos publicamente em HTML estático.
 */
const HOMOLOGADO_TOKENS = ['ho', 'homologado', 'homologada'];

export function isEntregavelDoTipo(entregavel: string | undefined | null, sigla: string): boolean {
  if (!entregavel) return false;
  const alvo = entregavel.toLowerCase();
  const keywords = ENTREGAVEL_KEYWORDS[sigla] ?? [sigla.toLowerCase()];
  return keywords.some(k => alvo.includes(k));
}

export function isHomologado(statusRelatorio: string | null | undefined): boolean {
  if (!statusRelatorio) return false;
  const alvo = statusRelatorio.trim().toLowerCase();
  return HOMOLOGADO_TOKENS.includes(alvo) || alvo.includes('homologad');
}

export interface SiconfiApiResponse {
  items: ExtratoEntrega[];
  hasMore: boolean;
  limit: number;
  offset: number;
  count: number;
}

// CORS Proxy options - useful para rodar a aplicação local ou em páginas estáticas
const PROXY_URL = 'https://corsproxy.io/?';

/**
 * Consulta o Extrato de Entregas na API do Siconfi.
 * Se houver erro de CORS na chamada direta, tenta usar um Proxy genérico.
 */
export const getExtratoEntregas = async (
  enteId: string,
  ano: string,
  debug = false
): Promise<ExtratoEntrega[]> => {
  const urlStr = `https://apidatalake.tesouro.gov.br/ords/siconfi/tt/extrato_entregas?id_ente=${enteId}&an_referencia=${ano}`;

  try {
    // Tenta chamada direta primeiro
    const res = await fetch(urlStr, {
      headers: {
        'Accept': 'application/json'
      }
    });
    
    if (!res.ok) throw new Error(`Erro HTTP: ${res.status}`);
    const data: SiconfiApiResponse = await res.json();
    if (debug) {
      // Ajuda a validar em produção, na 1a execução real, se os nomes de campo
      // e os valores de status_relatorio ainda correspondem ao que este código espera.
      console.info('[siconfiApi] extrato_entregas — amostra bruta:', data.items?.[0]);
    }
    return data.items || [];
  } catch (error) {
    console.warn('Falha na chamada direta da API do Siconfi. Tentando via CORS proxy...', error);
    
    try {
      // Tenta fallback via proxy
      const proxiedUrl = PROXY_URL + encodeURIComponent(urlStr);
      const resProxy = await fetch(proxiedUrl, {
        headers: {
          'Accept': 'application/json'
        }
      });
      if (!resProxy.ok) throw new Error(`Erro HTTP via Proxy: ${resProxy.status}`);
      const data: SiconfiApiResponse = await resProxy.json();
      return data.items || [];
    } catch (proxyError) {
      console.error('Falha ao consultar API do Siconfi mesmo com proxy.', proxyError);
      return [];
    }
  }
};
