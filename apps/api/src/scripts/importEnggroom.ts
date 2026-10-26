// Lists projects from enggroom.com "Free Download" pages as LINK-ONLY entries (title + description + tech + link + attribution).
// No files are copied. robots.txt allows crawling; we fetch ~7 pages politely (1 request/second).
import mongoose from 'mongoose';
import { env } from '../config/env.js';
import { Category } from '../models/Category.js';
import { Project } from '../models/Project.js';
import { slugify } from '../utils/slug.js';
import { classify, difficultyFor, degreesFor, priceFor, techFromTitle, languageFrom, databaseFrom } from '../integrations/classify.js';

const BASE = 'https://www.enggroom.com/';
const PAGES = ['Android/Free Download Android Project.htm', 'PHP Project/Free Download PHP Project.htm', 'Java/free Dwonload Java Project.htm', 'C.aspx', 'VBNet.aspx', 'ASP/Project in Asp with C Sharp.htm', 'ASP/Asp-net-projects-with-source-code.htm'];
const decode = (s: string) => s.replace(/&amp;|&#038;/g, '&').replace(/&#8217;|&rsquo;/g, "'").replace(/&quot;/g, '"').replace(/&nbsp;/g, ' ').replace(/&#\d+;/g, '');
const strip = (s: string) => decode(s.replace(/<br\s*\/?>/gi, ' ').replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
const enc = (rel: string, base: string) => new URL(rel.trim().split('/').map(encodeURIComponent).join('/'), base).href;

await mongoose.connect(env.MONGODB_URI);
const cats = new Map((await Category.find()).map((c) => [c.slug, c._id]));
let n = 0;
for (const page of PAGES) {
  const pageUrl = BASE + page.split('/').map(encodeURIComponent).join('/');
  const res = await fetch(pageUrl, { headers: { 'User-Agent': 'ProjectForge-importer (+listing only)' } });
  if (!res.ok) { console.error(`! ${page}: ${res.status}`); continue; }
  const html = await res.text();
  const rows = html.split(/<tr>/i).filter((r) => /fa-download/.test(r));
  for (const r of rows) {
    const title = strip(r.match(/<h3>([\s\S]*?)<\/h3>/i)?.[1] ?? ''); const href = r.match(/<a\s+href="([^"]+)"[^>]*fa-download/i)?.[1];
    if (!title || !href) continue;
    const url = enc(href.replace(/\s+/g, ' '), pageUrl);
    const desc = strip(r.match(/<p>([\s\S]*?)<\/p>/i)?.[1] ?? ''); const techLine = strip(r.match(/Preferred Technologies:?([\s\S]*?)<\/h4>/i)?.[1] ?? '');
    const clean = title.replace(/^(free\s+)?download\s+/i, '').replace(/\s+with free source code$/i, '').trim() || title;
    const tech = [...new Set([...techLine.split(/[,/]/).map((t) => t.trim()).filter(Boolean), ...techFromTitle(clean)])].slice(0, 8);
    const { cat, appType } = classify(`${clean} ${tech.join(' ')} ${desc}`);
    const difficulty = difficultyFor(`${clean} ${desc}`, appType); const price = priceFor(difficulty, 0);
    await Project.findOneAndUpdate({ 'source.repoUrl': url }, { $set: { language: languageFrom(tech) ?? tech[0], database: databaseFrom(tech) }, $setOnInsert: {
      title: clean.slice(0, 140), slug: `eg-${slugify(clean)}`.slice(0, 80), summary: (desc || `${clean}. Free student project listed on Enggroom.`).slice(0, 300),
      description: `${desc}\n\nListed from Enggroom (${url}). ProjectForge links to the original page and does not host or redistribute these files. Not tested by our team.`,
      category: cats.get(cat), appType, technologies: tech.length ? tech : ['See source'], difficulty, degreeLevels: degreesFor(difficulty, appType), pricePaise: price, isFree: price === 0,
      'source.type': 'external-link', 'source.repoUrl': url, 'source.author': 'Enggroom', 'source.license': 'See source site', 'source.redistributionAllowed': false, 'source.licenseReviewed': false,
      'source.attribution': `Listed from enggroom.com. Original: ${url}`, verification: 'unverified', supportPolicy: 'Third-party project. Optional paid setup & support is separate from the source code.', status: 'published', isSample: false,
    } }, { upsert: true });
    n++;
  }
  console.log(`${page}: ${rows.length} entries`);
  await new Promise((r) => setTimeout(r, 1000));
}
console.log(`Upserted ${n} link-only listings`);
await mongoose.disconnect();
