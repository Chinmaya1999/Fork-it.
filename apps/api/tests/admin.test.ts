import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import argon2 from 'argon2';
import { createApp } from '../src/app.js';
import { User } from '../src/models/User.js';
import { Category } from '../src/models/Category.js';
import { Project } from '../src/models/Project.js';
import { AuditLog } from '../src/models/AuditLog.js';

const app = createApp();
const H = { 'x-requested-with': 'projectforge' };
const pw = 'correct-horse-battery-9';
let catId: string; const admin = request.agent(app); const student = request.agent(app);

beforeAll(async () => {
  const passwordHash = await argon2.hash(pw);
  await User.create([{ name: 'Admin', email: 'admin@test.dev', passwordHash, role: 'admin', emailVerified: true }, { name: 'Stu', email: 'stu@test.dev', passwordHash }]);
  catId = String((await Category.create({ name: 'Web', slug: 'web' }))._id);
  await admin.post('/api/v1/auth/login').set(H).send({ email: 'admin@test.dev', password: pw });
  await student.post('/api/v1/auth/login').set(H).send({ email: 'stu@test.dev', password: pw });
});

const body = (o: object = {}) => ({ title: 'Inventory Manager', summary: 'Track stock', category: catId, appType: 'web', pricePaise: 14900, technologies: ['Node.js'], language: 'JavaScript', status: 'published', readme: '# Inventory\n\n1. `npm install`\n2. `npm start`', ...o });

describe('admin authorization', () => {
  it('rejects anonymous (401) and students (403) on every admin route', async () => {
    for (const [m, path] of [['get', '/admin/stats'], ['get', '/admin/projects'], ['post', '/admin/projects'], ['get', '/admin/users'], ['get', '/admin/audit'], ['delete', '/admin/projects/abc']] as const) {
      expect((await (request(app) as any)[m](`/api/v1${path}`).set(H).send({})).status).toBe(401);
      expect((await (student as any)[m](`/api/v1${path}`).set(H).send({})).status).toBe(403);
    }
  });
});

describe('admin project management + README', () => {
  let id: string, slug: string;
  it('creates a project with a README, price in paise, and writes an audit entry', async () => {
    const r = await admin.post('/api/v1/admin/projects').set(H).send(body());
    expect(r.status).toBe(201); id = r.body.project._id; slug = r.body.project.slug;
    expect(r.body.project.isFree).toBe(false);
    expect(await AuditLog.countDocuments({ action: 'project.create' })).toBe(1);
  });
  it('ignores mass-assignment of protected fields', async () => {
    const r = await admin.post('/api/v1/admin/projects').set(H).send(body({ title: 'Other one', slug: 'hacked', views: 999999, _id: '64b000000000000000000000' }));
    expect(r.status).toBe(201); expect(r.body.project.slug).toBe('other-one'); expect(r.body.project.views).toBe(0);
  });
  it('rejects invalid input (bad URL scheme, negative price)', async () => {
    expect((await admin.post('/api/v1/admin/projects').set(H).send(body({ demoUrl: 'javascript:alert(1)' }))).status).toBe(400);
    expect((await admin.post('/api/v1/admin/projects').set(H).send(body({ pricePaise: -5 }))).status).toBe(400);
  });
  it('serves the admin-written README publicly once published; hides it when unpublished', async () => {
    const ok = await request(app).get(`/api/v1/projects/${slug}/readme`);
    expect(ok.status).toBe(200); expect(ok.body.source).toBe('admin'); expect(ok.body.markdown).toContain('npm install');
    await admin.patch(`/api/v1/admin/projects/${id}/status`).set(H).send({ status: 'unpublished' });
    expect((await request(app).get(`/api/v1/projects/${slug}/readme`)).status).toBe(404);
  });
  it('falls back to a clearly-labelled generic README when none exists', async () => {
    const r = await admin.post('/api/v1/admin/projects').set(H).send(body({ title: 'No Readme Proj', readme: '' }));
    const out = await request(app).get(`/api/v1/projects/${r.body.project.slug}/readme`);
    expect(out.body.source).toBe('generated'); expect(out.body.markdown).toMatch(/not tested/i);
  });
  it('refuses to host a project without a reviewed redistribution-permitting license', async () => {
    const r = await admin.post('/api/v1/admin/projects').set(H).send(body({ title: 'Risky', source: { type: 'authorized-redistribution', license: 'NONE' } }));
    expect(r.status).toBe(400);
  });
  it('deletes a project', async () => {
    expect((await admin.delete(`/api/v1/admin/projects/${id}`).set(H)).status).toBe(200);
    expect(await Project.findById(id)).toBeNull();
  });
});

describe('admin user management', () => {
  it('cannot change own role, can suspend a student (session revoked immediately)', async () => {
    const me = await User.findOne({ email: 'admin@test.dev' }); const stu = await User.findOne({ email: 'stu@test.dev' });
    expect((await admin.patch(`/api/v1/admin/users/${me!.id}`).set(H).send({ role: 'student' })).status).toBe(403);
    expect((await admin.patch(`/api/v1/admin/users/${stu!.id}`).set(H).send({ status: 'suspended' })).status).toBe(200);
    expect((await student.get('/api/v1/auth/me')).body.user).toBeNull();
  });
});
