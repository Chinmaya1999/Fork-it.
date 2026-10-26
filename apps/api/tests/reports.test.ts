import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import argon2 from 'argon2';
import { createApp } from '../src/app.js';
import { User } from '../src/models/User.js';
import { Category } from '../src/models/Category.js';
import { Project } from '../src/models/Project.js';
import { Order } from '../src/models/Order.js';
import { buildBlocks } from '../src/services/report/build.js';
import { matchTechs } from '../src/services/report/knowledge.js';
import { fillTokens } from '../src/services/report/shared.js';
import { generateReport } from '../src/services/report/index.js';
import type { ReportProject } from '../src/services/report/types.js';

const base: ReportProject = { title: 'Sample', slug: 'sample', summary: 'A sample project.', features: [], technologies: [], appType: 'web', difficulty: 'beginner', prerequisites: [] };
const text = (blocks: ReturnType<typeof buildBlocks>) => JSON.stringify(blocks);

describe('report content (unit)', () => {
  it('only matches technologies it actually knows — unknown terms are skipped, never invented', () => {
    expect(matchTechs(['React', 'Node.js', 'MongoDB', 'TotallyMadeUpFramework']).map((t) => t.key).sort()).toEqual(['mongodb', 'node', 'react']);
    expect(matchTechs(['nothing-known', undefined, null])).toEqual([]);
  });
  it('fills student details, and shows visible [placeholders] when they are missing', () => {
    expect(fillTokens('By {{studentName}} of {{college}}', { studentName: 'Riya', college: 'ABC' })).toBe('By Riya of ABC');
    expect(fillTokens('By {{studentName}}', {})).toBe('By [Student Name]');
  });
  it('attributes third-party projects honestly and never claims they are original work', () => {
    const t = text(buildBlocks({ ...base, title: 'Hello App', source: { type: 'external-link', author: 'octocat', repoUrl: 'https://github.com/octocat/hello', license: 'MIT' } }));
    expect(t).toContain('originally created by octocat'); expect(t).toContain('https://github.com/octocat/hello'); expect(t).toContain('MIT'); expect(t).toContain('what YOU did');
    expect(t).not.toMatch(/original work of the student|my own work/i);
  });
  it('leaves test results blank and never reports results that were not run', () => {
    const blocks = buildBlocks(base); const tbl = blocks.find((b) => b.t === 'table' && b.caption === 'Table: Test cases') as any;
    expect(tbl.rows.length).toBeGreaterThan(10); expect(tbl.rows.every((r: string[]) => r[4] === '' && r[5] === '')).toBe(true);
  });
  it('does not invent project features: with no features on record it labels the modules as typical', () => {
    expect(text(buildBlocks(base))).toContain('typical for a');
  });
  it('lists only real, verifiable reference sources', () => {
    const t = text(buildBlocks({ ...base, technologies: ['React'] })); expect(t).toContain('Software Engineering'); expect(t).toContain('https://react.dev'); expect(t).not.toMatch(/IEEE Trans|doi\.org/);
  });
});

describe('page count guarantee (renders the real PDF)', () => {
  const samples: ReportProject[] = [
    { ...base, title: 'MERN Shop', technologies: ['MongoDB', 'Express', 'React', 'Node.js'], language: 'JavaScript' },
    { ...base, title: 'Tiny Calculator' }, { ...base, title: 'Sentiment', appType: 'ai-ml', technologies: ['Python', 'scikit-learn'] },
    { ...base, title: 'Android Notes', appType: 'mobile', technologies: ['Kotlin', 'Android'] },
  ];
  for (const s of samples) it(`${s.title}: PDF has at least 50 pages and the DOCX is a valid package`, async () => {
    const pdf = await generateReport(s, { studentName: 'Riya Sharma' }, 'pdf'); expect(pdf.pages).toBeGreaterThanOrEqual(50); expect(pdf.buffer.subarray(0, 4).toString()).toBe('%PDF');
    const docx = await generateReport(s, {}, 'docx'); expect(docx.buffer.subarray(0, 2).toString()).toBe('PK'); expect(docx.filename).toMatch(/\.docx$/);
  }, 60000);
});

describe('report endpoint access control', () => {
  const H = { 'x-requested-with': 'projectforge' }; const pw = 'correct-horse-battery-9'; const app = createApp();
  const buyer = request.agent(app), other = request.agent(app), admin = request.agent(app);
  beforeAll(async () => {
    const passwordHash = await argon2.hash(pw);
    const us = await User.create([{ name: 'B', email: 'b@r.dev', passwordHash, emailVerified: true }, { name: 'O', email: 'o@r.dev', passwordHash, emailVerified: true }, { name: 'A', email: 'a@r.dev', passwordHash, role: 'admin', emailVerified: true }]);
    for (const [a, e] of [[buyer, 'b'], [other, 'o'], [admin, 'a']] as const) await a.post('/api/v1/auth/login').set(H).send({ email: `${e}@r.dev`, password: pw });
    const cat = await Category.create({ name: 'W', slug: 'w' }); const b = { category: cat._id, appType: 'web' as const, summary: 's', technologies: ['React'] };
    await Project.create([{ ...b, title: 'Free One', slug: 'free-one', pricePaise: 0, status: 'published' }, { ...b, title: 'Paid One', slug: 'paid-one', pricePaise: 9900, status: 'published' }, { ...b, title: 'Draft One', slug: 'draft-one', pricePaise: 0, status: 'draft' }]);
    await Order.create({ ref: 'PF-R1', type: 'project', user: us[0]._id, project: (await Project.findOne({ slug: 'paid-one' }))!._id, title: 'Paid One', amountPaise: 9900, gateway: 'mock', status: 'paid' });
  });
  it('requires login', async () => { expect((await request(app).post('/api/v1/projects/free-one/report').set(H).send({})).status).toBe(401); });
  it('free project: a logged-in user gets a PDF with a page count header', async () => {
    const r = await other.post('/api/v1/projects/free-one/report').set(H).send({ format: 'pdf', details: { studentName: 'Riya' } }).buffer(true).parse((res, cb) => { const c: Buffer[] = []; res.on('data', (x: Buffer) => c.push(x)); res.on('end', () => cb(null, Buffer.concat(c))); });
    expect(r.status).toBe(200); expect(r.headers['content-type']).toMatch(/pdf/); expect(Number(r.headers['x-report-pages'])).toBeGreaterThanOrEqual(50); expect(r.headers['content-disposition']).toMatch(/free-one-project-report\.pdf/);
  }, 60000);
  it('paid project: refused without a verified purchase; allowed for the buyer and for admin', async () => {
    expect((await other.post('/api/v1/projects/paid-one/report').set(H).send({})).status).toBe(403);
    expect((await buyer.post('/api/v1/projects/paid-one/report').set(H).send({ format: 'docx' })).status).toBe(200);
    expect((await admin.post('/api/v1/projects/paid-one/report').set(H).send({})).status).toBe(200);
  }, 60000);
  it('a refunded purchase no longer unlocks the report', async () => {
    await Order.updateOne({ ref: 'PF-R1' }, { status: 'refunded' }); expect((await buyer.post('/api/v1/projects/paid-one/report').set(H).send({})).status).toBe(403);
  });
  it('hides unpublished projects and validates input', async () => {
    expect((await other.post('/api/v1/projects/draft-one/report').set(H).send({})).status).toBe(404);
    expect((await other.post('/api/v1/projects/free-one/report').set(H).send({ details: { studentName: 'x'.repeat(500) } })).status).toBe(400);
    expect((await other.post('/api/v1/projects/free-one/report').set(H).send({ format: 'exe' })).status).toBe(400);
  });
});
