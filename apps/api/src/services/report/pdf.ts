import PDFDocument from 'pdfkit';
import type { Block, StudentDetails } from './types.js';
import { fillTokens, isNumbered, safeText, tocEntries } from './shared.js';

const W = 595.28, H = 841.89, M = 72, USABLE = W - 2 * M;
export interface PdfResult { buffer: Buffer; pages: number; headingPages: number[] }

/** Renders blocks to an A4 PDF (Times 12, 1.5 spacing). Two passes so the table of contents carries real page numbers. */
export async function renderPdf(blocks: Block[], details: StudentDetails, title: string): Promise<PdfResult> {
  const first = await pass(blocks, details, title, null);
  return pass(blocks, details, title, first.headingPages);
}

function pass(blocks: Block[], d: StudentDetails, title: string, tocPages: number[] | null): Promise<PdfResult> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margins: { top: M, bottom: M, left: M, right: M }, bufferPages: true, info: { Title: safeText(title), Author: 'ProjectForge Report Kit' } });
    const chunks: Buffer[] = []; doc.on('data', (c) => chunks.push(c)); doc.on('error', reject);
    const t = (s: string) => safeText(fillTokens(s, d)); const bottom = () => H - M;
    const ensure = (h: number) => { if (doc.y + h > bottom()) doc.addPage(); };
    const pageNo = () => doc.bufferedPageRange().count;
    const headingPages: number[] = []; const toc = tocEntries(blocks); let figN = 0, tabN = 0, ch = 0, sec = 0, numbered = false, firstH1 = true;
    const body = (size = 12, font = 'Times-Roman') => doc.font(font).fontSize(size).fillColor('#000');

    // How much room the block after a heading needs, so a heading is never stranded at the bottom of a page.
    const one = (nb?: Block) => (!nb ? 0 : nb.t === 'placeholder' ? Math.min(nb.height ?? 250, 300) + 50 : nb.t === 'table' ? 110 : nb.t === 'code' ? 60 : nb.t === 'p' ? 55 : 40);
    const needAfter = (i: number) => one(blocks[i + 1]) + (blocks[i + 1]?.t === 'p' || blocks[i + 1]?.t === 'note' ? (blocks[i + 2]?.t === 'placeholder' || blocks[i + 2]?.t === 'table' ? one(blocks[i + 2]) : 0) : 0);
    for (let bi = 0; bi < blocks.length; bi++) {
      const b = blocks[bi]; const nb = blocks[bi + 1];
      switch (b.t) {
        case 'pagebreak': doc.addPage(); break;
        case 'spacer': doc.y += b.h ?? 12; break;
        case 'center': { body(b.size ?? 12, b.bold ? 'Times-Bold' : 'Times-Roman').text(t(b.text), M, doc.y, { width: USABLE, align: 'center', lineGap: 4 }); doc.moveDown(0.3); break; }
        case 'h1': {
          if (!(firstH1 && doc.y <= M + 1)) { if (doc.y > M + 1) doc.addPage(); } firstH1 = false;
          numbered = isNumbered(b.text); if (numbered) { ch++; sec = 0; }
          headingPages.push(pageNo()); doc.y += 40;
          if (numbered) body(13, 'Times-Bold').text(`CHAPTER ${ch}`, M, doc.y, { width: USABLE, align: 'center' });
          body(20, 'Times-Bold').text(t(b.text).toUpperCase(), M, doc.y, { width: USABLE, align: 'center', lineGap: 4 }); doc.moveDown(0.4);
          doc.moveTo(M, doc.y).lineTo(W - M, doc.y).lineWidth(1.2).strokeColor('#000').stroke(); doc.moveDown(1); break;
        }
        case 'h2': { ensure(30 + needAfter(bi)); if (numbered) sec++; headingPages.push(pageNo()); doc.moveDown(0.4); body(14, 'Times-Bold').text(numbered ? `${ch}.${sec}  ${t(b.text)}` : t(b.text), M, doc.y, { width: USABLE, lineGap: 3 }); doc.moveDown(0.4); break; }
        case 'h3': { ensure(24 + needAfter(bi)); doc.moveDown(0.2); body(12, 'Times-BoldItalic').text(t(b.text), M, doc.y, { width: USABLE, lineGap: 3 }); doc.moveDown(0.3); break; }
        case 'p': { body().text(t(b.text), M, doc.y, { width: USABLE, align: 'justify', lineGap: 5 }); doc.moveDown(0.6); break; }
        case 'bullets': case 'numbered': {
          b.items.forEach((it, i) => { const mark = b.t === 'bullets' ? '•' : `${i + 1}.`; const txt = t(it); body(); const h = doc.heightOfString(txt, { width: USABLE - 28, lineGap: 4 }); ensure(h + 6); const y = doc.y; doc.text(mark, M + 8, y, { lineBreak: false }); doc.text(txt, M + 28, y, { width: USABLE - 28, align: 'left', lineGap: 4 }); doc.moveDown(0.25); });
          doc.x = M; doc.moveDown(0.4); break;
        }
        case 'note': {
          const txt = t(b.text); body(11, 'Times-Italic'); const h = doc.heightOfString(txt, { width: USABLE - 20, lineGap: 3 }) + 12; ensure(h + 6); const y = doc.y;
          doc.rect(M, y, USABLE, h).fillColor('#f3f4f6').fill(); doc.rect(M, y, 3, h).fillColor('#555').fill(); body(11, 'Times-Italic').text(txt, M + 12, y + 6, { width: USABLE - 20, lineGap: 3 }); doc.y = y + h + 8; doc.x = M; break;
        }
        case 'code': {
          const lines = t(b.text).split('\n'); doc.font('Courier').fontSize(8.5).fillColor('#111');
          for (const raw of lines) { const line = raw.length ? raw : ' '; const h = doc.heightOfString(line, { width: USABLE - 12, lineGap: 1 }) + 1; ensure(h + 2); const y = doc.y; doc.rect(M, y - 1, USABLE, h + 1).fillColor('#f3f4f6').fill(); doc.fillColor('#111').text(line, M + 6, y, { width: USABLE - 12, lineGap: 1 }); }
          doc.x = M; doc.moveDown(0.8); break;
        }
        case 'placeholder': {
          const isFig = b.label.startsWith('Figure:'); const h = Math.min(b.height ?? 250, bottom() - M - 30); ensure(h + (isFig ? 40 : 10)); const y = doc.y;
          doc.dash(4, { space: 3 }).lineWidth(0.8).strokeColor('#888').rect(M, y, USABLE, h).stroke().undash();
          body(10, 'Times-Italic').fillColor('#888').text(isFig ? 'Insert diagram / screenshot here' : t(b.label), M + 10, y + h / 2 - (isFig ? 6 : 24), { width: USABLE - 20, align: 'center' });
          doc.fillColor('#000'); doc.y = y + h + 6;
          if (isFig) { figN++; body(10.5, 'Times-Italic').text(`Figure ${figN}: ${t(b.label.replace(/^Figure:\s*/, ''))}`, M, doc.y, { width: USABLE, align: 'center' }); }
          doc.moveDown(0.8); break;
        }
        case 'toc': {
          body(11.5); toc.forEach((e, idx) => {
            ensure(18); const y = doc.y; const x = M + (e.level === 2 ? 22 : 0); const label = safeText(e.label); const num = tocPages ? String(tocPages[idx] ?? '') : '0';
            doc.font(e.level === 1 ? 'Times-Bold' : 'Times-Roman').fontSize(e.level === 1 ? 11.5 : 11).text(label, x, y, { width: USABLE - 40 - (x - M), lineBreak: false, ellipsis: true });
            doc.text(num, W - M - 30, y, { width: 30, align: 'right', lineBreak: false }); doc.y = y + (e.level === 1 ? 17 : 15);
          }); doc.x = M; break;
        }
        case 'table': {
          const cols = b.head.length; const widths = (b.widths ?? b.head.map(() => 100 / cols)).map((w) => (w / 100) * USABLE); const pad = 4;
          if (b.caption) { tabN++; ensure(70); body(10.5, 'Times-BoldItalic').text(`Table ${tabN}: ${t(b.caption.replace(/^Table:\s*/, ''))}`, M, doc.y, { width: USABLE, align: 'center' }); doc.moveDown(0.3); }
          const rowH = (cells: string[], bold: boolean) => Math.max(18, ...cells.map((c, i) => { body(10, bold ? 'Times-Bold' : 'Times-Roman'); return doc.heightOfString(t(c) || ' ', { width: widths[i] - 2 * pad, lineGap: 2 }) + 2 * pad; }));
          const drawRow = (cells: string[], bold: boolean, fill?: string) => {
            const h = rowH(cells, bold); if (doc.y + h > bottom()) { doc.addPage(); if (!bold) drawRow(b.head, true, '#e5e7eb'); }
            const y = doc.y; let x = M;
            cells.forEach((c, i) => { if (fill) doc.rect(x, y, widths[i], h).fillColor(fill).fill(); doc.rect(x, y, widths[i], h).lineWidth(0.6).strokeColor('#666').stroke(); body(10, bold ? 'Times-Bold' : 'Times-Roman').text(t(c), x + pad, y + pad, { width: widths[i] - 2 * pad, lineGap: 2 }); x += widths[i]; });
            doc.y = y + h; doc.x = M;
          };
          ensure(rowH(b.head, true) + (b.rows[0] ? rowH(b.rows[0], false) : 0) + 4); drawRow(b.head, true, '#e5e7eb'); b.rows.forEach((r) => drawRow(r, false)); doc.moveDown(1); break;
        }
      }
    }
    const range = doc.bufferedPageRange();
    for (let i = 1; i < range.count; i++) { doc.switchToPage(i); doc.page.margins.bottom = 0; doc.font('Times-Roman').fontSize(10).fillColor('#444').text(String(i + 1), 0, H - 48, { width: W, align: 'center', lineBreak: false }); }
    doc.end(); doc.on('end', () => resolve({ buffer: Buffer.concat(chunks), pages: range.count, headingPages }));
  });
}
