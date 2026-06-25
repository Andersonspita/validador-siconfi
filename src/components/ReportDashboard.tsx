import { useEffect, useState } from 'react';
import { parseFiles } from '../core/parsers';
import { runValidations } from '../core/validatorEngine';
import { ValidationResult, RuleDefinition } from '../core/types';
import { generatePDF } from '../core/pdfGenerator';
import Papa from 'papaparse';
import { CheckCircle, AlertTriangle, XCircle, ArrowLeft, Loader2, ShieldAlert, Download, Printer, Lightbulb } from 'lucide-react';
import './ReportDashboard.css';

interface ReportDashboardProps {
  files: File[];
  rulesMap: Map<string, RuleDefinition>;
  onReset: () => void;
}

export default function ReportDashboard({ files, rulesMap, onReset }: ReportDashboardProps) {
  const [loading, setLoading] = useState(true);
  const [results, setResults] = useState<ValidationResult[]>([]);
  const [filter, setFilter] = useState<'all' | 'error' | 'warning' | 'info' | 'capag'>('all');
  const [processError, setProcessError] = useState<string | null>(null);
  const [reportMeta, setReportMeta] = useState<{ enteId?: string; periodo?: string }>({});

  useEffect(() => {
    const process = async () => {
      try {
        setProcessError(null);
        const parsedData = await parseFiles(files);
        const validationResults = await runValidations(parsedData, rulesMap);
        setResults(validationResults);
        const periods = parsedData.mscPeriods ?? [];
        setReportMeta({
          enteId: parsedData.enteId,
          periodo: periods.length === 1 ? periods[0] : periods.length > 1 ? `${periods[0]} a ${periods[periods.length - 1]}` : parsedData.anoReferencia,
        });
      } catch (err) {
        console.error('Error processing files:', err);
        setProcessError(
          err instanceof Error
            ? `Falha ao processar os arquivos: ${err.message}`
            : 'Falha ao processar os arquivos. Verifique se os arquivos não estão corrompidos ou em formato incompatível.'
        );
        setResults([]);
      } finally {
        setLoading(false);
      }
    };
    process();
  }, [files, rulesMap]);

  if (loading) {
    return (
      <div className="loading-state glass-panel">
        <Loader2 className="spinner" size={48} />
        <p>Processando e validando seus arquivos localmente...</p>
      </div>
    );
  }

  if (processError) {
    return (
      <div className="report-dashboard animate-fade-in">
        <button onClick={onReset} className="back-btn glass-panel hide-on-print">
          <ArrowLeft size={20} />
          Voltar e Enviar Outros
        </button>
        <div className="result-card glass-panel error-stat" style={{ marginTop: '1.5rem' }}>
          <div className="result-header">
            <XCircle className="icon-error" />
            <span className="rule-id">ERRO DE PROCESSAMENTO</span>
          </div>
          <div className="result-body">
            <p>{processError}</p>
          </div>
        </div>
      </div>
    );
  }

  const filteredResults = results.filter(r => {
    if (filter === 'all') return true;
    if (filter === 'capag') return r.impactsCapag;
    return r.severity === filter;
  });

  const errorsCount = results.filter(r => r.severity === 'error').length;
  const warningsCount = results.filter(r => r.severity === 'warning').length;
  const infosCount = results.filter(r => r.severity === 'info').length;
  const capagCount = results.filter(r => r.impactsCapag).length;

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

  return (
    <div className="report-dashboard animate-fade-in">
      <div className="dashboard-header">
        <div className="header-actions-row">
          <button onClick={onReset} className="back-btn glass-panel hide-on-print">
            <ArrowLeft size={20} />
            Voltar e Enviar Outros
          </button>
          <div className="export-actions hide-on-print">
            <button onClick={exportToCSV} className="export-btn glass-panel">
              <Download size={20} />
              Exportar CSV
            </button>
            <button onClick={() => generatePDF(filteredResults, reportMeta)} className="export-btn glass-panel print-btn">
              <Printer size={20} />
              Gerar Relatório Oficial (PDF)
            </button>
          </div>
        </div>
        <div className="summary-stats">
          <div className="stat-card glass-panel">
            <span className="stat-value">{errorsCount + warningsCount}</span>
            <span className="stat-label">Inconsistências (Erros + Avisos)</span>
          </div>
          <div className="stat-card glass-panel error-stat">
            <span className="stat-value">{errorsCount}</span>
            <span className="stat-label">Erros Críticos</span>
          </div>
          <div className="stat-card glass-panel warning-stat">
            <span className="stat-value">{warningsCount}</span>
            <span className="stat-label">Avisos</span>
          </div>
          <div className="stat-card glass-panel info-stat">
            <span className="stat-value">{infosCount}</span>
            <span className="stat-label">Informativos</span>
          </div>
          <div className="stat-card glass-panel capag-stat">
            <span className="stat-value">{capagCount}</span>
            <span className="stat-label">Riscos CAPAG</span>
          </div>
        </div>
      </div>

      <div className="filters-container glass-panel hide-on-print">
        <button className={`filter-btn ${filter === 'all' ? 'active' : ''}`} onClick={() => setFilter('all')}>Todas as Regras</button>
        <button className={`filter-btn ${filter === 'error' ? 'active' : ''}`} onClick={() => setFilter('error')}>Erros</button>
        <button className={`filter-btn ${filter === 'warning' ? 'active' : ''}`} onClick={() => setFilter('warning')}>Avisos</button>
        <button className={`filter-btn ${filter === 'info' ? 'active' : ''}`} onClick={() => setFilter('info')}>Informativos</button>
        <button className={`filter-btn capag-filter ${filter === 'capag' ? 'active' : ''}`} onClick={() => setFilter('capag')}>
          <ShieldAlert size={16} /> Riscos CAPAG
        </button>
      </div>

      <div className="results-list">
        {filteredResults.length === 0 ? (
          <div className="success-state glass-panel">
            <CheckCircle size={48} color="var(--success)" />
            <h3>Tudo Certo!</h3>
            <p>Nenhuma inconsistência encontrada para o filtro selecionado.</p>
          </div>
        ) : (
          filteredResults.map((result, idx) => (
            <div key={idx} className={`result-card glass-panel ${result.severity} ${result.impactsCapag ? 'capag-alert' : ''}`}>
              <div className="result-header">
                <div className="result-title-group">
                  {result.severity === 'error' ? <XCircle className="icon-error" /> : <AlertTriangle className="icon-warning" />}
                  <span className="rule-id">{result.ruleId}</span>
                  <span className="dimension-badge">{result.dimension}</span>
                  {result.impactsCapag && <span className="capag-badge">CAPAG</span>}
                </div>
              </div>
              <div className="result-body">
                <h4>{result.description}</h4>
                <p>{result.message}</p>
                
                {result.actionPlan && (
                  <div className="action-plan-card">
                    <Lightbulb className="action-icon" size={20} />
                    <span>{result.actionPlan}</span>
                  </div>
                )}
                
                {result.detailedItems && result.detailedItems.length > 0 ? (
                  <details className="detailed-items-dropdown">
                    <summary>Ver os {result.detailedItems.length} lançamentos detalhados</summary>
                    <div className="table-responsive">
                      <table className="details-table">
                        <thead>
                          <tr>
                            <th>Conta</th>
                            <th>PO</th>
                            <th>FR</th>
                            <th>Valor (R$)</th>
                            <th>Detalhe Adicional</th>
                          </tr>
                        </thead>
                        <tbody>
                          {result.detailedItems.map((item, i) => (
                            <tr key={i}>
                              <td className="account-cell">{item.conta}</td>
                              <td>{item.po || '-'}</td>
                              <td>{item.fr || '-'}</td>
                              <td>{item.valor !== undefined ? item.valor.toLocaleString('pt-BR', {minimumFractionDigits: 2}) : '-'}</td>
                              <td className="detail-cell">{item.detalhe || '-'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </details>
                ) : result.affectedAccounts && result.affectedAccounts.length > 0 && (
                  <div className="affected-accounts">
                    <strong>Contas Afetadas:</strong>
                    <div className="accounts-list">
                      {result.affectedAccounts.map(acc => <span key={acc} className="account-tag">{acc}</span>)}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
