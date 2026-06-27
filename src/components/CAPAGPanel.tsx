import { useState, useEffect } from 'react';
import { MSCAccount } from '../core/types';
import { calcularCapag, ResultadoCapag, NotaCapag } from '../core/capagEngine';
import { consultarCauc, CaucResult } from '../services/caucService';
import './CAPAGPanel.css';

interface Props {
  msc: MSCAccount[];
  enteId?: string;
  ano?: number;
}

const NOTA_COR: Record<NotaCapag, string> = { A: '#16a34a', B: '#d97706', C: '#dc2626', '–': '#6b7280' };
const NOTA_BG:  Record<NotaCapag, string> = { A: '#f0fdf4', B: '#fffbeb', C: '#fef2f2', '–': '#f9fafb' };

const brl = (v: number) => v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const pct = (v: number | null) => v !== null ? `${(v * 100).toFixed(2)}%` : '–';

export default function CAPAGPanel({ msc, enteId, ano }: Props) {
  const [capag, setCapag] = useState<ResultadoCapag | null>(null);
  const [cauc, setCauc]   = useState<CaucResult | null>(null);
  const [loadCauc, setLoadCauc] = useState(false);
  const [tabCauc, setTabCauc]   = useState(false);

  useEffect(() => {
    if (msc.length > 0) setCapag(calcularCapag(msc));
  }, [msc]);

  async function fetchCauc() {
    if (!enteId) return;
    setLoadCauc(true);
    const result = await consultarCauc(enteId, ano);
    setCauc(result);
    setLoadCauc(false);
    setTabCauc(true);
  }

  if (!capag) return null;

  return (
    <div className="capag-panel">
      <div className="capag-header">
        <div>
          <h3 className="capag-title">Estimativa CAPAG</h3>
          <p className="capag-subtitle">Baseada na MSC — indicadores aproximados</p>
        </div>
        <div className="capag-nota-geral" style={{ background: NOTA_BG[capag.notaGeral], borderColor: NOTA_COR[capag.notaGeral] }}>
          <span className="capag-nota-label">Nota estimada</span>
          <span className="capag-nota-valor" style={{ color: NOTA_COR[capag.notaGeral] }}>{capag.notaGeral}</span>
        </div>
      </div>

      {/* Abas CAPAG / CAUC */}
      <div className="capag-tabs">
        <button className={`capag-tab ${!tabCauc ? 'capag-tab-active' : ''}`} onClick={() => setTabCauc(false)}>
          Indicadores CAPAG
        </button>
        <button
          className={`capag-tab ${tabCauc ? 'capag-tab-active' : ''}`}
          onClick={() => { setTabCauc(true); if (!cauc && enteId) fetchCauc(); }}
        >
          CAUC {cauc && cauc.qtdIrregulares > 0 && <span className="cauc-badge-alert">{cauc.qtdIrregulares}</span>}
        </button>
      </div>

      {/* ── Aba CAPAG ── */}
      {!tabCauc && (
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
          {!enteId && <p className="cauc-no-ente">Código IBGE não detectado na MSC — não é possível consultar o CAUC.</p>}

          {enteId && !cauc && !loadCauc && (
            <div className="cauc-action">
              <p>Consulta a situação de regularidade fiscal do município no CAUC da STN.</p>
              <button className="cauc-btn" onClick={fetchCauc}>Consultar CAUC agora</button>
            </div>
          )}

          {loadCauc && <p className="cauc-loading">⏳ Consultando CAUC na API da STN…</p>}

          {cauc && !loadCauc && (
            <>
              {cauc.erro && <p className="cauc-erro">Erro na consulta: {cauc.erro}. Verifique a conectividade.</p>}
              {!cauc.erro && cauc.totalItens === 0 && (
                <p className="cauc-vazio">Nenhum dado retornado para o ente {cauc.enteId} / {cauc.ano}.</p>
              )}
              {!cauc.erro && cauc.totalItens > 0 && (
                <>
                  <div className="cauc-resumo">
                    <div className="cauc-stat cauc-ok"><strong>{cauc.regular.length}</strong><span>Regular</span></div>
                    <div className="cauc-stat cauc-irr"><strong>{cauc.qtdIrregulares}</strong><span>Irregular</span></div>
                    <div className="cauc-stat cauc-na"><strong>{cauc.naoAplicavel.length}</strong><span>N/A</span></div>
                  </div>

                  {cauc.irregular.length > 0 && (
                    <div className="cauc-list">
                      <p className="cauc-list-title cauc-irr-title">Requisitos irregulares:</p>
                      {cauc.irregular.map((item, i) => (
                        <div key={i} className="cauc-item cauc-item-irr">
                          <span className="cauc-dot cauc-dot-irr" aria-hidden="true" />
                          <span>{item.no_requisito}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {cauc.regular.length > 0 && (
                    <details className="cauc-details">
                      <summary>Ver {cauc.regular.length} requisito(s) regular(es)</summary>
                      {cauc.regular.map((item, i) => (
                        <div key={i} className="cauc-item cauc-item-ok">
                          <span className="cauc-dot cauc-dot-ok" aria-hidden="true" />
                          <span>{item.no_requisito}</span>
                        </div>
                      ))}
                    </details>
                  )}
                </>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
