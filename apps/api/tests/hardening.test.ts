import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import argon2 from 'argon2';
import { createApp } from '../src/app.js';
import { User } from '../src/models/User.js';
import { Category } from '../src/models/Category.js';
import { Project } from '../src/models/Project.js';
import { ProjectFile } from '../src/models/ProjectFile.js';
import { saveBuffer } from '../src/services/storage.js';
import { stripCloneSteps } from '../src/utils/readme.js';

const app = createApp(); const H = { 'x-requested-with': 'projectforge' }; const pw = 'correct-horse-battery-9';
const stu = request.agent(app); let fileId: string;

beforeAll(async () => {
  await User.create({ name: 'Hard', email: 'hard@h.dev', passwordHash: await argon2.hash(pw), emailVerified: true });
  await stu.post('/api/v1/auth/login').set(H).send({ email: 'hard@h.dev', password: pw });
  const cat = await Category.create({ name: 'Mgmt', slug: 'mgmt' });
  const p = await Project.create({ category: cat._id, appType: 'web', status: 'published', title: 'OSS Lib System', slug: 'oss-lib', summary: 's', pricePaise: 9900, source: { type: 'external-link', repoUrl: 'https://github.com/a/b', license: 'MIT' } });
  const saved = await saveBuffer(Buffer.from('PK\x03\x04 zip'));
  fileId = String((await ProjectFile.create({ project: p._id, label: 'Source', kind: 'source', originalName: 'b.zip', storageKey: saved.key, sizeBytes: saved.sizeBytes, sha256: saved.sha256 }))._id);
});

describe('source ZIP access (open-source listings)', () => {
  it('is never offered or downloadable without a paid order', async () => {
    const d = (await request(app).get('/api/v1/projects/oss-lib')).body;
    expect(d.files).toBeUndefined(); expect(JSON.stringify(d)).not.toContain('storageKey');
    expect((await request(app).post(`/api/v1/files/${fileId}/link`).set(H)).status).toBe(401); // anonymous
    expect((await stu.post(`/api/v1/files/${fileId}/link`).set(H)).status).toBe(403); // logged in, not purchased
  });
  it('requires the CSRF header on state-changing calls', async () => {
    expect((await stu.post(`/api/v1/files/${fileId}/link`)).status).toBe(403);
  });
});

describe('stripCloneSteps', () => {
  it('removes the clone step, its command and the cd line, keeping the rest', () => {
    const out = stripCloneSteps('## Setup\n\n1. Clone the repository:\n\n```bash\ngit clone https://github.com/a/b.git\ncd b\n```\n\n2. Install\n\n```\nnpm i\n```\n');
    expect(out).not.toMatch(/clone/i); expect(out).not.toContain('cd b'); expect(out).toContain('npm i'); expect(out).toContain('2. Install');
  });
  it('removes inline git clone lines and "Clone" headings', () => {
    expect(stripCloneSteps('### Clone the repository\nUse `git clone x` here\nKeep me')).toBe('Keep me');
  });
  it('leaves READMEs without clone steps unchanged', () => { const md = '# T\n\n```js\nconsole.log(1)\n```'; expect(stripCloneSteps(md)).toBe(md); });
});
