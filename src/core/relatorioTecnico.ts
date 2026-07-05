import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { ValidationResult } from './types';
import { MDF_VERSION } from './pcaspRules';
import { PendenciaPorPoder } from '../services/siconfiApi';
import { PdfReportMeta } from './pdfGenerator';

// ── Layout (mesmos parâmetros do relatório de auditoria, para consistência visual) ──
const MARGIN_L = 14;
const MARGIN_R = 14;
const PAGE_W = 210;
const COL_AVAIL = PAGE_W - MARGIN_L - MARGIN_R;

const NAVY: [number, number, number] = [31, 56, 100];
const RED: [number, number, number] = [176, 0, 0];
const AMBER: [number, number, number] = [184, 134, 11];
const GREY: [number, number, number] = [102, 102, 102];

function truncate(t: string, max = 300) {
  return t.length > max ? t.slice(0, max) + '…' : t;
}

/** Extrai o breakdown por Poder/Órgão do debugInfo do D1_00001, quando disponível. */
function extractPendenciasPorPoder(results: ValidationResult[]): PendenciaPorPoder[] | null {
  const d1 = results.find(r => r.ruleId === 'D1_00001' && r.debugInfo);
  const payload = d1?.debugInfo?.payload as any;
  if (payload && Array.isArray(payload.pendenciasPorPoder)) {
    return payload.pendenciasPorPoder as PendenciaPorPoder[];
  }
  return null;
}

function ensureSpace(doc: jsPDF, y: number, needed = 20): number {
  if (y > 280 - needed) {
    doc.addPage();
    return 20;
  }
  return y;
}

function sectionTitle(doc: jsPDF, text: string, y: number): number {
  y = ensureSpace(doc, y, 15);
  doc.setFontSize(13);
  doc.setTextColor(...NAVY);
  doc.setFont('helvetica', 'bold');
  doc.text(text, MARGIN_L, y);
  doc.setFont('helvetica', 'normal');
  return y + 7;
}

function paragraph(doc: jsPDF, text: string, y: number, opts: { size?: number; color?: [number, number, number] } = {}): number {
  doc.setFontSize(opts.size ?? 9.5);
  doc.setTextColor(...(opts.color ?? [40, 40, 40]));
  const lines = doc.splitTextToSize(text, COL_AVAIL);
  y = ensureSpace(doc, y, lines.length * 5 + 4);
  doc.text(lines, MARGIN_L, y);
  return y + lines.length * 5 + 3;
}

function bulletList(doc: jsPDF, items: string[], y: number, opts: { size?: number } = {}): number {
  doc.setFontSize(opts.size ?? 9.5);
  doc.setTextColor(40, 40, 40);
  for (const item of items) {
    const lines = doc.splitTextToSize(`•  ${item}`, COL_AVAIL - 4);
    y = ensureSpace(doc, y, lines.length * 5 + 2);
    doc.text(lines, MARGIN_L + 2, y);
    y += lines.length * 5 + 1.5;
  }
  return y + 2;
}

function buildRelatorioTecnicoDoc(results: ValidationResult[], meta: PdfReportMeta = {}): jsPDF {
  const doc = new jsPDF();

  const errors = results.filter(r => r.severity === 'error');
  const warnings = results.filter(r => r.severity === 'warning');
  const pendenciasPorPoder = extractPendenciasPorPoder(results);
  const d1_00001 = results.find(r => r.ruleId === 'D1_00001');

  // ── Capa / Cabeçalho ────────────────────────────────────────────────────────
  doc.setFontSize(20);
  doc.setTextColor(...NAVY);
  doc.setFont('helvetica', 'bold');
  doc.text('RELATÓRIO TÉCNICO', PAGE_W / 2, 30, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  doc.setTextColor(...GREY);
  doc.text('Situação Fiscal-Contábil frente ao Siconfi/LRF', PAGE_W / 2, 38, { align: 'center' });

  let y = 55;
  const ficha: [string, string][] = [
    ['Ente (IBGE)', meta.enteId ?? 'não identificado'],
    ['Período analisado', meta.periodo ?? 'não identificado'],
    ['Referência normativa', `LRF (LC 101/2000), MCASP 11ª edição, ${MDF_VERSION}`],
    ['Data de emissão', new Date().toLocaleDateString('pt-BR')],
  ];
  autoTable(doc, {
    startY: y,
    margin: { left: MARGIN_L, right: MARGIN_R },
    body: ficha,
    theme: 'grid',
    styles: { fontSize: 9.5, cellPadding: 3 },
    columnStyles: {
      0: { cellWidth: 50, fontStyle: 'bold', fillColor: [239, 239, 239] },
      1: { cellWidth: COL_AVAIL - 50 },
    },
  });
  y = ((doc as any).lastAutoTable?.finalY ?? y) + 12;

  // ── 1. Sumário Executivo ────────────────────────────────────────────────────
  y = sectionTitle(doc, '1. Sumário Executivo', y);
  y = paragraph(
    doc,
    `Este relatório consolida, em linguagem executiva, os achados da auditoria eletrônica realizada sobre os dados enviados ao ` +
    `Sistema de Informações Contábeis e Fiscais do Setor Público Brasileiro (Siconfi) para o período indicado, incluindo o ` +
    `cruzamento com a situação de entrega e homologação de demonstrativos fiscais na API pública do Tesouro Nacional.`,
    y
  );
  y = paragraph(
    doc,
    `Foram identificadas ${errors.length} inconsistência(s) impeditiva(s) e ${warnings.length} inconsistência(s) classificada(s) como aviso, ` +
    `que podem afetar a regularidade do ente junto ao CAUC (Cadastro Único de Convênios) e a conformidade contábil exigida pelo MCASP.`,
    y
  );

  if (d1_00001?.severity === 'error') {
    y = paragraph(
      doc,
      `Atenção: há pendência de homologação de demonstrativos fiscais para o Poder Executivo (ver Seção 2).`,
      y,
      { color: RED }
    );
  }

  // ── 2. Pendências de Entrega e Homologação (Siconfi) ────────────────────────
  if (d1_00001) {
    y = sectionTitle(doc, '2. Pendências de Entrega e Homologação (Siconfi)', y);
    y = paragraph(
      doc,
      `Verificação realizada via API pública do Tesouro Nacional (extrato de entregas), separada por Poder/Órgão — cada Poder presta ` +
      `contas de forma independente perante o Siconfi (LRF, art. 20).`,
      y
    );

    if (pendenciasPorPoder && pendenciasPorPoder.length > 0) {
      for (const p of pendenciasPorPoder) {
        y = ensureSpace(doc, y, 10);
        doc.setFontSize(10);
        doc.setTextColor(...NAVY);
        doc.setFont('helvetica', 'bold');
        doc.text(`${p.instituicao} [${p.poder}]`, MARGIN_L, y);
        doc.setFont('helvetica', 'normal');
        y += 5.5;
        y = bulletList(doc, [`Pendente: ${p.pendentes.join(', ')}.`], y);
      }
    } else {
      y = paragraph(doc, d1_00001.message, y);
    }
  }

  // ── 3. Achados Contábeis na MSC ─────────────────────────────────────────────
  const achados = [...errors, ...warnings].filter(r => r.ruleId !== 'D1_00001');
  if (achados.length > 0) {
    y = sectionTitle(doc, '3. Achados Contábeis e de Conformidade', y);
    y = paragraph(
      doc,
      `Achados extraídos da validação eletrônica dos arquivos enviados, ordenados por severidade.`,
      y
    );

    autoTable(doc, {
      startY: y,
      margin: { left: MARGIN_L, right: MARGIN_R },
      head: [['Regra', 'Descrição', 'Severidade']],
      body: achados.map(r => [
        r.ruleId,
        `${r.description || ''}\n${truncate(r.message, 220)}`,
        r.severity === 'error' ? 'IMPEDITIVO' : 'AVISO',
      ]),
      headStyles: { fillColor: NAVY, fontSize: 8.5, fontStyle: 'bold', textColor: [255, 255, 255] },
      bodyStyles: { fontSize: 8, cellPadding: 2.5, overflow: 'linebreak', lineWidth: 0.1, valign: 'top' },
      columnStyles: {
        0: { cellWidth: 24 },
        1: { cellWidth: COL_AVAIL - 24 - 26 },
        2: { cellWidth: 26, fontStyle: 'bold' },
      },
      didParseCell: (data) => {
        if (data.column.index === 2 && data.section === 'body') {
          data.cell.styles.textColor = data.cell.raw === 'IMPEDITIVO' ? RED : AMBER;
        }
      },
      alternateRowStyles: { fillColor: [248, 248, 248] },
      didDrawPage: () => { y = 20; },
    });
    y = ((doc as any).lastAutoTable?.finalY ?? y) + 10;
  }

  // ── 4. Plano de Ação Recomendado ────────────────────────────────────────────
  y = sectionTitle(doc, '4. Plano de Ação Recomendado', y);

  if (errors.length > 0) {
    y = ensureSpace(doc, y, 10);
    doc.setFontSize(10.5);
    doc.setTextColor(...RED);
    doc.setFont('helvetica', 'bold');
    doc.text('Prioridade imediata (impeditivos)', MARGIN_L, y);
    doc.setFont('helvetica', 'normal');
    y += 6;
    const itensImediatos = errors.map(r => r.actionPlan || r.message);
    y = bulletList(doc, itensImediatos.map(t => truncate(t, 260)), y);
  }

  if (warnings.length > 0) {
    y = ensureSpace(doc, y, 10);
    doc.setFontSize(10.5);
    doc.setTextColor(...AMBER);
    doc.setFont('helvetica', 'bold');
    doc.text('Prioridade curto prazo (avisos)', MARGIN_L, y);
    doc.setFont('helvetica', 'normal');
    y += 6;
    const itensCurtoPrazo = warnings.map(r => r.actionPlan || r.message);
    y = bulletList(doc, itensCurtoPrazo.map(t => truncate(t, 260)), y);
  }

  if (errors.length === 0 && warnings.length === 0) {
    y = paragraph(doc, 'Nenhuma inconsistência impeditiva ou de aviso identificada para o período analisado.', y);
  }

  // ── 5. Observações Finais ───────────────────────────────────────────────────
  y = sectionTitle(doc, '5. Observações Finais', y);
  y = paragraph(
    doc,
    `Este relatório reflete o estado das informações na data de emissão. Novas homologações no Siconfi ou correções nos arquivos ` +
    `enviados alteram automaticamente os achados aqui descritos. Recomenda-se nova validação após a implementação das ações acima.`,
    y
  );

  // ── Rodapé ───────────────────────────────────────────────────────────────────
  const pageCount = (doc.internal as any).getNumberOfPages?.() ?? doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(7);
    doc.setTextColor(160, 160, 160);
    doc.text(
      `Página ${i} de ${pageCount}  —  Gerado pelo Validador Siconfi Local  —  ${MDF_VERSION}`,
      PAGE_W / 2, doc.internal.pageSize.height - 8, { align: 'center' }
    );
  }

  return doc;
}

// ── Exports públicos ──────────────────────────────────────────────────────────

export function generateRelatorioTecnicoPDF(results: ValidationResult[], meta: PdfReportMeta = {}): void {
  const doc = buildRelatorioTecnicoDoc(results, meta);
  const e = meta.enteId ? `${meta.enteId}_` : '';
  const p = meta.periodo ? `${meta.periodo}_` : '';
  doc.save(`Relatorio_Tecnico_${e}${p}${new Date().toISOString().slice(0, 10)}.pdf`);
}

export function generateRelatorioTecnicoPDFBuffer(results: ValidationResult[], meta: PdfReportMeta = {}): ArrayBuffer {
  return buildRelatorioTecnicoDoc(results, meta).output('arraybuffer');
}
