import type { ReportProject, StudentDetails } from './types.js';
import { buildBlocks } from './build.js';
import { renderPdf } from './pdf.js';
import { renderDocx } from './docx.js';
import { extraChapters } from './theory.js';

export const MIN_PAGES = 50; const TARGET = 52; // comfortable margin so tiny layout differences never drop the PDF below 50 pages
export interface GeneratedReport { buffer: Buffer; contentType: string; filename: string; pages: number }

/**
 * Builds the report kit. The page count is measured on the real PDF render; if a project's own content is short, extra educational
 * appendices (project management, risk, UI principles, cloud, ...) are added until the document reaches the minimum length.
 */
export async function generateReport(project: ReportProject, details: StudentDetails, format: 'pdf' | 'docx'): Promise<GeneratedReport> {
  const maxExtra = extraChapters().length;
  let blocks = buildBlocks(project, 0), pdf = await renderPdf(blocks, details, project.title);
  for (let extra = 1; pdf.pages < TARGET && extra <= maxExtra; extra++) { blocks = buildBlocks(project, extra); pdf = await renderPdf(blocks, details, project.title); }
  if (pdf.pages < MIN_PAGES) throw new Error(`Report for "${project.title}" only reached ${pdf.pages} pages`);
  const base = `${project.slug}-project-report`;
  if (format === 'pdf') return { buffer: pdf.buffer, contentType: 'application/pdf', filename: `${base}.pdf`, pages: pdf.pages };
  return { buffer: await renderDocx(blocks, details, project.title), contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', filename: `${base}.docx`, pages: pdf.pages };
}
