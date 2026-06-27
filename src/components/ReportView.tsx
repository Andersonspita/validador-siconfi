import { useState, useMemo } from 'react';
import { MSCAccount } from '../core/types';
import { gerarRelatorio, proximoNivel, brl, Agrupamento, TipoSaldo, ReportResult } from '../core/reportEngine';
import './ReportView.css';

interface Props {
  msc: MSCAccount[];
  periodos: string[];
}

interface DrillLevel {
  agrupamento: Agrupamento;
  filtros: Record<string, string>;
  label: string; // breadcrumb
}

const AGRUPAMENTOS: { value: Agrupamento; label: string }[] = [
  { value: 'funcao',    label: 'Função' },
  { value: 'subfuncao', label: 'Função / Subfunção' },
  { value: 'fonte',     label: 'Fonte de Recurso' },
  { value: 'natureza',  label: 'Natureza de Despesa' },
  { value: 'orgao',     label: 'Órgão / Poder' },
];

export default function ReportView({ msc, periodos }: Props) {
  const [tipoSaldo, setTipoSaldo] = useState<TipoSaldo>('period_change');
  const [agrupamentoBase, setAgrupamentoBase] = useState<Agrupamento>('funcao');
  const [stack, setStack] = useState<DrillLevel[]>([]);

  const current: DrillLevel = stack.length > 0
    ? stack[stack.length - 1]
    : { agrupamento: agrupamentoBase, filtros: {}, label: 'Início' };

  const relatorio: ReportResult = useMemo(() => {
    return gerarRelatorio(msc, current.agrupamento, tipoSaldo, current.filtros as any);
  }, [msc, current.agrupamento, current.filtros, tipoSaldo]);

  function handleDrillDown(chave: string, rowLabel: string) {
    const { agrupamento, filtro } = proximoNivel(current.agrupamento, chave);
    if (agrupamento === current.agrupamento) return; // sem próximo nível
    setStack(prev => [
      ...prev,
      { agrupamento, filtros: { ...current.filtros, ...filtro }, label: rowLabel },
    ]);
  }

  function handleBack(idx: number) {
    setStack(prev => prev.slice(0, idx));
  }

  function handleAgrupamentoChange(ag: Agrupamento) {
    setAgrupamentoBase(ag);
    setStack([]);
  }

  function exportCSV() {
    const headers = ['Agrupamento', 'Descrição', 'Empenhado', 'Liquidado', 'Pago'];
    const rows = relatorio.rows.map(r => [
      r.chave, r.label,
      r.empenhado.toFixed(2), r.liquidado.toFixed(2), r.pago.toFixed(2),
    ]);
    const csv = [headers, ...rows].map(r => r.join(';')).join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `relatorio_despesas_${periodos.join('_')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const periodLabel = periodos.length === 1
    ? periodos[0]
    : periodos.length > 1 ? `${periodos[0]} a ${periodos[periodos.length - 1]}` : '—';

  return (
    <div className="report-view">
      {/* Controles */}
      <div className="report-controls">
        <div className="control-group">
          <label>Agrupar por</label>
          <div className="segmented">
            {AGRUPAMENTOS.map(ag => (
              <button
                key={ag.value}
                className={agrupamentoBase === ag.value && stack.length === 0 ? 'active' : ''}
                onClick={() => handleAgrupamentoChange(ag.value)}
              >
                {ag.label}
              </button>
            ))}
          </div>
        </div>
        <div className="control-group">
          <label>Saldo</label>
          <div className="segmented">
            <button
              className={tipoSaldo === 'period_change' ? 'active' : ''}
              style={tipoSaldo === 'period_change'
                ? { background: '#2563eb', color: '#fff', fontWeight: 600 }
                : undefined}
              onClick={() => setTipoSaldo('period_change')}
              title="Movimentação ocorrida no período"
            >Movimentação</button>
            <button
              className={tipoSaldo === 'ending_balance' ? 'active' : ''}
              style={tipoSaldo === 'ending_balance'
                ? { background: '#2563eb', color: '#fff', fontWeight: 600 }
                : undefined}
              onClick={() => setTipoSaldo('ending_balance')}
              title="Saldo acumulado (Saldo Final)"
            >Acumulado</button>
          </div>
        </div>
        <button className="btn-export" onClick={exportCSV} title="Exportar tabela como CSV">
          ⬇ Exportar CSV
        </button>
      </div>

      {/* Cabeçalho */}
      <div className="report-header">
        <div className="report-meta">
          <span className="report-title">Execução Orçamentária — Despesas</span>
          <span className="report-period">Período: {periodLabel}</span>
          <span className="report-type">
            {tipoSaldo === 'period_change' ? 'Movimentação do período' : 'Saldo final acumulado'}
          </span>
        </div>
      </div>

      {/* Breadcrumb de drill-down */}
      {stack.length > 0 && (
        <div className="breadcrumb">
          <button className="btn-back" onClick={() => handleBack(0)}>← Início</button>
          {stack.map((lvl, i) => (
            <span key={i}>
              <span className="breadcrumb-sep">/</span>
              {i < stack.length - 1
                ? <button className="btn-back" onClick={() => handleBack(i + 1)}>{lvl.label}</button>
                : <span className="breadcrumb-current">{lvl.label}</span>
              }
            </span>
          ))}
        </div>
      )}

      {/* Tabela */}
      {relatorio.rows.length === 0 ? (
        <div className="report-empty">
          Nenhum dado de despesa encontrado com os filtros selecionados.
          <br />
          <small>Verifique se a MSC contém contas 622xxx com Função/Subfunção (FS) preenchida.</small>
        </div>
      ) : (
        <div className="report-table-wrap">
          <table className="report-table">
            <thead>
              <tr>
                <th className="col-funcao">
                  {AGRUPAMENTOS.find(a => a.value === current.agrupamento)?.label}
                </th>
                <th className="col-valor">Empenhado (R$)</th>
                <th className="col-valor">Liquidado (R$)</th>
                <th className="col-valor">Pago (R$)</th>
              </tr>
            </thead>
            <tbody>
              {relatorio.rows.map(row => (
                <tr
                  key={row.chave}
                  className={row.hasChildren ? 'clickable' : ''}
                  onClick={() => row.hasChildren && handleDrillDown(row.chave, row.label)}
                >
                  <td className="col-funcao">
                    {row.hasChildren ? (
                      <span className="drill-link">
                        <strong>{row.chave}</strong>
                        {row.label !== row.chave && ` — ${row.label.replace(row.chave, '').replace(' - ', '').replace(/^\s*\(.*\)\s*$/, '').trim()}`}
                        <span className="drill-icon">▶</span>
                      </span>
                    ) : (
                      <span><strong>{row.chave}</strong>{row.label !== row.chave && ` — ${row.label.replace(row.chave + ' - ', '')}`}</span>
                    )}
                  </td>
                  <td className="col-valor">{brl(row.empenhado)}</td>
                  <td className="col-valor">{brl(row.liquidado)}</td>
                  <td className="col-valor">{brl(row.pago)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="total-row">
                <td><strong>TOTAL</strong></td>
                <td className="col-valor"><strong>{brl(relatorio.totais.empenhado)}</strong></td>
                <td className="col-valor"><strong>{brl(relatorio.totais.liquidado)}</strong></td>
                <td className="col-valor"><strong>{brl(relatorio.totais.pago)}</strong></td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      <p className="report-note">
        ⚠ Valores extraídos diretamente da MSC. Empenhado = conta 622130100 |
        Liquidado = 622130200/300/400 | Pago = 622130300/400.
        Confira com o RREO Anexo 02 para validação cruzada.
      </p>
    </div>
  );
}
