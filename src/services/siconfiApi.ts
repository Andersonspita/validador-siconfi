export interface ExtratoEntrega {
  exercicio: number;
  cod_ibge: string;
  populacao: number;
  instituicao: string;
  relatorio: string;
  documento: string;
  periodo: string;
  data_entrega: string; // ISO format or DD/MM/YYYY
  status_relatorio: string;
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
export const getExtratoEntregas = async (enteId: string, ano: string): Promise<ExtratoEntrega[]> => {
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
