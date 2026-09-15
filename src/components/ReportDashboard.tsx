import { useEffect, useState, useMemo } from 'react';
import { parseFiles } from '../core/parsers';
import { runValidations } from '../core/validatorEngine';
import { ValidationResult, RuleDefinition, MSCAccount } from '../core/types';
import { buildScoreSummary } from '../core/scoring';
import { buildRankingHtml, buildPlanoAcaoHtml, RankingReportMeta } from '../core/rankingReport';
import { buildCorrectiveEntries } from '../core/correctiveEntries';
import { calcularCapag } from '../core/capagEngine';
import Papa from 'papaparse';
import {
  CheckCircle, AlertTriangle, XCircle, ArrowLeft, Loader2, ShieldAlert,
  Download, Lightbulb, BarChart3, Search, Bot, Copy, FileText
} from 'lucide-react';
import ReportView from './ReportView';
import CAPAGPanel from './CAPAGPanel';
import { generatePDF } from '../core/pdfGenerator';
import type { AppNav } from '../navigation';
import './ReportDashboard.css';

interface ReportDashboardProps {
  files: File[];
  rulesMap: Map<string, RuleDefinition>;
  nav: AppNav;
  onReset: () => void;
  onResultsReady?: (results: ValidationResult[], meta: { enteId?: string; periodo?: string }) => void;
  onStats?: (stats: {
    errors: number; warnings: number; infos: number; capag: number;
    suggested: number; scorePct: number; scoreOk: number; scoreTotal: number;
  }) => void;
}

export default function ReportDashboard({
  files, rulesMap, nav, onReset, onResultsReady, onStats
}: ReportDashboardProps) {
  const [loading, setLoading] = useState(true);
  const [results, setResults] = useState<ValidationResult[]>([]);
  const [filter, setFilter] = useState<'all' | 'error' | 'warning' | 'info' | 'capag'>('all');
  const [search, setSearch] = useState('');
  const [processError, setProcessError] = useState<string | null>(null);
  const [reportMeta, setReportMeta] = useState<{ enteId?: string; periodo?: string }>({});
  const [parsedMsc, setParsedMsc] = useState<MSCAccount[]>([]);
  const [mscPeriods, setMscPeriods] = useState<string[]>([]);
  const [selectedIdx, setSelectedIdx] = useState(0);

  useEffect(() => {
    const process = async () => {
      try {
        setProcessError(null);
        setLoading(true);
        const parsedData = await parseFiles(files);
        const validationResults = await runValidations(parsedData, rulesMap);
        setResults(validationResults);
        setParsedMsc(parsedData.msc ?? []);
        onResultsReady?.(validationResults, { enteId: parsedData.enteId, periodo: parsedData.mscPeriods?.[0] });
        const periods = parsedData.mscPeriods ?? [];
        setMscPeriods(periods);
        setReportMeta({
          enteId: parsedData.enteId,
          periodo: periods.length === 1 ? periods[0] : periods.length > 1 ? `${periods[0]} a ${periods[periods.length - 1]}` : parsedData.anoReferencia,
        });

        const errors = validationResults.filter(r => r.severity === 'error').length;
        const warnings = validationResults.filter(r => r.severity === 'warning').length;
        const infos = validationResults.filter(r => r.severity === 'info').length;
        const capag = validationResults.filter(r => r.impactsCapag).length;
        let suggested = 0;
        for (const r of validationResults) {
          suggested += (r.suggestedEntries?.length ?? buildCorrectiveEntries(r, parsedData.msc ?? []).length);
        }
        const score = buildScoreSummary(validationResults, { rulesMap });
        const scoreOk = score.contagemStatus.OK ?? 0;
        onStats?.({
          errors, warnings, infos, capag, suggested,
          scorePct: score.percentual,
          scoreOk,
          scoreTotal: Math.round(score.pontosAvaliaveis) || score.totalVerificacoes,
        });
      } catch (err) {
        console.error('Error processing files:', err);
        setProcessError(
          err instanceof Error
            ? `Falha ao processar os arquivos: ${err.message}`
            : 'Falha ao processar os arquivos. Verifique o formato.'
        );
        setResults([]);
        onResultsReady?.([], {});
        onStats?.({ errors: 0, warnings: 0, infos: 0, capag: 0, suggested: 0, scorePct: 0, scoreOk: 0, scoreTotal: 0 });
      } finally {
        setLoading(false);
      }
    };
    process();
  }, [files, rulesMap]);

  const errorsCount = results.filter(r => r.severity === 'error').length;
  const warningsCount = results.filter(r => r.severity === 'warning').length;
  const infosCount = results.filter(r => r.severity === 'info').length;
  const capagCount = results.filter(r => r.impactsCapag).length;
  const inconsistencias = errorsCount + warningsCount;

  const suggestedTotal = useMemo(() => {
    return results.reduce((acc, r) => acc + (r.suggestedEntries?.length ?? buildCorrectiveEntries(r, parsedMsc).length), 0);
  }, [results, parsedMsc]);

  const capagNota = useMemo(() => {
    if (!parsedMsc.length) return null;
    try { return calcularCapag(parsedMsc); } catch { return null; }
  }, [parsedMsc]);

  const filteredResults = results.filter(r => {
    if (filter === 'capag' && !r.impactsCapag) return false;
    if (filter !== 'all' && filter !== 'capag' && r.severity !== filter) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      return (
        r.ruleId.toLowerCase().includes(q) ||
        r.description.toLowerCase().includes(q) ||
        r.message.toLowerCase().includes(q) ||
        (r.affectedAccounts ?? []).some(a => a.toLowerCase().includes(q))
      );
    }
    return true;
  });

  const selected = filteredResults[Math.min(selectedIdx, Math.max(0, filteredResults.length - 1))];
  const selectedEntries = selected
    ? (selected.suggestedEntries?.length ? selected.suggestedEntries : buildCorrectiveEntries(selected, parsedMsc))
    : [];

  useEffect(() => { setSelectedIdx(0); }, [filter, search, nav]);

  if (loading) {
    return (
      <div className="loading-state panel">
        <Loader2 className="spinner" size={40} />
        <p>Processando e validando arquivos localmente…</p>
      </div>
    );
  }

  if (processError) {
    return (
      <div className="report-dashboard animate-fade-in">
        <button onClick={onReset} className="inst-btn hide-on-print">
          <ArrowLeft size={16} /> Voltar e Enviar Outros
        </button>
        <div className="result-card severity-error panel panel-pad" style={{ marginTop: '1rem' }}>
          <div className="result-title-group">
            <XCircle className="icon-error" size={18} />
            <span className="rule-id">ERRO DE PROCESSAMENTO</span>
          </div>
          <p>{processError}</p>
        </div>
      </div>
    );
  }

  const exportToCSV = () => {
    const csvData: any[] = [];
    filteredResults.forEach(r => {
      const baseRow = {
        Regra: r.ruleId,
        Dimensao: r.dimension,
        Severidade: r.severity === 'error' ? 'Erro' : r.severity === 'warning' ? 'Aviso' : 'Info',
        'Risco CAPAG': r.impactsCapag ? 'Sim' : 'Nao',
        Descricao: r.description,
        Mensagem: r.message
      };
      if (r.detailedItems && r.detailedItems.length > 0) {
        r.detailedItems.forEach(item => {
          csvData.push({
            ...baseRow,
            Conta: item.conta || '',
            PO: item.po || '',
            FR: item.fr || '',
            CO: item.co || '',
            Valor: item.valor !== undefined ? item.valor.toString().replace('.', ',') : '',
            Detalhe: item.detalhe || ''
          });
        });
      } else {
        csvData.push({
          ...baseRow,
          Conta: r.affectedAccounts ? r.affectedAccounts.join(', ') : '',
          PO: '', FR: '', CO: '', Valor: '', Detalhe: ''
        });
      }
    });
    const csv = Papa.unparse(csvData, { delimiter: ';' });
    const blob = new Blob([new Uint8Array([0xEF, 0xBB, 0xBF]), csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'relatorio_validador_siconfi.csv';
    link.click();
    URL.revokeObjectURL(url);
  };

  const rankingMeta = (): RankingReportMeta => ({
    enteId: reportMeta.enteId,
    exercicio: reportMeta.periodo?.split('-')[0],
    periodos: reportMeta.periodo ? `MSC ${reportMeta.periodo}` : undefined,
    atualizadoEm: new Date().toLocaleString('pt-BR'),
  });

  const openHtmlReport = (html: string) => {
    const w = window.open('', '_blank');
    if (!w) { alert('Permita pop-ups para abrir o relatório.'); return; }
    w.document.write(html);
    w.document.close();
  };

  const openRanking = () => {
    openHtmlReport(buildRankingHtml(buildScoreSummary(results, { rulesMap }), rankingMeta()));
  };
  const openPlanoAcao = () => {
    openHtmlReport(buildPlanoAcaoHtml(buildScoreSummary(results, { rulesMap }), rankingMeta()));
  };

  const exportPDF = () => {
    generatePDF(results, { enteId: reportMeta.enteId, periodo: reportMeta.periodo });
  };

  const copyEntry = async (text: string) => {
    try { await navigator.clipboard.writeText(text); } catch { /* ignore */ }
  };

  /* ── CAPAG view ── */
  if (nav === 'capag') {
    return (
      <div className="report-dashboard animate-fade-in">
        <div className="dash-toolbar hide-on-print">
          <button onClick={onReset} className="inst-btn"><ArrowLeft size={16} /> Nova carga</button>
        </div>
        {parsedMsc.length > 0 ? (
          <CAPAGPanel
            msc={parsedMsc}
            enteId={reportMeta.enteId}
            ano={reportMeta.periodo ? parseInt(reportMeta.periodo.split('-')[0]) : undefined}
            lrfResults={results.map(r => ({ ruleId: r.ruleId, message: r.message, severity: r.severity }))}
          />
        ) : (
          <div className="panel panel-pad"><p>MSC necessária para estimar CAPAG.</p></div>
        )}
      </div>
    );
  }

  /* ── Relatórios / MSC ── */
  if (nav === 'relatorios') {
    return (
      <div className="report-dashboard animate-fade-in">
        <div className="dash-toolbar hide-on-print">
          <button onClick={onReset} className="inst-btn"><ArrowLeft size={16} /> Nova carga</button>
          <button onClick={exportToCSV} className="inst-btn"><Download size={16} /> Exportar CSV</button>
        </div>
        {parsedMsc.length > 0 ? (
          <ReportView msc={parsedMsc} periodos={mscPeriods} />
        ) : (
          <div className="panel panel-pad"><p>Nenhuma MSC carregada.</p></div>
        )}
      </div>
    );
  }

  /* ── Ajustes PCASP ── */
  if (nav === 'ajustes') {
    const withEntries = results
      .map(r => ({ r, entries: r.suggestedEntries?.length ? r.suggestedEntries : buildCorrectiveEntries(r, parsedMsc) }))
      .filter(x => x.entries.length > 0);

    return (
      <div className="report-dashboard animate-fade-in">
        <div className="dash-toolbar hide-on-print">
          <button onClick={onReset} className="inst-btn"><ArrowLeft size={16} /> Nova carga</button>
          <button onClick={openPlanoAcao} className="inst-btn inst-btn-primary"><Lightbulb size={16} /> Plano de Ação</button>
        </div>
        <section className="panel panel-pad">
          <h3 className="section-title">{suggestedTotal} lançamentos PCASP sugeridos</h3>
          <p className="section-sub">Ajustes calculados a partir das inconsistências detectadas (MCASP / PCASP).</p>
        </section>
        <div className="results-list">
          {withEntries.length === 0 ? (
            <div className="success-state panel">
              <CheckCircle size={40} color="var(--success)" />
              <h3>Nenhum ajuste sugerido</h3>
              <p>Não há partidas dobradas geradas para os resultados atuais.</p>
            </div>
          ) : withEntries.map(({ r, entries }, idx) => (
            <div key={idx} className={`result-card panel panel-pad severity-${r.severity}`}>
              <div className="result-title-group">
                <span className={`sev-badge ${r.severity}`}>
                  {r.severity === 'error' ? 'Bloqueio' : r.severity === 'warning' ? 'Alerta' : 'Info'}
                </span>
                <span className="rule-id">Regra {r.ruleId}</span>
              </div>
              <h4>{r.description}</h4>
              {entries.map((e, i) => (
                <div key={i} className="pcasp-block">
                  <div className="pcasp-head">
                    <span>Partida dobrada</span>
                    <button
                      type="button"
                      className="inst-btn"
                      onClick={() => copyEntry(`(D) ${e.debito.conta} ${e.debito.descricao}\n(C) ${e.credito.conta} ${e.credito.descricao}\nValor: ${e.valor ?? ''}`)}
                    >
                      <Copy size={14} /> Copiar
                    </button>
                  </div>
                  <div className="pcasp-lines">
                    <div><span className="dc d">(D)</span> <code>{e.debito.conta}</code> <span className="muted">{e.debito.descricao}</span></div>
                    <div><span className="dc c">(C)</span> <code>{e.credito.conta}</code> <span className="muted">{e.credito.descricao}</span></div>
                  </div>
                  {e.valor !== undefined && (
                    <div className="pcasp-valor">Valor: <strong>R$ {e.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</strong></div>
                  )}
                  {e.obs && <p className="pcasp-obs">{e.obs}</p>}
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    );
  }

  /* ── Validações (default) ── */
  return (
    <div className="report-dashboard animate-fade-in">
      <div className="dash-toolbar hide-on-print">
        <button onClick={onReset} className="inst-btn">
          <ArrowLeft size={16} /> Nova carga
        </button>
        <div className="export-actions">
          <button onClick={exportToCSV} className="inst-btn"><Download size={16} /> Exportar CSV</button>
          <button onClick={exportPDF} className="inst-btn"><FileText size={16} /> Relatório PDF</button>
          <button onClick={openRanking} className="inst-btn"><BarChart3 size={16} /> Ranking STN</button>
          <button onClick={openPlanoAcao} className="inst-btn inst-btn-primary"><Lightbulb size={16} /> Plano de Ação</button>
        </div>
      </div>

      {/* KPIs */}
      <section className="kpi-grid">
        <div className="kpi-card panel">
          <div className="kpi-meta">
            <span>Tesouro Nacional</span>
            <span>Metodologia STN</span>
          </div>
          <div className="kpi-head">
            <h4>CAPAG Estimada</h4>
            <span className={`kpi-nota nota-${capagNota?.notaGeral ?? 'x'}`}>{capagNota?.notaGeral ?? '–'}</span>
          </div>
          <div className="kpi-value">
            Nota {capagNota?.notaGeral ?? '–'}
            <span className="kpi-hint">{capagNota ? 'Estimativa a partir da MSC' : 'Carregue a MSC'}</span>
          </div>
          {capagNota && (
            <div className="kpi-foot mono-rows">
              {capagNota.indicadores.slice(0, 3).map(ind => (
                <div key={ind.nome} className="mono-row">
                  <span>{ind.nome}</span>
                  <span>{ind.resultado !== null ? `${(ind.resultado * 100).toFixed(1)}%` : '–'} <em>({ind.nota})</em></span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="kpi-card panel">
          <div className="kpi-meta">
            <span>Diagnóstico da Remessa</span>
            <span className={errorsCount ? 'text-danger' : ''}>{errorsCount ? 'Bloqueios ativos' : 'Sem bloqueios'}</span>
          </div>
          <div className="kpi-head">
            <h4>Inconsistências STN</h4>
            <ShieldAlert size={20} className={errorsCount ? 'icon-error' : 'icon-muted'} />
          </div>
          <div className="kpi-value">
            {inconsistencias}
            <span className="kpi-hint">apontamentos em {results.length} ocorrências</span>
          </div>
          <div className="kpi-foot sev-row">
            <span className="sev-dot danger">{errorsCount} Bloqueantes</span>
            <span className="sev-dot warn">{warningsCount} Moderadas</span>
            <span className="sev-dot info">{infosCount} Avisos</span>
          </div>
        </div>

        <div className="kpi-card panel">
          <div className="kpi-meta">
            <span>Risco CAPAG</span>
            <span>{capagCount ? 'Atenção' : 'Estável'}</span>
          </div>
          <div className="kpi-head">
            <h4>Regras com impacto CAPAG</h4>
          </div>
          <div className="kpi-value">
            {capagCount}
            <span className="kpi-hint">podem afetar nota / Ranking ICF</span>
          </div>
          <div className="kpi-foot">
            <button type="button" className="link-btn" onClick={() => setFilter('capag')}>
              Filtrar riscos CAPAG →
            </button>
          </div>
        </div>

        <div className="kpi-card panel">
          <div className="kpi-meta">
            <span>Contabilidade Corretiva</span>
            <span>Regularização</span>
          </div>
          <div className="kpi-head">
            <h4>Lançamentos Sugeridos</h4>
          </div>
          <div className="kpi-value">
            {suggestedTotal}
            <span className="kpi-hint">partidas dobradas prontas</span>
          </div>
          <div className="kpi-foot">
            <span className="muted">PCASP · Classes orçamentárias e patrimoniais</span>
          </div>
        </div>
      </section>

      {/* Lista + painel IA/orientação */}
      <section className="audit-grid">
        <div className="audit-main">
          <div className="filters-bar panel hide-on-print">
            <div className="filter-tabs">
              <button className={filter === 'all' ? 'active' : ''} onClick={() => setFilter('all')}>
                Todas <span className="count">{results.length}</span>
              </button>
              <button className={filter === 'error' ? 'active' : ''} onClick={() => setFilter('error')}>
                Críticas <span className="count danger">{errorsCount}</span>
              </button>
              <button className={filter === 'warning' ? 'active' : ''} onClick={() => setFilter('warning')}>
                Moderadas <span className="count warn">{warningsCount}</span>
              </button>
              <button className={filter === 'info' ? 'active' : ''} onClick={() => setFilter('info')}>
                Informativas <span className="count">{infosCount}</span>
              </button>
              <button className={filter === 'capag' ? 'active' : ''} onClick={() => setFilter('capag')}>
                CAPAG <span className="count warn">{capagCount}</span>
              </button>
            </div>
            <div className="search-wrap">
              <Search size={16} />
              <input
                type="text"
                placeholder="Filtrar por regra, conta ou fonte…"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
          </div>

          <div className="results-list">
            {filteredResults.length === 0 ? (
              <div className="success-state panel">
                <CheckCircle size={40} color="var(--success)" />
                <h3>Tudo certo</h3>
                <p>Nenhuma inconsistência para o filtro selecionado.</p>
              </div>
            ) : filteredResults.map((result, idx) => (
              <button
                type="button"
                key={`${result.ruleId}-${idx}`}
                className={`result-card panel panel-pad severity-${result.severity} ${result.impactsCapag ? 'capag-alert' : ''} ${selected === result ? 'selected' : ''}`}
                onClick={() => setSelectedIdx(idx)}
              >
                <div className="result-card-top">
                  <div className="result-title-group">
                    <span className={`sev-badge ${result.severity}`}>
                      {result.severity === 'error' ? 'Bloqueio Siconfi' : result.severity === 'warning' ? 'Alerta Moderado' : 'Informativo'}
                    </span>
                    <span className="rule-id">Regra {result.ruleId}</span>
                    <span className="dim-tag">{result.dimension}</span>
                    {result.impactsCapag && <span className="capag-badge">CAPAG</span>}
                  </div>
                  {result.severity === 'error' ? <XCircle className="icon-error" size={18} /> : <AlertTriangle className="icon-warning" size={18} />}
                </div>
                <h4>{result.description}</h4>
                <div className="result-msg">{result.message}</div>
                {result.actionPlan && (
                  <div className="action-plan-card">
                    <Lightbulb className="action-icon" size={16} />
                    <span>{result.actionPlan}</span>
                  </div>
                )}
                {result.detailedItems && result.detailedItems.length > 0 && (
                  <details className="detailed-items-dropdown" onClick={e => e.stopPropagation()}>
                    <summary>Ver {result.detailedItems.length} lançamentos detalhados</summary>
                    <div className="table-responsive">
                      <table className="details-table">
                        <thead>
                          <tr>
                            <th>Conta</th><th>PO</th><th>FR</th><th>Valor (R$)</th><th>Detalhe</th>
                          </tr>
                        </thead>
                        <tbody>
                          {result.detailedItems.map((item, i) => (
                            <tr key={i}>
                              <td className="account-cell">{item.conta}</td>
                              <td>{item.po || '-'}</td>
                              <td>{item.fr || '-'}</td>
                              <td>{item.valor !== undefined ? item.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : '-'}</td>
                              <td>{item.detalhe || '-'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </details>
                )}
              </button>
            ))}
          </div>
        </div>

        <aside className="audit-side hide-on-print">
          <div className="panel panel-pad ai-orient">
            <div className="ai-orient-head">
              <div className="ai-orient-title">
                <Bot size={18} />
                <div>
                  <strong>Orientação Técnica</strong>
                  <span>MCASP · Portaria STN</span>
                </div>
              </div>
            </div>
            {selected ? (
              <>
                <div className="ai-orient-body">
                  <div className="ai-orient-label">
                    <Lightbulb size={14} /> Diagnóstico · {selected.ruleId}
                  </div>
                  <p>{selected.message}</p>
                  {selected.actionPlan && <p><strong>Plano:</strong> {selected.actionPlan}</p>}
                </div>
                {selectedEntries[0] && (
                  <div className="pcasp-block dark">
                    <div className="pcasp-head">
                      <span>Partida dobrada sugerida</span>
                    </div>
                    <div className="pcasp-lines">
                      <div><span className="dc d">(D)</span> {selectedEntries[0].debito.conta}</div>
                      <div><span className="dc c">(C)</span> {selectedEntries[0].credito.conta}</div>
                    </div>
                    {selectedEntries[0].valor !== undefined && (
                      <div className="pcasp-valor">R$ {selectedEntries[0].valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
                    )}
                  </div>
                )}
                {selectedEntries[0] && (
                  <button
                    type="button"
                    className="inst-btn inst-btn-primary"
                    style={{ width: '100%', justifyContent: 'center' }}
                    onClick={() => {
                      const e = selectedEntries[0];
                      copyEntry(`(D) ${e.debito.conta}\n(C) ${e.credito.conta}\n${e.valor ?? ''}`);
                    }}
                  >
                    <Copy size={14} /> Copiar lançamento
                  </button>
                )}
              </>
            ) : (
              <p className="muted">Selecione uma inconsistência na lista.</p>
            )}
          </div>
        </aside>
      </section>
    </div>
  );
}
