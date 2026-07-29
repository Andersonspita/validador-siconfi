import {
  ScoreSummary, ScoredCheck, CheckStatus,
  STATUS_LABELS, STATUS_COLORS, CLASSE_COLORS, classeFromPercent,
} from './scoring';

export interface RankingReportMeta {
  enteId?: string;
  enteNome?: string;
  uf?: string;
  exercicio?: string;
  periodos?: string;      // ex.: "RREO 2026 (2º bim) • RGF 2026 (1º quadr) • MSC 2026-01…2026-05 (5)"
  pastaOrigem?: string;
  atualizadoEm?: string;  // ex.: "23/07/2026 11:52"
}

const esc = (s: string): string =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const pct = (v: number) => `${v.toFixed(1)}%`;
const pts = (v: number) => v.toFixed(2).replace('.', ',');

const statusOrder: CheckStatus[] = ['FALHA', 'ATENCAO', 'OK', 'NAO_VERIFICAVEL', 'NAO_APLICAVEL'];

const CSS = `
:root{
  --ink:#1a1a1a; --muted:#666; --line:#e3e3e3; --bg:#fff;
  --brand:#1f8a4c; --brand-soft:#eef7f1;
}
*{box-sizing:border-box}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;
  color:var(--ink);margin:0;padding:24px;background:#f5f6f7;font-size:13px;line-height:1.45}
.sheet{max-width:1080px;margin:0 auto;background:var(--bg);padding:32px 36px;
  border-radius:10px;box-shadow:0 1px 4px rgba(0,0,0,.08)}
h1{font-size:18px;margin:0 0 4px;color:var(--brand)}
.sub{color:var(--muted);font-size:12px;margin-bottom:2px}
.grid{display:grid;grid-template-columns:220px 1fr;gap:24px;margin:22px 0 8px;align-items:center}
.classe-card{border:2px solid var(--line);border-radius:12px;padding:18px;text-align:center}
.classe-badge{font-size:52px;font-weight:800;line-height:1}
.classe-pct{font-size:26px;font-weight:700;margin-top:4px}
.classe-cap{color:var(--muted);font-size:11px;margin-top:6px}
.ladder{display:flex;gap:4px;justify-content:center;margin-top:10px}
.ladder span{width:26px;height:26px;border-radius:6px;display:flex;align-items:center;
  justify-content:center;font-weight:700;color:#fff;font-size:13px;opacity:.35}
.ladder span.on{opacity:1;outline:2px solid #0003}
.dims{display:flex;flex-direction:column;gap:12px}
.dimrow{display:grid;grid-template-columns:150px 1fr 70px;gap:10px;align-items:center}
.dimname{font-weight:600}
.bar{background:#eee;border-radius:6px;height:16px;overflow:hidden}
.bar>i{display:block;height:100%;background:var(--brand);border-radius:6px}
.dimval{text-align:right;font-variant-numeric:tabular-nums;color:var(--muted)}
.totline{margin-top:8px;font-weight:700;border-top:1px solid var(--line);padding-top:8px;
  display:grid;grid-template-columns:150px 1fr 70px;gap:10px}
.chips{display:flex;flex-wrap:wrap;gap:8px;margin:18px 0}
.chip{border-radius:20px;padding:5px 12px;color:#fff;font-size:12px;font-weight:600}
.chip small{opacity:.85;font-weight:400}
table{width:100%;border-collapse:collapse;margin-top:14px;font-size:11.5px}
th,td{text-align:left;padding:7px 8px;border-bottom:1px solid var(--line);vertical-align:top}
th{background:var(--brand-soft);color:#14512c;font-size:11px;text-transform:uppercase;letter-spacing:.3px}
td.id{font-family:ui-monospace,Menlo,Consolas,monospace;white-space:nowrap;font-weight:600}
.stag{display:inline-block;border-radius:4px;padding:2px 7px;color:#fff;font-size:10.5px;
  font-weight:700;white-space:nowrap}
td.det{color:#333}
td.pt{text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap}
.foot{color:var(--muted);font-size:10.5px;margin-top:18px;border-top:1px solid var(--line);padding-top:10px}
.dimhead td{background:#fafafa;font-weight:700;color:#333;border-top:2px solid var(--line)}
@media print{
  body{background:#fff;padding:0;font-size:11px}
  .sheet{box-shadow:none;border-radius:0;max-width:none;padding:12px 16px}
  tr{break-inside:avoid}
  thead{display:table-header-group}
}
`;

const statusTag = (s: CheckStatus): string =>
  `<span class="stag" style="background:${STATUS_COLORS[s]}">${STATUS_LABELS[s]}</span>`;

const ladder = (classe: string): string =>
  (['E', 'D', 'C', 'B', 'A'] as const)
    .map(l => `<span class="${l === classe ? 'on' : ''}" style="background:${CLASSE_COLORS[l]}">${l}</span>`)
    .join('');

const rowsByDimension = (checks: ScoredCheck[]): string => {
  const dims = ['D1', 'D2', 'D3', 'D4'] as const;
  const parts: string[] = [];
  for (const d of dims) {
    const group = checks
      .filter(c => c.dimension === d)
      .sort((a, b) => statusOrder.indexOf(a.status) - statusOrder.indexOf(b.status)
        || a.ruleId.localeCompare(b.ruleId));
    if (!group.length) continue;
    const label = group[0].dimensionLabel;
    parts.push(`<tr class="dimhead"><td colspan="5">${d} — ${esc(label)} (${group.length})</td></tr>`);
    for (const c of group) {
      const ptCell = c.avaliavel ? `${pts(c.pontos)} / ${pts(c.maxPontos)}` : '—';
<<<<<<< HEAD
      const capagTag = c.impactsCapag ? ' <span class="stag" style="background:#5b3fa0;font-size:9px">CAPAG</span>' : '';
      parts.push(
        `<tr>
          <td class="id">${esc(c.ruleId)}${capagTag}</td>
=======
      parts.push(
        `<tr>
          <td class="id">${esc(c.ruleId)}</td>
>>>>>>> e101a96cfa07f08cc6e8f2b75c0a15d153bdc75a
          <td>${esc(c.descricao)}</td>
          <td>${statusTag(c.status)}</td>
          <td class="det">${esc(c.detalhe.length > 260 ? c.detalhe.slice(0, 260) + '…' : c.detalhe)}</td>
          <td class="pt">${ptCell}</td>
        </tr>`
      );
    }
  }
  return parts.join('\n');
};

/** Gera o HTML completo do "Ranking da Qualidade" (tela + imprimir/PDF). */
export const buildRankingHtml = (score: ScoreSummary, meta: RankingReportMeta = {}): string => {
  const enteTitulo = [meta.enteId, meta.enteNome].filter(Boolean).join(' - ')
    + (meta.uf ? ` - ${meta.uf}` : '');
  const c = score.contagemStatus;
  const chips: [CheckStatus, number][] = [
    ['OK', c.OK], ['FALHA', c.FALHA], ['ATENCAO', c.ATENCAO],
    ['NAO_VERIFICAVEL', c.NAO_VERIFICAVEL], ['NAO_APLICAVEL', c.NAO_APLICAVEL],
  ];

  const dimBars = score.porDimensao.map(d => `
    <div class="dimrow">
      <div class="dimname">${esc(d.label)}</div>
      <div class="bar"><i style="width:${Math.max(0, Math.min(100, d.percentual)).toFixed(1)}%"></i></div>
      <div class="dimval">${pct(d.percentual)}</div>
    </div>`).join('');

  const metaMax = classeFromPercent(96); // sempre 'A' — usado só p/ texto da meta

  return `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8">
<title>Verificador Siconfi — Ranking da Qualidade${meta.enteId ? ' — ' + esc(meta.enteId) : ''}</title>
<style>${CSS}</style></head>
<body><div class="sheet">
  <h1>Verificador Siconfi — Ranking da Qualidade (STN)</h1>
  <div class="sub">${esc(enteTitulo)}${meta.periodos ? '  •  ' + esc(meta.periodos) : ''}</div>
  ${meta.atualizadoEm ? `<div class="sub">atualizado em ${esc(meta.atualizadoEm)}</div>` : ''}
  ${meta.pastaOrigem ? `<div class="sub">📁 ${esc(meta.pastaOrigem)}</div>` : ''}

  <div class="grid">
    <div class="classe-card">
      <div class="classe-badge" style="color:${CLASSE_COLORS[score.classe]}">${score.classe}</div>
      <div class="classe-pct" style="color:${CLASSE_COLORS[score.classe]}">${pct(score.percentual)}</div>
      <div class="classe-cap">de acertos nas verificações avaliáveis</div>
      <div class="ladder">${ladder(score.classe)}</div>
    </div>
    <div>
      <div class="dims">${dimBars}
        <div class="totline">
          <div>TOTAL</div>
          <div style="color:var(--muted)">${pts(score.pontosObtidos)} de ${pts(score.pontosAvaliaveis)} pontos avaliáveis · meta classe ${metaMax}: acima de 95%</div>
          <div class="dimval">${pct(score.percentual)}</div>
        </div>
      </div>
    </div>
  </div>

  <div class="chips">
    ${chips.map(([s, n]) => `<span class="chip" style="background:${STATUS_COLORS[s]}">${n} <small>${STATUS_LABELS[s]}</small></span>`).join('')}
  </div>

  <table>
    <thead><tr>
      <th>Verificação</th><th>Descrição</th><th>Status</th><th>Detalhe</th><th>Pontos</th>
    </tr></thead>
    <tbody>${rowsByDimension(score.checks)}</tbody>
  </table>

  <div class="foot">
    OK = regra atendida • FALHA = inconsistência encontrada • ATENÇÃO = conferência manual •
    NÃO VERIFICÁVEL = dados ausentes • NÃO APLICÁVEL = fora do escopo de municípios.
<<<<<<< HEAD
    ICF = percentual de acertos nas verificações avaliáveis (metodologia simplificada do Ranking da
    Qualidade da Informação Contábil e Fiscal — STN). Faixas oficiais: A &gt; 95%, E &lt; 65%;
    B/C/D em degraus de 10 p.p. Pontuação proporcional nas verificações de MSC (cada matriz vale
    1/13, ou 1/12 quando não conta a de encerramento). Verificações CAPAG destacadas.
    Fonte: ranking-municipios.tesouro.gov.br/metodologia. Gerado pelo Validador Siconfi.
=======
    Pontuação estimada pela metodologia simplificada do Ranking (STN): percentual de acertos,
    com pontuação proporcional nos checks mensais de MSC. Faixas A (&gt;95%) e E (&lt;65%) publicadas;
    B/C/D estimadas em degraus de 10 p.p. Gerado pelo Validador Siconfi.
>>>>>>> e101a96cfa07f08cc6e8f2b75c0a15d153bdc75a
  </div>
</div></body></html>`;
};

/** Gera o HTML do "Plano de Ação" — só itens a corrigir (FALHA/ATENÇÃO), por dimensão. */
export const buildPlanoAcaoHtml = (score: ScoreSummary, meta: RankingReportMeta = {}): string => {
  const enteTitulo = [meta.enteId, meta.enteNome].filter(Boolean).join(' - ')
    + (meta.uf ? ` - ${meta.uf}` : '');
  const acorrigir = score.checks.filter(c => c.status === 'FALHA' || c.status === 'ATENCAO');
  const dims = ['D1', 'D2', 'D3', 'D4'] as const;

  const blocks = dims.map(d => {
    const grp = acorrigir.filter(c => c.dimension === d);
    if (!grp.length) return '';
    const label = grp[0].dimensionLabel;
    const items = grp.map(c => `
      <div class="pa-item">
        <div class="pa-id">${esc(c.ruleId)} <span class="stag" style="background:${STATUS_COLORS[c.status]}">${STATUS_LABELS[c.status]}</span></div>
        <div class="pa-desc">${esc(c.descricao)}</div>
        <div class="pa-lbl">SITUAÇÃO ENCONTRADA</div>
        <div class="pa-txt">${esc(c.detalhe)} <span class="pa-pt">• pontos obtidos: ${pts(c.pontos)} de ${pts(c.maxPontos)}</span></div>
        ${c.actionPlan ? `<div class="pa-lbl">COMO CORRIGIR</div><div class="pa-txt">${esc(c.actionPlan)}</div>` : ''}
      </div>`).join('');
    return `<h2>${esc(label)}</h2>${items}`;
  }).join('');

  return `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8">
<title>Plano de Ação — Verificador Siconfi${meta.enteId ? ' — ' + esc(meta.enteId) : ''}</title>
<style>${CSS}
h2{font-size:14px;color:#14512c;border-bottom:2px solid var(--brand-soft);padding-bottom:4px;margin:20px 0 10px}
.pa-item{border:1px solid var(--line);border-radius:8px;padding:12px 14px;margin-bottom:12px}
.pa-id{font-family:ui-monospace,Menlo,Consolas,monospace;font-weight:700;margin-bottom:2px}
.pa-desc{font-weight:600;margin-bottom:8px}
.pa-lbl{font-size:10.5px;letter-spacing:.4px;color:var(--muted);font-weight:700;margin-top:6px}
.pa-txt{font-size:12px;margin-top:2px}
.pa-pt{color:var(--muted)}
</style></head>
<body><div class="sheet">
  <h1>🛠 Plano de Ação — Verificador Siconfi</h1>
  <div class="sub">${esc(enteTitulo)}${meta.exercicio ? ' • exercício ' + esc(meta.exercicio) : ''} • classificação estimada ${score.classe} (${pct(score.percentual)} de acertos) • ${acorrigir.length} item(ns) a corrigir</div>
  ${meta.atualizadoEm ? `<div class="sub">gerado em ${esc(meta.atualizadoEm)} • Para imprimir/PDF: Ctrl+P</div>` : ''}
  ${blocks || '<p style="margin-top:24px;color:var(--brand)">Nenhum item a corrigir — todas as verificações avaliáveis foram atendidas. 🎉</p>'}
</div></body></html>`;
};
