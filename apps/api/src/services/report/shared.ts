import type { Block, StudentDetails } from './types.js';
export const DETAIL_LABELS: Record<keyof StudentDetails, string> = { studentName: '[Student Name]', rollNo: '[Roll Number]', degree: '[Degree]', department: '[Department]', college: '[College Name]', university: '[University Name]', guide: '[Guide Name]', year: '[Academic Year]' };
/** Replaces {{tokens}} with the student's details, or a visible [Placeholder] when not provided. */
export const fillTokens = (text: string, d: StudentDetails) => text.replace(/\{\{(\w+)\}\}/g, (_m, k: keyof StudentDetails) => (d[k]?.trim() ? d[k]!.trim() : DETAIL_LABELS[k] ?? `[${k}]`));
export interface TocEntry { level: 1 | 2; label: string }
const isNumbered = (t: string) => !/^(Appendix|References)/.test(t);
/** Table-of-contents entries in document order (chapter and section numbers). */
export function tocEntries(blocks: Block[]): TocEntry[] {
  const out: TocEntry[] = []; let ch = 0, sec = 0, numbered = false;
  for (const b of blocks) {
    if (b.t === 'h1') { numbered = isNumbered(b.text); if (numbered) { ch++; sec = 0; } out.push({ level: 1, label: numbered ? `Chapter ${ch}: ${b.text}` : b.text }); }
    else if (b.t === 'h2') { if (numbered) { sec++; out.push({ level: 2, label: `${ch}.${sec} ${b.text}` }); } else out.push({ level: 2, label: b.text }); }
  }
  return out;
}
export const safeText = (s: string) => s.replace(/[^\x20-\x7E -ÿ‘’“”–—•…\n\t]/g, '?'); // standard PDF fonts cover Latin-1 only
export { isNumbered };
