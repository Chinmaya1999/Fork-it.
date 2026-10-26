import { AlignmentType, BorderStyle, Document, Footer, HeadingLevel, HeightRule, LevelFormat, Packer, PageBreak, PageNumber, Paragraph, ShadingType, Table, TableCell, TableOfContents, TableRow, TextRun, WidthType } from 'docx';
import type { Block, StudentDetails } from './types.js';
import { fillTokens, isNumbered } from './shared.js';

const FONT = 'Times New Roman'; const MONO = 'Courier New';
const run = (text: string, o: Partial<ConstructorParameters<typeof TextRun>[0] & object> = {}) => new TextRun({ text, font: FONT, size: 24, ...o } as never);

/** Renders the same block model as an editable Word document (headings use real Heading styles, so Word builds the table of contents). */
export async function renderDocx(blocks: Block[], details: StudentDetails, title: string): Promise<Buffer> {
  const t = (s: string) => fillTokens(s, details); const children: (Paragraph | Table | TableOfContents)[] = [];
  let ch = 0, sec = 0, numbered = false, firstH1 = true, figN = 0, tabN = 0, listInstance = 0;
  const border = { style: BorderStyle.SINGLE, size: 4, color: '666666' }; const borders = { top: border, bottom: border, left: border, right: border };
  const dashed = { style: BorderStyle.DASHED, size: 6, color: '888888' };

  for (const b of blocks) {
    switch (b.t) {
      case 'pagebreak': children.push(new Paragraph({ children: [new PageBreak()] })); break;
      case 'spacer': children.push(new Paragraph({ spacing: { before: (b.h ?? 12) * 10 }, children: [] })); break;
      case 'center': children.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 80 }, children: [run(t(b.text), { size: (b.size ?? 12) * 2, bold: b.bold })] })); break;
      case 'h1': {
        numbered = isNumbered(b.text); if (numbered) { ch++; sec = 0; }
        children.push(new Paragraph({ heading: HeadingLevel.HEADING_1, pageBreakBefore: !firstH1, alignment: AlignmentType.CENTER, children: [run(numbered ? `Chapter ${ch}: ${t(b.text)}` : t(b.text), { bold: true, size: 36 })] })); firstH1 = false; break;
      }
      case 'h2': { if (numbered) sec++; children.push(new Paragraph({ heading: HeadingLevel.HEADING_2, spacing: { before: 240, after: 120 }, keepNext: true, children: [run(numbered ? `${ch}.${sec}  ${t(b.text)}` : t(b.text), { bold: true, size: 28 })] })); break; }
      case 'h3': children.push(new Paragraph({ heading: HeadingLevel.HEADING_3, spacing: { before: 160, after: 80 }, keepNext: true, children: [run(t(b.text), { bold: true, italics: true })] })); break;
      case 'p': children.push(new Paragraph({ alignment: AlignmentType.JUSTIFIED, spacing: { line: 360, after: 120 }, children: [run(t(b.text))] })); break;
      case 'bullets': b.items.forEach((it) => children.push(new Paragraph({ numbering: { reference: 'bullets', level: 0 }, spacing: { line: 340, after: 60 }, children: [run(t(it))] }))); break;
      case 'numbered': { const inst = ++listInstance; b.items.forEach((it) => children.push(new Paragraph({ numbering: { reference: 'numbers', level: 0, instance: inst }, spacing: { line: 340, after: 60 }, children: [run(t(it))] }))); break; }
      case 'note': children.push(new Paragraph({ spacing: { before: 80, after: 160 }, shading: { type: ShadingType.CLEAR, fill: 'F3F4F6' }, border: { left: { style: BorderStyle.SINGLE, size: 18, color: '555555', space: 6 } }, children: [run(t(b.text), { italics: true, size: 22 })] })); break;
      case 'code': t(b.text).split('\n').forEach((ln) => children.push(new Paragraph({ shading: { type: ShadingType.CLEAR, fill: 'F3F4F6' }, spacing: { line: 240 }, children: [new TextRun({ text: ln || ' ', font: MONO, size: 17 })] }))); children.push(new Paragraph({ children: [] })); break;
      case 'placeholder': {
        const isFig = b.label.startsWith('Figure:'); const h = Math.round((b.height ?? 250) * 20);
        children.push(new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: [new TableRow({ height: { value: h, rule: HeightRule.ATLEAST }, children: [new TableCell({ borders: { top: dashed, bottom: dashed, left: dashed, right: dashed }, verticalAlign: 'center' as never, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [run(isFig ? 'Insert diagram / screenshot here' : t(b.label), { italics: true, color: '888888', size: 22 })] })] })] })] }));
        if (isFig) { figN++; children.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 60, after: 200 }, children: [run(`Figure ${figN}: ${t(b.label.replace(/^Figure:\s*/, ''))}`, { italics: true, size: 21 })] })); } else children.push(new Paragraph({ children: [] }));
        break;
      }
      case 'toc': children.push(new TableOfContents('Table of Contents', { hyperlink: true, headingStyleRange: '1-2' }), new Paragraph({ children: [run('In Word: right-click the table above and choose "Update Field" (page numbers appear after updating).', { italics: true, size: 20, color: '777777' })] })); break;
      case 'table': {
        const widths = b.widths ?? b.head.map(() => 100 / b.head.length);
        if (b.caption) { tabN++; children.push(new Paragraph({ alignment: AlignmentType.CENTER, keepNext: true, spacing: { before: 120, after: 80 }, children: [run(`Table ${tabN}: ${t(b.caption.replace(/^Table:\s*/, ''))}`, { bold: true, italics: true, size: 21 })] })); }
        const cell = (txt: string, i: number, head: boolean) => new TableCell({ borders, width: { size: widths[i], type: WidthType.PERCENTAGE }, margins: { top: 60, bottom: 60, left: 80, right: 80 }, shading: head ? { type: ShadingType.CLEAR, fill: 'E5E7EB' } : undefined, children: [new Paragraph({ children: [run(t(txt), { size: 20, bold: head })] })] });
        children.push(new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: [new TableRow({ tableHeader: true, children: b.head.map((h, i) => cell(h, i, true)) }), ...b.rows.map((r) => new TableRow({ cantSplit: true, children: r.map((c, i) => cell(c, i, false)) }))] }), new Paragraph({ children: [] }));
        break;
      }
    }
  }
  const doc = new Document({
    title, creator: 'ProjectForge Report Kit', features: { updateFields: true },
    styles: { default: { document: { run: { font: FONT, size: 24 } } } },
    numbering: { config: [
      { reference: 'bullets', levels: [{ level: 0, format: LevelFormat.BULLET, text: '•', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 720, hanging: 360 } } } }] },
      { reference: 'numbers', levels: [{ level: 0, format: LevelFormat.DECIMAL, text: '%1.', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 720, hanging: 360 } } } }] },
    ] },
    sections: [{ properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: 1440, bottom: 1440, left: 1440, right: 1440 } } }, footers: { default: new Footer({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ children: [PageNumber.CURRENT], font: FONT, size: 20 })] })] }) }, children }],
  });
  return Packer.toBuffer(doc);
}
