import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { ValidationResult } from './types';
import { MDF_VERSION } from './pcaspRules';

export interface PdfReportMeta {
  enteId?: string;
  periodo?: string;
}

// ── Constantes de layout ────────────────────────────────────────────────────
const MARGIN_L  = 14;
const MARGIN_R  = 14;
const PAGE_W    = 210; // A4
const COL_AVAIL = PAGE_W - MARGIN_L - MARGIN_R; // 182mm

// Larguras de coluna: Regra | Descrição/Mensagem | Plano/Detalhe
const COL_ID   = 22;
const COL_DESC = Math.floor((COL_AVAIL - COL_ID) / 2);   // 80mm
const COL_PLAN = COL_AVAIL - COL_ID - COL_DESC;           // 80mm

const TABLE_STYLES = {
  fontSize:    7.5,
  cellPadding: 2,
  overflow:    'linebreak' as const,
  lineWidth:   0.1,
};

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Trunca texto para evitar linhas absurdamente longas numa célula. */
function truncate(text: string, maxLen = 400): string {
  return text.length > maxLen ? text.slice(0, maxLen) + '…' : text;
}

/** Formata a coluna de detalhes/plano de ação. */
function formatPlan(result: ValidationResult): string {
  const base = result.actionPlan
    ? truncate(result.actionPlan, 350)
    : truncate(result.message, 350);

  if (!result.detailedItems?.length) return base;

  const sample = result.detailedItems.slice(0, 4).map(item =>
    [
      item.conta,
      item.po   ? `PO:${item.po}`               : '',
      item.fr   ? `FR:${item.fr}`               : '',
      item.valor != null
        ? `R$ ${item.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
        : '',
      item.detalhe ? `— ${item.detalhe.slice(0, 80)}` : '',
    ].filter(Boolean).join(' ')
  ).join('\n');

  const extra = result.detailedItems.length > 4
    ? `\n… +${result.detailedItems.length - 4} lançamento(s)`
    : '';

  return `${base}\n\nDetalhes (amostra):\n${sample}${extra}`;
}

/** Formata a coluna de descrição/mensagem. */
function formatDesc(result: ValidationResult, badge: string): string {
  const desc = result.description
    ? `${badge}\n${result.description}\n\n${truncate(result.message, 280)}`
    : `${badge}\n${truncate(result.message, 380)}`;
  return desc;
}

// ── buildDoc — lógica central compartilhada ──────────────────────────────────

function buildDoc(results: ValidationResult[], meta: PdfReportMeta = {}): jsPDF {
  const doc = new jsPDF();

  const errors   = results.filter(r => r.severity === 'error');
  const warnings = results.filter(r => r.severity === 'warning');
  const infos    = results.filter(r => r.severity === 'info');
  const total    = errors.length + warnings.length + infos.length;

  // ── Cabeçalho ──────────────────────────────────────────────────────────────
  doc.setFontSize(16);
  doc.setTextColor(34, 130, 84);
  doc.text('Relatório de Auditoria - Validador Siconfi', MARGIN_L, 20);

  doc.setFontSize(9);
  doc.setTextColor(80, 80, 80);
  let hy = 28;
  doc.text(`Data de Geração: ${new Date().toLocaleString('pt-BR')}`, MARGIN_L, hy);
  if (meta.enteId)  { hy += 6; doc.text(`Ente (IBGE): ${meta.enteId}`,  MARGIN_L, hy); }
  if (meta.periodo) { hy += 6; doc.text(`Período: ${meta.periodo}`,      MARGIN_L, hy); }
  hy += 6;
  doc.text(`Referência normativa: ${MDF_VERSION}`, MARGIN_L, hy);
  hy += 6;
  doc.text(`Total de Inconsistências: ${total}`, MARGIN_L, hy);

  // ── Caixas de resumo ────────────────────────────────────────────────────────
  hy += 8;
  const boxes: [string, [number,number,number], number][] = [
    [`${errors.length} Impeditivo(s)`,   [220, 38, 38],  MARGIN_L],
    [`${warnings.length} Aviso(s)`,       [180, 130,  0],  MARGIN_L + 62],
    [`${infos.length} Orientação(ões)`,   [ 59, 100, 200],  MARGIN_L + 124],
  ];
  boxes.forEach(([label, color, x]) => {
    doc.setFillColor(...color);
    doc.roundedRect(x, hy, 58, 12, 2, 2, 'F');
    doc.setFontSize(8.5);
    doc.setTextColor(255, 255, 255);
    doc.text(label, x + 29, hy + 7.5, { align: 'center' });
  });

  let currentY = hy + 20;

  // ── Função genérica para tabelas de resultados ──────────────────────────────
  const addSection = (
    title:     string,
    titleRgb:  [number, number, number],
    headRgb:   [number, number, number],
    badge:     string,
    rows:      ValidationResult[],
    headLabels:[string, string, string]
  ) => {
    if (!rows.length) return;
    if (currentY > 240) { doc.addPage(); currentY = 20; }

    doc.setFontSize(12);
    doc.setTextColor(...titleRgb);
    doc.text(title, MARGIN_L, currentY);
    currentY += 5;

    autoTable(doc, {
      startY:       currentY,
      margin:       { left: MARGIN_L, right: MARGIN_R },
      head:         [headLabels],
      body:         rows.map(r => [
        r.ruleId,
        formatDesc(r, badge),
        formatPlan(r),
      ]),
      headStyles:   { fillColor: headRgb, fontSize: 7.5, fontStyle: 'bold', textColor: [255,255,255] },
      bodyStyles:   TABLE_STYLES,
      columnStyles: {
        0: { cellWidth: COL_ID,   valign: 'top' },
        1: { cellWidth: COL_DESC, valign: 'top' },
        2: { cellWidth: COL_PLAN, valign: 'top' },
      },
      alternateRowStyles: { fillColor: [248, 248, 248] },
      didDrawPage: () => { currentY = 20; },
    });

    const lastY = (doc as any).lastAutoTable?.finalY;
    currentY = lastY != null ? lastY + 10 : currentY + 20;
  };

  // ── Erros Críticos ──────────────────────────────────────────────────────────
  addSection(
    `Erros Críticos (${errors.length})`,
    [180, 30, 30], [220, 38, 38],
    '[IMPEDITIVO]',
    errors,
    ['Regra', 'Impacto & Descrição', 'Plano de Ação Corretiva']
  );

  // ── Avisos ──────────────────────────────────────────────────────────────────
  addSection(
    `Avisos e Informativos (${warnings.length})`,
    [150, 100, 0], [180, 130, 0],
    '[AVISO]',
    warnings,
    ['Regra', 'Classificação & Descrição', 'Recomendação']
  );

  // ── Orientações — compactadas numa tabela-resumo ────────────────────────────
  if (infos.length > 0) {
    if (currentY > 240) { doc.addPage(); currentY = 20; }

    doc.setFontSize(12);
    doc.setTextColor(59, 100, 200);
    doc.text(`Avisos e Informativos (${infos.length})`, MARGIN_L, currentY);
    currentY += 5;

    // Regras que são puramente de servidor — agrupar numa linha só
    const serverRules = infos.filter(r =>
      r.message.includes('metadados do servidor') || r.message.includes('não pode ser validada offline')
    );
    const otherInfos = infos.filter(r => !serverRules.includes(r));

    // Linha compacta para regras de servidor
    const serverBody: string[][] = [];
    if (serverRules.length > 0) {
      const ids = serverRules.map(r => r.ruleId).join(', ');
      serverBody.push([
        ids,
        '[ORIENTAÇÃO]\nRegras de metadados do servidor SICONFI',
        `Estas ${serverRules.length} regras verificam homologação, tempestividade e retificações de RREO, RGF e DCA — informações disponíveis apenas no servidor SICONFI.\n\nConsulte: https://siconfi.tesouro.gov.br`,
      ]);
    }

    // Linhas individuais para outras orientações (ex.: D1_00001, D1_00016)
    const otherBody = otherInfos.map(r => [
      r.ruleId,
      formatDesc(r, '[ORIENTAÇÃO]'),
      formatPlan(r),
    ]);

    autoTable(doc, {
      startY:       currentY,
      margin:       { left: MARGIN_L, right: MARGIN_R },
      head:         [['Regra', 'Classificação & Descrição', 'Recomendação']],
      body:         [...serverBody, ...otherBody],
      headStyles:   { fillColor: [80, 100, 180], fontSize: 7.5, fontStyle: 'bold', textColor: [255,255,255] },
      bodyStyles:   TABLE_STYLES,
      columnStyles: {
        0: { cellWidth: COL_ID,   valign: 'top' },
        1: { cellWidth: COL_DESC, valign: 'top' },
        2: { cellWidth: COL_PLAN, valign: 'top' },
      },
      alternateRowStyles: { fillColor: [245, 247, 255] },
      didDrawPage: () => { currentY = 20; },
    });

    const lastY = (doc as any).lastAutoTable?.finalY;
    currentY = lastY != null ? lastY + 10 : currentY + 20;
  }

  // ── Rodapé em todas as páginas ──────────────────────────────────────────────
  const pageCount = (doc.internal as any).getNumberOfPages?.() ?? doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(7.5);
    doc.setTextColor(160, 160, 160);
    doc.text(
      `Página ${i} de ${pageCount}  —  Gerado pelo Validador Siconfi Local  —  ${MDF_VERSION}`,
      PAGE_W / 2,
      doc.internal.pageSize.height - 8,
      { align: 'center' }
    );
  }

  return doc;
}

// ── Exports públicos ──────────────────────────────────────────────────────────

/** Gera e faz download do PDF no browser. */
export function generatePDF(results: ValidationResult[], meta: PdfReportMeta = {}): void {
  const doc = buildDoc(results, meta);
  const entePart   = meta.enteId  ? `${meta.enteId}_`  : '';
  const periodPart = meta.periodo ? `${meta.periodo}_` : '';
  doc.save(`Relatorio_Siconfi_${entePart}${periodPart}${new Date().toISOString().slice(0, 10)}.pdf`);
}

/** Variante Node/CLI: retorna ArrayBuffer sem acionar download. */
export function generatePDFBuffer(results: ValidationResult[], meta: PdfReportMeta = {}): ArrayBuffer {
  return buildDoc(results, meta).output('arraybuffer');
}
