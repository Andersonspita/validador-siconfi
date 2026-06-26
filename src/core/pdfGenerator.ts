import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { ValidationResult } from './types';
import { MDF_VERSION } from './pcaspRules';

export interface PdfReportMeta {
  enteId?: string;
  periodo?: string;
}

function formatDetails(result: ValidationResult): string {
  const base = result.actionPlan || result.message;
  if (!result.detailedItems?.length) return base;

  const sample = result.detailedItems.slice(0, 5).map(item =>
    `${item.conta}${item.po ? ` PO:${item.po}` : ''}${item.valor !== undefined ? ` R$ ${item.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : ''}${item.detalhe ? ` — ${item.detalhe}` : ''}`
  ).join('\n');

  const suffix = result.detailedItems.length > 5
    ? `\n... e mais ${result.detailedItems.length - 5} lançamento(s).`
    : '';

  return `${base}\n\nDetalhes:\n${sample}${suffix}`;
}

export function generatePDF(results: ValidationResult[], meta: PdfReportMeta = {}) {
  const doc = new jsPDF();

  const errors = results.filter(r => r.severity === 'error');
  const warnings = results.filter(r => r.severity === 'warning');
  const infos = results.filter(r => r.severity === 'info');

  doc.setFontSize(18);
  doc.setTextColor(34, 197, 94);
  doc.text('Relatório de Auditoria - Validador Siconfi', 14, 22);

  doc.setFontSize(11);
  doc.setTextColor(100, 100, 100);
  doc.text(`Data de Geração: ${new Date().toLocaleString('pt-BR')}`, 14, 30);
  if (meta.enteId) doc.text(`Ente (IBGE): ${meta.enteId}`, 14, 36);
  if (meta.periodo) doc.text(`Período: ${meta.periodo}`, 14, meta.enteId ? 42 : 36);
  doc.text(`Referência normativa: ${MDF_VERSION}`, 14, meta.enteId && meta.periodo ? 48 : meta.enteId || meta.periodo ? 42 : 36);
  doc.text(
    `Achados: ${errors.length} impeditivo(s) | ${warnings.length} aviso(s) | ${infos.length} orientação(ões)`,
    14,
    meta.enteId && meta.periodo ? 54 : meta.enteId || meta.periodo ? 48 : 42
  );

  let currentY = meta.enteId && meta.periodo ? 64 : meta.enteId || meta.periodo ? 58 : 52;

  if (errors.length > 0) {
    doc.setFontSize(14);
    doc.setTextColor(220, 38, 38);
    doc.text(`Erros Críticos (${errors.length})`, 14, currentY);
    currentY += 6;

    autoTable(doc, {
      startY: currentY,
      head: [['Regra', 'Impacto & Descrição', 'Plano de Ação / Detalhes']],
      body: errors.map(err => {
        let badges = '[IMPEDITIVO] ';
        if (err.impactsCapag) badges += '[RISCO CAPAG] ';
        return [err.ruleId, `${badges}\n${err.description}`, formatDetails(err)];
      }),
      headStyles: { fillColor: [220, 38, 38] },
      styles: { fontSize: 8, cellPadding: 3, overflow: 'linebreak' },
      columnStyles: { 0: { cellWidth: 22 }, 1: { cellWidth: 55 }, 2: { cellWidth: 'auto' } },
      margin: { left: 14, right: 14 },
    });

    currentY = (doc as any).lastAutoTable.finalY + 15;
  }

  if (warnings.length > 0) {
    if (currentY > 230) { doc.addPage(); currentY = 20; }

    doc.setFontSize(14);
    doc.setTextColor(234, 179, 8);
    doc.text(`Avisos (${warnings.length})`, 14, currentY);
    currentY += 6;

    autoTable(doc, {
      startY: currentY,
      head: [['Regra', 'Classificação & Descrição', 'Recomendação / Detalhes']],
      body: warnings.map(warn => {
        let badges = '[AVISO] ';
        if (warn.impactsCapag) badges += '[RISCO CAPAG] ';
        return [warn.ruleId, `${badges}\n${warn.description}`, formatDetails(warn)];
      }),
      headStyles: { fillColor: [234, 179, 8] },
      styles: { fontSize: 8, cellPadding: 3, overflow: 'linebreak' },
      columnStyles: { 0: { cellWidth: 22 }, 1: { cellWidth: 55 }, 2: { cellWidth: 'auto' } },
      margin: { left: 14, right: 14 },
    });

    currentY = (doc as any).lastAutoTable.finalY + 15;
  }

  if (infos.length > 0) {
    if (currentY > 230) { doc.addPage(); currentY = 20; }

    doc.setFontSize(14);
    doc.setTextColor(100, 100, 100);
    doc.text(`Orientações (${infos.length})`, 14, currentY);
    currentY += 6;

    autoTable(doc, {
      startY: currentY,
      head: [['Regra', 'Descrição', 'Orientação']],
      body: infos.map(info => [
        info.ruleId,
        `[ORIENTAÇÃO]\n${info.description}`,
        info.message,
      ]),
      headStyles: { fillColor: [150, 150, 150] },
      styles: { fontSize: 8, cellPadding: 3, overflow: 'linebreak' },
      columnStyles: { 0: { cellWidth: 22 }, 1: { cellWidth: 55 }, 2: { cellWidth: 'auto' } },
      margin: { left: 14, right: 14 },
    });
  }

  const pageCount = (doc.internal as any).getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(150);
    doc.text(
      `Página ${i} de ${pageCount} - Validador Siconfi Local (${MDF_VERSION})`,
      doc.internal.pageSize.width / 2,
      doc.internal.pageSize.height - 10,
      { align: 'center' }
    );
  }

  const entePart = meta.enteId ? `${meta.enteId}_` : '';
  const periodPart = meta.periodo ? `${meta.periodo}_` : '';
  doc.save(`Relatorio_Siconfi_${entePart}${periodPart}${new Date().toISOString().slice(0, 10)}.pdf`);
}

/**
 * Variante para uso em Node/CLI: retorna o ArrayBuffer do PDF sem acionar download no browser.
 * Compartilha toda a lógica de generatePDF via output('arraybuffer').
 */
export function generatePDFBuffer(results: ValidationResult[], meta: PdfReportMeta = {}): ArrayBuffer {
  // jsPDF em Node: doc.output('arraybuffer') retorna os bytes diretamente.
  // Re-implementa chamando generatePDF mas interceptando o output antes do save.
  const doc = new jsPDF();

  // Rebuild inline (duplicar é necessário pois generatePDF não retorna doc)
  const errors   = results.filter(r => r.severity === 'error');
  const warnings = results.filter(r => r.severity === 'warning');
  const infos    = results.filter(r => r.severity === 'info');

  doc.setFontSize(18);
  doc.setTextColor(34, 197, 94);
  doc.text('Relatório de Auditoria - Validador Siconfi', 14, 22);

  doc.setFontSize(11);
  doc.setTextColor(100, 100, 100);
  doc.text(`Data de Geração: ${new Date().toLocaleString('pt-BR')}`, 14, 30);
  let metaY = 30;
  if (meta.enteId)   { metaY += 6; doc.text(`Ente (IBGE): ${meta.enteId}`, 14, metaY); }
  if (meta.periodo)  { metaY += 6; doc.text(`Período: ${meta.periodo}`, 14, metaY); }
  metaY += 6;
  doc.text(`Referência normativa: ${MDF_VERSION}`, 14, metaY);
  metaY += 6;
  doc.text(`Total: ${errors.length} impeditivo(s) | ${warnings.length} aviso(s) | ${infos.length} orientação(ões)`, 14, metaY);

  let currentY = metaY + 10;

  const addTable = (
    title: string, color: [number, number, number],
    rows: ValidationResult[], headColor: [number, number, number]
  ) => {
    if (!rows.length) return;
    if (currentY > 250) { doc.addPage(); currentY = 20; }
    doc.setFontSize(13);
    doc.setTextColor(...color);
    doc.text(title, 14, currentY);
    currentY += 4;
    autoTable(doc, {
      startY: currentY,
      head: [['Regra', 'Impacto & Descrição', 'Plano de Ação Corretiva']],
      body: rows.map(r => [
        r.ruleId,
        r.description ? `${r.description}\n${r.message}` : r.message,
        formatDetails(r),
      ]),
      headStyles: { fillColor: headColor, fontSize: 7.5 },
      bodyStyles: { fontSize: 7.5, cellPadding: 2 },
      columnStyles: { 0: { cellWidth: 25 }, 1: { cellWidth: 78 }, 2: { cellWidth: 77 } },
      theme: 'striped',
    });
    const finalY = (doc as any).lastAutoTable?.finalY; currentY = finalY != null ? finalY + 8 : currentY + 20;
  };

  addTable(`Erros Críticos (${errors.length})`,   [220, 38, 38],  errors,   [220, 38, 38]);
  addTable(`Avisos e Informativos (${warnings.length})`, [234, 179, 8], warnings, [180, 130, 0]);
  addTable(`Orientações (${infos.length})`,        [59, 130, 246], infos,    [59, 100, 200]);

  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(150);
    doc.text(
      `Página ${i} de ${pageCount} - Gerado pelo Validador Siconfi Local`,
      doc.internal.pageSize.width / 2,
      doc.internal.pageSize.height - 10,
      { align: 'center' }
    );
  }

  return doc.output('arraybuffer');
}
