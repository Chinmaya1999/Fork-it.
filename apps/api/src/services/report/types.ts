export type Block =
  | { t: 'h1'; text: string } | { t: 'h2'; text: string } | { t: 'h3'; text: string }
  | { t: 'p'; text: string } | { t: 'bullets'; items: string[] } | { t: 'numbered'; items: string[] }
  | { t: 'table'; head: string[]; rows: string[][]; widths?: number[]; caption?: string }
  | { t: 'code'; text: string } | { t: 'note'; text: string }
  | { t: 'placeholder'; label: string; height?: number }   // boxed area the student fills (screenshot, diagram)
  | { t: 'center'; text: string; size?: number; bold?: boolean } | { t: 'pagebreak' } | { t: 'spacer'; h?: number }
  | { t: 'toc' };

export interface StudentDetails { studentName?: string; rollNo?: string; degree?: string; department?: string; college?: string; university?: string; guide?: string; year?: string }
export interface ReportProject {
  title: string; slug: string; summary: string; description?: string; abstract?: string; features: string[]; technologies: string[]; language?: string | null; framework?: string | null; database?: string | null;
  appType: string; difficulty: string; prerequisites: string[]; requirements?: { hardware?: string[]; software?: string[] } | null; version?: string;
  source?: { type?: string; repoUrl?: string | null; author?: string | null; license?: string | null; attribution?: string | null } | null; readme?: string | null;
}
export const p = (text: string): Block => ({ t: 'p', text });
export const h1 = (text: string): Block => ({ t: 'h1', text });
export const h2 = (text: string): Block => ({ t: 'h2', text });
export const h3 = (text: string): Block => ({ t: 'h3', text });
export const bullets = (...items: string[]): Block => ({ t: 'bullets', items });
export const numbered = (...items: string[]): Block => ({ t: 'numbered', items });
export const note = (text: string): Block => ({ t: 'note', text });
export const table = (head: string[], rows: string[][], widths?: number[], caption?: string): Block => ({ t: 'table', head, rows, widths, caption });
