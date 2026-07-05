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

export type Poder = 'Executivo' | 'Legislativo' | 'Judiciário' | 'Ministério Público' | 'Outro';

/**
 * Classifica o Poder/Órgão a partir do nome da instituição retornado pela
 * própria API do Siconfi (campo "instituicao").
 *
 * IMPORTANTE: propositalmente NÃO usamos o prefixo do campo "PO" da MSC para
 * isso. O "PO" (Poder/Órgão) na MSC é uma informação complementar de-para que
 * CADA ente define livremente no cadastro do Siconfi — não é um código
 * nacional padronizado como FR ou CO. A regra D1_00022 deste projeto assume
 * "PO iniciado em 2 = Executivo", mas nos dados reais de Guanambi observamos
 * o oposto (PO 10131 = Executivo, com despesas de ~R$174M; PO 20231 =
 * Legislativo, com despesas de ~R$8,5M). Por isso, para D1_00001, confiamos
 * apenas no texto de "instituicao" devolvido pela STN, que é confiável.
 */
export function classificarPoder(instituicao: string | null | undefined): Poder {
  if (!instituicao) return 'Outro';
  const alvo = instituicao.toLowerCase();
  if (alvo.includes('câmara') || alvo.includes('camara') || alvo.includes('legislativ') || alvo.includes('assembl')) {
    return 'Legislativo';
  }
  if (alvo.includes('prefeitura') || alvo.includes('governo do estado') || alvo.includes('governo do distrito') || alvo.includes('executivo')) {
    return 'Executivo';
  }
  if (alvo.includes('tribunal de justiça') || alvo.includes('judiciário') || alvo.includes('judiciario')) {
    return 'Judiciário';
  }
  if (alvo.includes('ministério público') || alvo.includes('ministerio publico')) {
    return 'Ministério Público';
  }
  return 'Outro';
}

export interface PendenciaPorPoder {
  instituicao: string;
  poder: Poder;
  pendentes: string[];
}

/**
 * Para cada instituição (Poder/Órgão) presente na resposta da API, verifica
 * quais dos demonstrativos em `ausentesLocalmente` NÃO estão homologados para
 * aquela instituição especificamente. Isso evita o problema de "um Poder
 * homologado esconde a pendência de outro Poder" — ex.: a Câmara homologar o
 * RGF não significa que a Prefeitura também homologou o dela.
 *
 * Retorna apenas instituições que têm ao menos 1 pendência.
 */
export function buildPendenciasPorPoder(
  entregas: ExtratoEntrega[],
  ausentesLocalmente: string[]
): PendenciaPorPoder[] {
  const instituicoes = Array.from(new Set(entregas.map(e => e.instituicao).filter(Boolean)));

  return instituicoes
    .map(instituicao => {
      const entregasDaInstituicao = entregas.filter(e => e.instituicao === instituicao);
      const pendentes = ausentesLocalmente.filter(rep => {
        const homologado = entregasDaInstituicao.some(
          e => isEntregavelDoTipo(e.entregavel, rep) && isHomologado(e.status_relatorio)
        );
        return !homologado;
      });
      return { instituicao, poder: classificarPoder(instituicao), pendentes };
    })
    .filter(p => p.pendentes.length > 0);
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
