// Imports public GitHub repositories as EXTERNAL-LINK listings (metadata + link to original; no files copied).
// Licensed repos only (unlicensed are skipped). Inserted as draft; run `npm run attach-zips` afterwards to attach the source ZIP and publish.
// Usage: npm run import-github [-- --topics-only | --keywords-only] [--per-query 30]   (set GITHUB_TOKEN for higher rate limits)
import mongoose from 'mongoose';
import { env } from '../config/env.js';
import { Category } from '../models/Category.js';
import { Project } from '../models/Project.js';
import { slugify } from '../utils/slug.js';
import { searchRepos, isPermissive, hasUsableLicense, type GhRepo } from '../integrations/github.js';
import { classify, difficultyFor, degreesFor, priceFor } from '../integrations/classify.js';

const arg = (n: string) => process.argv.includes(n);
const perQuery = Number(process.argv[process.argv.indexOf('--per-query') + 1]) || 30;
const languages = ['Python', 'JavaScript', 'TypeScript', 'Java', 'C#', 'PHP', 'Kotlin', 'Dart', 'Go', 'C++', 'Swift', 'Ruby'];
const keywords = ['management system', 'final year project', 'mern stack', 'application'];
const topics = ['devops-project', 'college-project', 'mern-project', 'java-project', 'dotnet-project', 'javascript-projects', 'python-project', 'php-project', 'android-project', 'flutter-project', 'react-project', 'machine-learning-projects'];

type Job = { q: string; per: number; page: number; sort?: string; order?: string; force?: { cat: string; appType: string } };
const jobs: Job[] = [];
const only = process.argv.includes('--only') ? process.argv[process.argv.indexOf('--only') + 1].split(',') : null; // e.g. --only devops-project,college-project
if (!arg('--keywords-only')) for (const t of topics) { if (only && !only.includes(t)) continue; for (const page of [1, 2, 3, 4, 5]) jobs.push({ q: `topic:${t} archived:false fork:false`, per: 100, page, force: t === 'devops-project' ? { cat: 'cloud-devops', appType: 'cloud-devops' } : undefined }); }
// the exact view you linked: devops-project, Java, fewest forks first
if (!only || only.includes('devops-project')) for (const page of [1, 2, 3]) jobs.push({ q: 'topic:devops-project language:java archived:false fork:false', per: 100, page, sort: 'forks', order: 'asc', force: { cat: 'cloud-devops', appType: 'cloud-devops' } });
if (!arg('--topics-only') && !only) for (const l of languages) for (const k of keywords) jobs.push({ q: `${k} language:"${l}" stars:>25 archived:false fork:false`, per: perQuery, page: 1 });

// --extra: management systems, e-commerce and service-based apps (all open-source licensed; unlicensed repos are skipped below)
if (arg('--extra')) {
  jobs.length = 0;
  const mgmt = ['student management system', 'library management system', 'hospital management system', 'inventory management system', 'employee management system', 'payroll management system', 'attendance management system', 'hotel management system', 'school management system', 'college management system', 'bank management system', 'restaurant management system', 'pharmacy management system', 'billing system', 'point of sale', 'crm', 'erp', 'hr management system', 'online examination system', 'event management system', 'parking management system', 'vehicle rental system', 'online voting system', 'blood bank management system', 'railway reservation system', 'airline reservation system', 'courier management system', 'warehouse management system', 'clinic management system', 'gym management system', 'real estate management system', 'job portal', 'learning management system', 'booking system', 'ticket booking system'];
  const shop = ['ecommerce', 'e-commerce website', 'online shopping cart', 'online store', 'shopping website', 'multi vendor marketplace', 'grocery delivery app', 'food delivery app', 'ecommerce app', 'ecommerce mern'];
  const services = ['service booking app', 'home services marketplace', 'taxi booking app', 'appointment booking system', 'freelance marketplace', 'delivery tracking system', 'customer support ticketing system', 'online food ordering system', 'car rental service', 'repair service management'];
  for (const k of [...mgmt, ...shop, ...services]) for (const page of [1, 2]) jobs.push({ q: `${k} in:name,description,topics archived:false fork:false`, per: 100, page });
}
// --stack: PHP and MERN full-stack projects
if (arg('--stack')) {
  jobs.length = 0;
  const qs = ['php mysql project', 'php full stack', 'php laravel project', 'php codeigniter project', 'core php project', 'php management system', 'php ecommerce', 'laravel ecommerce', 'laravel management system', 'php crud', 'php login registration', 'php blog cms', 'mern stack', 'mern full stack', 'mern ecommerce', 'mern social media', 'mern chat app', 'mern todo', 'mern blog', 'mern management system', 'mern job portal', 'mern booking', 'mern dashboard', 'react node express mongodb', 'mern stack project', 'mern stack application'];
  for (const k of qs) for (const page of [1, 2, 3]) jobs.push({ q: `${k} in:name,description,topics archived:false fork:false`, per: 100, page });
  for (const t of ['mern', 'mern-stack', 'mern-project', 'php-project', 'laravel-project', 'php-mysql', 'fullstack']) for (const page of [1, 2, 3, 4, 5]) jobs.push({ q: `topic:${t} archived:false fork:false`, per: 100, page });
}
const delay = process.env.GITHUB_TOKEN ? 2500 : 7000; // search API: 30/min with token, 10/min without
await mongoose.connect(env.MONGODB_URI);
const cats = new Map((await Category.find()).map((c) => [c.slug, c._id]));
const seen = new Set<string>();
let published = 0, drafts = 0, skipped = 0;

for (const job of jobs) {
  let repos: GhRepo[];
  try { repos = await searchRepos(job.q, job.per, undefined, job.page, job.sort, job.order); } catch (e) { console.error(`! ${job.q}: ${(e as Error).message}`); continue; }
  for (const r of repos) {
    if (seen.has(r.full_name) || r.archived || r.fork || !r.description) { skipped++; continue; }
    seen.add(r.full_name);
    const text = `${r.full_name} ${(r.topics ?? []).join(' ')} ${r.description} ${r.language}`;
    const { cat, appType } = job.force ?? classify(text);
    const difficulty = difficultyFor(text, appType);
    const spdx = r.license?.spdx_id; const licensed = hasUsableLicense(spdx);
    if (!licensed) { skipped++; continue; } // only open-source licensed repos: their source ZIP can be redistributed
    const tech = [...new Set([r.language!, ...(r.topics ?? []).slice(0, 5)])].filter(Boolean);
    await Project.findOneAndUpdate({ 'source.repoUrl': r.html_url }, {
      $set: { 'source.stars': r.stargazers_count, 'source.repoUpdatedAt': new Date(r.pushed_at) },
      $setOnInsert: {
        title: r.full_name.split('/')[1].replace(/[-_]/g, ' ').slice(0, 140), slug: slugify(r.full_name.replace('/', '-')), summary: r.description!.slice(0, 300),
        description: `${r.description}\n\nImported from GitHub (${r.html_url}). Not tested by the ProjectForge team. Review the repository README for setup instructions.`,
        category: cats.get(cat), appType, technologies: tech, language: r.language, difficulty, degreeLevels: degreesFor(difficulty, appType),
        pricePaise: priceFor(difficulty, r.stargazers_count), isFree: priceFor(difficulty, r.stargazers_count) === 0,
        'source.type': 'external-link', 'source.repoUrl': r.html_url, 'source.author': r.owner.login, 'source.license': licensed ? spdx : 'NONE',
        'source.redistributionAllowed': isPermissive(spdx), 'source.licenseReviewed': false,
        'source.attribution': `© ${r.owner.login}. Licensed under ${licensed ? spdx : 'no declared license'}. Original: ${r.html_url}`,
        verification: 'unverified', supportPolicy: 'Community project. Optional paid setup & support is separate from the source code.',
        status: 'draft', isSample: false,
      },
    }, { upsert: true });
    licensed ? published++ : drafts++;
  }
  console.log(`${job.q.slice(0, 60)} p${job.page}: published=${published} drafts=${drafts}`);
  await new Promise((r) => setTimeout(r, delay));
}
console.log(`Done. jobs=${jobs.length} published=${published} drafts(no license, need review)=${drafts} skipped=${skipped}`);
await mongoose.disconnect();
