import { useState, useEffect } from 'react';
import { MSCAccount } from '../core/types';
import { calcularCapag, ResultadoCapag, NotaCapag } from '../core/capagEngine';
import { getCaucLinks } from '../services/caucService';
import './CAPAGPanel.css';

interface Props {
  msc: MSCAccount[];
  enteId?: string;
  /** Ano de referência da MSC (exibido no cabeçalho). */
  ano?: number;
  /** Resultados de validação com impacto LRF/CAPAG para o resumo lateral. */
  lrfResults?: { ruleId: string; message: string; severity: string }[];
}

const NOTA_COR: Record<NotaCapag, string> = { A: '#16a34a', B: '#d97706', C: '#dc2626', '–': '#6b7280' };
const NOTA_BG:  Record<NotaCapag, string> = { A: '#f0fdf4', B: '#fffbeb', C: '#fef2f2', '–': '#f9fafb' };

const brl = (v: number) => v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const pct = (v: number | null) => v !== null ? `${(v * 100).toFixed(2)}%` : '–';

export default function CAPAGPanel({ msc, enteId, ano, lrfResults = [] }: Props) {
  const [capag, setCapag] = useState<ResultadoCapag | null>(null);
  const [tabCauc, setTabCauc] = useState(false);
  const [tabLrf, setTabLrf] = useState(false);

  useEffect(() => {
    if (msc.length > 0) setCapag(calcularCapag(msc));
  }, [msc]);

  if (!capag) return null;

  const lrfHits = lrfResults.filter(r =>
    /LRF|pessoal|ARO|opera[cç][oõ]es de cr[eé]dito|RCL|DCL/i.test(`${r.ruleId} ${r.message}`)
  );

  return (
    <div className="capag-panel">
      <div className="capag-header">
        <div>
          <h3 className="capag-title">Estimativa CAPAG{ano ? ` · ${ano}` : ''}</h3>
          <p className="capag-subtitle">
            Baseada na MSC{enteId ? ` · ente ${enteId}` : ''} — indicadores aproximados
          </p>
        </div>
        <div className="capag-nota-geral" style={{ background: NOTA_BG[capag.notaGeral], borderColor: NOTA_COR[capag.notaGeral] }}>
          <span className="capag-nota-label">Nota estimada</span>
          <span className="capag-nota-valor" style={{ color: NOTA_COR[capag.notaGeral] }}>{capag.notaGeral}</span>
        </div>
      </div>

      {/* Abas CAPAG / LRF / CAUC */}
      <div className="capag-tabs">
        <button
          className={`capag-tab ${!tabCauc && !tabLrf ? 'capag-tab-active' : ''}`}
          onClick={() => { setTabCauc(false); setTabLrf(false); }}
        >
          Indicadores CAPAG
        </button>
        <button
          className={`capag-tab ${tabLrf ? 'capag-tab-active' : ''}`}
          onClick={() => { setTabLrf(true); setTabCauc(false); }}
        >
          Limites LRF {lrfHits.length > 0 ? `(${lrfHits.length})` : ''}
        </button>
        <button
          className={`capag-tab ${tabCauc ? 'capag-tab-active' : ''}`}
          onClick={() => { setTabCauc(true); setTabLrf(false); }}
        >
          CAUC
        </button>
      </div>

      {tabLrf && (
        <div className="cauc-section">
          {lrfHits.length === 0 ? (
            <p className="cauc-info-text">Nenhum apontamento de limites LRF nas validações desta carga.</p>
          ) : (
            <ul className="lrf-list">
              {lrfHits.map((r, i) => (
                <li key={`${r.ruleId}-${i}`} className={`lrf-item severity-${r.severity}`}>
                  <strong>{r.ruleId}</strong>
                  <span>{r.message}</span>
                </li>
              ))}
            </ul>
          )}
          <p className="cauc-info-text" style={{ marginTop: 12 }}>
            Os limites de Pessoal, ARO e Operações de Crédito também aparecem na aba
            <strong> Regras D1 a D4</strong> com o detalhamento completo.
          </p>
        </div>
      )}

      {/* ── Aba CAPAG ── */}
      {!tabCauc && !tabLrf && (
        <>
          <div className="capag-grid">
            {capag.indicadores.map(ind => (
              <div key={ind.nome} className="capag-card" style={{ borderTopColor: NOTA_COR[ind.nota] }}>
                <div className="capag-card-head">
                  <span className="capag-ind-nome">{ind.nome}</span>
                  <span className="capag-ind-nota" style={{ background: NOTA_BG[ind.nota], color: NOTA_COR[ind.nota] }}>
                    {ind.nota}
                  </span>
                </div>
                <p className="capag-formula">{ind.formula}</p>
                <div className="capag-valores">
                  <div className="capag-val-row">
                    <span>Numerador</span><span>{brl(ind.numerador)}</span>
                  </div>
                  <div className="capag-val-row">
                    <span>Denominador</span><span>{brl(ind.denominador)}</span>
                  </div>
                  <div className="capag-val-row capag-resultado-row">
                    <span>Resultado</span>
                    <span style={{ color: NOTA_COR[ind.nota], fontWeight: 600 }}>{pct(ind.resultado)}</span>
                  </div>
                </div>
                <p className="capag-ref">{ind.referencia}</p>
              </div>
            ))}
          </div>

          <div className="capag-advertencias">
            {capag.advertencias.map((a, i) => (
              <p key={i} className={i === capag.advertencias.length - 1 ? 'capag-aviso-base' : 'capag-aviso'}>
                ⚠️ {a}
              </p>
            ))}
          </div>
        </>
      )}

      {/* ── Aba CAUC ── */}
      {tabCauc && (
        <div className="cauc-section">
          <div className="cauc-info-card">
            <p className="cauc-info-title">ℹ️ Sobre o CAUC</p>
            <p className="cauc-info-text">
              O <strong>CAUC (Sistema de Informações sobre Requisitos Fiscais)</strong> verifica a
              regularidade fiscal do município para acesso a transferências voluntárias e crédito com
              garantia da União. Desde a <strong>Instrução Normativa STN/MF nº 8/2025</strong>, o
              sistema ganhou novos itens e foi migrado para o portal <strong>sti.tesouro.gov.br</strong>.
            </p>
            <p className="cauc-info-text">
              O extrato atualizado diariamente <strong>não possui API pública</strong> — a consulta
              deve ser feita diretamente no portal oficial com login gov.br.
            </p>
          </div>

          <div className="cauc-links">
            <p className="cauc-links-title">Consultar agora:</p>
            <a
              href={getCaucLinks().portalNovo}
              target="_blank"
              rel="noreferrer"
              className="cauc-link-btn cauc-link-primary"
            >
              🔗 Novo CAUC — sti.tesouro.gov.br
              <span className="cauc-link-desc">Extrato diário · Requer login gov.br</span>
            </a>
            <a
              href={getCaucLinks().transfereGov}
              target="_blank"
              rel="noreferrer"
              className="cauc-link-btn"
            >
              🔗 TransfereGov.br
              <span className="cauc-link-desc">Canal oficial de convênios e transferências</span>
            </a>
            <a
              href={getCaucLinks().dadosAbertos}
              target="_blank"
              rel="noreferrer"
              className="cauc-link-btn"
            >
              📊 Dados Abertos CAUC — Tesouro Transparente
              <span className="cauc-link-desc">Arquivo semanal CSV/XLSX com situação dos municípios</span>
            </a>
          </div>
          {enteId && (
            <p className="cauc-ente-hint">
              Ao acessar o portal, consulte o ente: <strong>{enteId}</strong>
            </p>
          )}
        </div>
      )}
    </div>
  );
}
