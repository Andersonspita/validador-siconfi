/**
 * caucService.ts
 * Consulta situação do CAUC (Cadastro Único de Convênios) via API pública da STN.
 * Endpoint: https://apidatalake.tesouro.gov.br/ords/siconfi/tt/cauc
 */

export interface CaucItem {
  no_requisito: string;
  co_situacao: 'REGULAR' | 'IRREGULAR' | 'NAO_APLICAVEL' | string;
  ds_situacao: string;
}

export interface CaucResult {
  enteId: string;
  ano: number;
  regular: CaucItem[];
  irregular: CaucItem[];
  naoAplicavel: CaucItem[];
  totalItens: number;
  qtdIrregulares: number;
  carregado: boolean;
  erro?: string;
}

export async function consultarCauc(ibge: string, ano?: number): Promise<CaucResult> {
  const anoRef = ano ?? new Date().getFullYear();
  // Limpar sufixo de poder (ex: '2931350EX' → '2931350')
  const coIbge = ibge.replace(/[A-Z]+$/, '').trim();

  const url = `https://apidatalake.tesouro.gov.br/ords/siconfi/tt/cauc?co_ibge=${coIbge}&an_referencia=${anoRef}`;

  try {
    const resp = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const json = await resp.json();
    const items: CaucItem[] = (json?.items ?? json?.data ?? []).map((i: any) => ({
      no_requisito: i.no_requisito ?? i.ds_requisito ?? i.requisito ?? 'N/D',
      co_situacao:  i.co_situacao  ?? i.situacao ?? 'N/D',
      ds_situacao:  i.ds_situacao  ?? i.descricao ?? '',
    }));

    const regular      = items.filter(i => i.co_situacao === 'REGULAR');
    const irregular    = items.filter(i => i.co_situacao === 'IRREGULAR');
    const naoAplicavel = items.filter(i => !['REGULAR','IRREGULAR'].includes(i.co_situacao));

    return { enteId: coIbge, ano: anoRef, regular, irregular, naoAplicavel, totalItens: items.length, qtdIrregulares: irregular.length, carregado: true };
  } catch (e: any) {
    return { enteId: coIbge, ano: anoRef, regular: [], irregular: [], naoAplicavel: [], totalItens: 0, qtdIrregulares: 0, carregado: false, erro: e.message };
  }
}
