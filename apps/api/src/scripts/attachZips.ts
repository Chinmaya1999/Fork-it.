// Attaches the source-code ZIP of each project's GitHub repo (licensed repos only) and picks up preview images from its README.
// Projects that end up with no source ZIP are set to 'unpublished'. Resumable: projects that already have a source file are skipped.
// Usage: npm run attach-zips [-- --limit 50] [--concurrency 6] [--max-mb 100]
import mongoose from 'mongoose';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { env } from '../config/env.js';
import { Project } from '../models/Project.js';
import { ProjectFile } from '../models/ProjectFile.js';
import { saveFromPath, removeObject } from '../services/storage.js';
import { parseRepo } from '../integrations/github.js';

const opt = (n: string, d: number) => Number(process.argv[process.argv.indexOf(n) + 1]) || d;
const limit = opt('--limit', 0), concurrency = opt('--concurrency', 6), maxBytes = opt('--max-mb', 100) * 1024 * 1024;
const UA = { 'User-Agent': 'ProjectForge-importer' };

const BAD_IMG = /shields\.io|badge|travis-ci|circleci|codecov|coveralls|github\.com\/[^/]+\/[^/]+\/(actions|workflows)|\.svg(\?|$)|sponsor|buymeacoffee|paypal|ko-fi|visitor|komarev|wakatime|capsule-render/i;
async function readmeText(owner: string, repo: string, stored?: string) {
  if (stored && stored.length > 50) return stored;
  for (const f of ['README.md', 'readme.md', 'Readme.md', 'README.MD']) {
    try { const r = await fetch(`https://raw.githubusercontent.com/${owner}/${repo}/HEAD/${f}`, { headers: UA, signal: AbortSignal.timeout(10_000) }); if (r.ok) return (await r.text()).slice(0, 200_000); } catch { /* try next */ }
  }
  return '';
}
function previewImages(md: string, owner: string, repo: string) {
  const urls = [...md.matchAll(/!\[[^\]]*\]\(\s*<?([^)\s>]+)/g), ...md.matchAll(/<img[^>]+src=["']([^"']+)["']/gi)].map((m) => m[1]);
  const out: string[] = [];
  for (let u of urls) {
    if (!/^https?:\/\//i.test(u)) u = `https://raw.githubusercontent.com/${owner}/${repo}/HEAD/${u.replace(/^\.?\//, '')}`;
    u = u.replace(/^(https:\/\/github\.com\/[^/]+\/[^/]+)\/blob\//, '$1/raw/');
    if (BAD_IMG.test(u) || !/\.(png|jpe?g|gif|webp)(\?|$)/i.test(u) && !/user-attachments|user-images\.githubusercontent/i.test(u)) continue;
    if (!out.includes(u)) out.push(u);
    if (out.length >= 4) break;
  }
  return out;
}

const OPEN_LICENSE = /^(MIT|Apache|GPL|AGPL|LGPL|BSD|ISC|Unlicense|0BSD|CC0|CC-BY|MPL|EPL|BSL|OSL|Zlib|WTFPL|Artistic|AFL|ECL|MS-PL|MS-RL|NCSA|PostgreSQL|UPL)/; // real open-source licenses only; 'NONE'/'NOASSERTION'/site names don't qualify

type Result = 'attached' | 'unpublished' | 'retry';
async function download(owner: string, repo: string): Promise<{ tmp: string } | 'missing' | 'toolarge' | 'retry'> {
  const tmp = path.join(os.tmpdir(), `pf-zip-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  try {
    const res = await fetch(`https://codeload.github.com/${owner}/${repo}/zip/HEAD`, { headers: UA, signal: AbortSignal.timeout(180_000) });
    if (res.status === 404 || res.status === 451 || res.status === 403 && !res.headers.get('x-ratelimit-remaining')) return 'missing';
    if (!res.ok || !res.body) return 'retry';
    if (Number(res.headers.get('content-length')) > maxBytes) { await res.body.cancel(); return 'toolarge'; }
    let n = 0;
    const body = Readable.fromWeb(res.body as any);
    body.on('data', (c: Buffer) => { n += c.length; if (n > maxBytes) body.destroy(new Error('toolarge')); });
    await pipeline(body, fs.createWriteStream(tmp));
    const fd = await fs.promises.open(tmp, 'r'); const b = Buffer.alloc(2); await fd.read(b, 0, 2, 0); await fd.close();
    if (b[0] !== 0x50 || b[1] !== 0x4b) { await fs.promises.unlink(tmp); return 'missing'; }
    return { tmp };
  } catch (e) { await fs.promises.unlink(tmp).catch(() => undefined); return (e as Error).message.includes('toolarge') ? 'toolarge' : 'retry'; }
}

async function handle(p: any): Promise<Result> {
  const gh = parseRepo(p.source?.repoUrl); const licensed = OPEN_LICENSE.test(p.source?.license ?? '');
  if (!gh || !licensed) return 'unpublished'; // no repo to take a ZIP from, or no license permitting redistribution
  const d = await download(gh.owner, gh.repo);
  if (d === 'retry') return 'retry';
  if (d === 'missing' || d === 'toolarge') return 'unpublished';
  const saved = await saveFromPath(d.tmp);
  try {
    await ProjectFile.create({ project: p._id, label: 'Source code (GitHub)', kind: 'source', version: p.version ?? '1.0.0', originalName: `${gh.repo}.zip`, storageKey: saved.key, sizeBytes: saved.sizeBytes, sha256: saved.sha256 });
  } catch (e) { await removeObject(saved.key); throw e; }
  const set: Record<string, unknown> = { status: 'published' };
  if (!p.screenshots?.length) {
    const imgs = previewImages(await readmeText(gh.owner, gh.repo, p.readme?.content), gh.owner, gh.repo);
    if (imgs.length) { set.screenshots = imgs; if (!p.thumbnail) set.thumbnail = imgs[0]; }
  }
  await Project.updateOne({ _id: p._id }, { $set: set });
  return 'attached';
}

await mongoose.connect(env.MONGODB_URI);
const withFile = new Set((await ProjectFile.distinct('project', { kind: 'source' })).map(String));
const todo = (await Project.find({ status: process.argv.includes('--only-draft') ? 'draft' : { $in: ['published', 'draft', 'unpublished'] }, 'source.type': { $ne: 'original' } }) // original (owner-authored) projects are never auto-removed
  .select('title source readme screenshots thumbnail version status').lean()).filter((p) => !withFile.has(String(p._id)));
const queue = limit ? todo.slice(0, limit) : todo;
console.log(`projects without a source ZIP: ${todo.length}; processing ${queue.length}`);
const stats = { attached: 0, unpublished: 0, retry: 0, error: 0 }; let i = 0, done = 0;
await Promise.all(Array.from({ length: concurrency }, async () => {
  while (i < queue.length) {
    const p = queue[i++];
    try {
      const r = await handle(p); stats[r]++;
      if (r === 'unpublished') await Project.updateOne({ _id: p._id }, { $set: { status: 'unpublished' } });
    } catch (e) { stats.error++; console.error(`! ${p.title}: ${(e as Error).message}`); }
    if (++done % 25 === 0) console.log(`${done}/${queue.length}`, stats);
  }
}));
console.log('Done', stats);
await mongoose.disconnect();
