import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { ValidationResult, SuggestedEntry } from './types';
import { MDF_VERSION } from './pcaspRules';

export interface PdfReportMeta {
  enteId?: string;
  periodo?: string;
}

// ── Layout ───────────────────────────────────────────────────────────────────
const MARGIN_L  = 14;
const MARGIN_R  = 14;
const PAGE_W    = 210;
const COL_AVAIL = PAGE_W - MARGIN_L - MARGIN_R; // 182mm
const COL_ID    = 22;
const COL_HALF  = Math.floor((COL_AVAIL - COL_ID) / 2); // 80mm
const COL_REST  = COL_AVAIL - COL_ID - COL_HALF;         // 80mm

const BASE_STYLES = {
  fontSize: 7.5, cellPadding: 2, overflow: 'linebreak' as const, lineWidth: 0.1,
};

// ── Helpers ──────────────────────────────────────────────────────────────────

function truncate(t: string, max = 380) { return t.length > max ? t.slice(0, max) + '…' : t; }

function formatPlan(r: ValidationResult): string {
  const base = r.actionPlan ? truncate(r.actionPlan, 320) : truncate(r.message, 320);
  if (!r.detailedItems?.length) return base;
  const sample = r.detailedItems.slice(0, 4).map(d =>
    [d.conta, d.po ? `PO:${d.po}` : '', d.fr ? `FR:${d.fr}` : '',
      d.valor != null ? `R$${d.valor.toFixed(2)}` : '',
      d.detalhe ? `— ${d.detalhe.slice(0, 70)}` : ''].filter(Boolean).join(' ')
  ).join('\n');
  const extra = r.detailedItems.length > 4 ? `\n… +${r.detailedItems.length - 4}` : '';
  return `${base}\n\nAmostra:\n${sample}${extra}`;
}

function formatDesc(r: ValidationResult, badge: string): string {
  return r.description
    ? `${badge}\n${r.description}\n\n${truncate(r.message, 260)}`
    : `${badge}\n${truncate(r.message, 360)}`;
}

function brl(v: number) {
  return `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
}

// ── buildDoc ─────────────────────────────────────────────────────────────────

function buildDoc(results: ValidationResult[], meta: PdfReportMeta = {}): jsPDF {
  const doc = new jsPDF();

  const errors   = results.filter(r => r.severity === 'error');
  const warnings = results.filter(r => r.severity === 'warning');
  const infos    = results.filter(r => r.severity === 'info');
  const total    = errors.length + warnings.length + infos.length;
  const withEntries = results.filter(r => r.suggestedEntries?.length);

  // ── Cabeçalho ───────────────────────────────────────────────────────────────
  doc.setFontSize(16);
  doc.setTextColor(34, 130, 84);
  doc.text('Relatório de Auditoria - Validador Siconfi', MARGIN_L, 20);

  doc.setFontSize(9);
  doc.setTextColor(80, 80, 80);
  let hy = 28;
  doc.text(`Data de Geração: ${new Date().toLocaleString('pt-BR')}`, MARGIN_L, hy);
  if (meta.enteId)  { hy += 5; doc.text(`Ente (IBGE): ${meta.enteId}`, MARGIN_L, hy); }
  if (meta.periodo) { hy += 5; doc.text(`Período: ${meta.periodo}`, MARGIN_L, hy); }
  hy += 5; doc.text(`Referência normativa: ${MDF_VERSION}`, MARGIN_L, hy);
  hy += 5; doc.text(`Total de Inconsistências: ${total}`, MARGIN_L, hy);

  // Caixas de resumo coloridas
  hy += 8;
  const boxes: [string, [number,number,number], number][] = [
    [`${errors.length} Impeditivo(s)`,  [200, 30, 30],  MARGIN_L],
    [`${warnings.length} Aviso(s)`,      [170, 120,  0], MARGIN_L + 62],
    [`${infos.length} Orientação(ões)`,  [ 59, 100, 200], MARGIN_L + 124],
  ];
  boxes.forEach(([lbl, rgb, x]) => {
    doc.setFillColor(...rgb);
    doc.roundedRect(x, hy, 58, 11, 2, 2, 'F');
    doc.setFontSize(8); doc.setTextColor(255, 255, 255);
    doc.text(lbl, x + 29, hy + 7, { align: 'center' });
  });

  let currentY = hy + 18;

  // ── Seção genérica de resultados ────────────────────────────────────────────
  const addSection = (
    title: string, titleRgb: [number,number,number], headRgb: [number,number,number],
    badge: string, rows: ValidationResult[], heads: [string,string,string]
  ) => {
    if (!rows.length) return;
    if (currentY > 242) { doc.addPage(); currentY = 20; }
    doc.setFontSize(12); doc.setTextColor(...titleRgb);
    doc.text(title, MARGIN_L, currentY); currentY += 5;
    autoTable(doc, {
      startY: currentY,
      margin: { left: MARGIN_L, right: MARGIN_R },
      head: [heads],
      body: rows.map(r => [r.ruleId, formatDesc(r, badge), formatPlan(r)]),
      headStyles: { fillColor: headRgb, fontSize: 7.5, fontStyle: 'bold', textColor: [255,255,255] },
      bodyStyles: BASE_STYLES,
      columnStyles: {
        0: { cellWidth: COL_ID,   valign: 'top' },
        1: { cellWidth: COL_HALF, valign: 'top' },
        2: { cellWidth: COL_REST, valign: 'top' },
      },
      alternateRowStyles: { fillColor: [248, 248, 248] },
      didDrawPage: () => { currentY = 20; },
    });
    const lastY = (doc as any).lastAutoTable?.finalY;
    currentY = lastY != null ? lastY + 10 : currentY + 20;
  };

  addSection(
    `Erros Críticos (${errors.length})`, [180, 30, 30], [210, 40, 40],
    '[IMPEDITIVO]', errors,
    ['Regra', 'Impacto & Descrição', 'Plano de Ação Corretiva']
  );
  addSection(
    `Avisos e Informativos (${warnings.length})`, [150, 100, 0], [175, 125, 0],
    '[AVISO]', warnings,
    ['Regra', 'Classificação & Descrição', 'Recomendação']
  );

  // ── Orientações compactadas ─────────────────────────────────────────────────
  if (infos.length > 0) {
    if (currentY > 242) { doc.addPage(); currentY = 20; }
    doc.setFontSize(12); doc.setTextColor(59, 100, 200);
    doc.text(`Orientações (${infos.length})`, MARGIN_L, currentY); currentY += 5;

    const serverRules = infos.filter(r =>
      r.message.includes('metadados do servidor') || r.message.includes('não pode ser validada offline')
    );
    const otherInfos = infos.filter(r => !serverRules.includes(r));

    const body: string[][] = [];
    if (serverRules.length) {
      body.push([
        serverRules.map(r => r.ruleId).join(', '),
        '[ORIENTAÇÃO]\nRegras de metadados do servidor SICONFI',
        `Estas ${serverRules.length} regras verificam homologação, tempestividade e retificações de RREO, RGF e DCA — ` +
        `informações disponíveis apenas no servidor SICONFI.\n\nConsulte: https://siconfi.tesouro.gov.br`,
      ]);
    }
    otherInfos.forEach(r => body.push([r.ruleId, formatDesc(r, '[ORIENTAÇÃO]'), formatPlan(r)]));

    autoTable(doc, {
      startY: currentY,
      margin: { left: MARGIN_L, right: MARGIN_R },
      head: [['Regra', 'Classificação & Descrição', 'Recomendação']],
      body,
      headStyles: { fillColor: [75, 95, 185], fontSize: 7.5, fontStyle: 'bold', textColor: [255,255,255] },
      bodyStyles: BASE_STYLES,
      columnStyles: {
        0: { cellWidth: COL_ID,   valign: 'top' },
        1: { cellWidth: COL_HALF, valign: 'top' },
        2: { cellWidth: COL_REST, valign: 'top' },
      },
      alternateRowStyles: { fillColor: [245, 247, 255] },
      didDrawPage: () => { currentY = 20; },
    });
    const lastY = (doc as any).lastAutoTable?.finalY;
    currentY = lastY != null ? lastY + 10 : currentY + 20;
  }

  // ── Plano de Correção Contábil ──────────────────────────────────────────────
  if (withEntries.length > 0) {
    doc.addPage(); currentY = 20;

    doc.setFontSize(14); doc.setTextColor(20, 80, 50);
    doc.text('Plano de Correção Contábil — Lançamentos PCASP Sugeridos', MARGIN_L, currentY);
    currentY += 6;

    doc.setFontSize(8); doc.setTextColor(100, 100, 100);
    doc.text(
      `Os lançamentos abaixo são sugestões baseadas nas inconsistências detectadas. ` +
      `Verifique os valores com o contador responsável antes de registrar. ` +
      `Ref.: MCASP 11ª ed. / ${MDF_VERSION}.`,
      MARGIN_L, currentY, { maxWidth: COL_AVAIL }
    );
    currentY += 12;

    // Uma tabela por resultado que tem sugestões
    for (const r of withEntries) {
      if (!r.suggestedEntries?.length) continue;
      if (currentY > 235) { doc.addPage(); currentY = 20; }

      // Subtítulo da regra
      doc.setFontSize(10); doc.setTextColor(40, 40, 40);
      doc.text(`[${r.ruleId}] ${r.description || r.message.slice(0, 100)}`, MARGIN_L, currentY);
      currentY += 5;

      // Tabela de lançamentos
      const colD  = 28;
      const colDA = Math.floor((COL_AVAIL - colD) * 0.22);
      const colCA = Math.floor((COL_AVAIL - colD) * 0.22);
      const colV  = 18;
      const colObs = COL_AVAIL - colD - colDA - colCA - colV;

      autoTable(doc, {
        startY: currentY,
        margin: { left: MARGIN_L, right: MARGIN_R },
        head: [['Descrição do Lançamento', 'Débito (D)', 'Crédito (C)', 'Valor (R$)', 'Observações']],
        body: r.suggestedEntries.map((e: SuggestedEntry) => [
          e.descricao,
          `${e.debito.conta}\n${e.debito.descricao}`,
          `${e.credito.conta}\n${e.credito.descricao}`,
          e.valor != null ? brl(e.valor) : '—',
          e.obs ?? '—',
        ]),
        headStyles: { fillColor: [30, 100, 60], fontSize: 7, fontStyle: 'bold', textColor: [255,255,255] },
        bodyStyles: { fontSize: 7, cellPadding: 2, overflow: 'linebreak', lineWidth: 0.1 },
        columnStyles: {
          0: { cellWidth: colD,   valign: 'top' },
          1: { cellWidth: colDA,  valign: 'top', fontStyle: 'bold' },
          2: { cellWidth: colCA,  valign: 'top', fontStyle: 'bold' },
          3: { cellWidth: colV,   valign: 'top', halign: 'right' },
          4: { cellWidth: colObs, valign: 'top' },
        },
        alternateRowStyles: { fillColor: [240, 248, 242] },
        didDrawPage: () => { currentY = 20; },
      });

      const lastY = (doc as any).lastAutoTable?.finalY;
      currentY = lastY != null ? lastY + 8 : currentY + 16;
    }
  }

  // ── Rodapé em todas as páginas ──────────────────────────────────────────────
  const pageCount = (doc.internal as any).getNumberOfPages?.() ?? doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(7); doc.setTextColor(160, 160, 160);
    doc.text(
      `Página ${i} de ${pageCount}  —  Gerado pelo Validador Siconfi Local  —  ${MDF_VERSION}`,
      PAGE_W / 2, doc.internal.pageSize.height - 8, { align: 'center' }
    );
  }

  return doc;
}

// ── Exports públicos ──────────────────────────────────────────────────────────

export function generatePDF(results: ValidationResult[], meta: PdfReportMeta = {}): void {
  const doc = buildDoc(results, meta);
  const e = meta.enteId  ? `${meta.enteId}_`  : '';
  const p = meta.periodo ? `${meta.periodo}_` : '';
  doc.save(`Relatorio_Siconfi_${e}${p}${new Date().toISOString().slice(0, 10)}.pdf`);
}

export function generatePDFBuffer(results: ValidationResult[], meta: PdfReportMeta = {}): ArrayBuffer {
  return buildDoc(results, meta).output('arraybuffer');
}
