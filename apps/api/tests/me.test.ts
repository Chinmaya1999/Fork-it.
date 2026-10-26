import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { Category } from '../src/models/Category.js';
import { Project } from '../src/models/Project.js';
import { User } from '../src/models/User.js';

const app = createApp(); const H = { 'x-requested-with': 'projectforge' };
const a = request.agent(app), b = request.agent(app);
let pid: string, draftId: string;

beforeAll(async () => {
  const cat = await Category.create({ name: 'Mobile', slug: 'mobile' });
  const base = { category: cat._id, summary: 's', appType: 'mobile' as const };
  pid = String((await Project.create({ ...base, title: 'Pub', slug: 'pub', status: 'published' }))._id);
  draftId = String((await Project.create({ ...base, title: 'Draft', slug: 'draft', status: 'draft' }))._id);
  for (const [ag, e] of [[a, 'a@t.dev'], [b, 'b@t.dev']] as const) await ag.post('/api/v1/auth/register').set(H).send({ name: 'User ' + e, email: e, password: 'long-enough-pass1' });
});

describe('bookmarks', () => {
  it('requires auth', async () => { expect((await request(app).get('/api/v1/me/bookmarks')).status).toBe(401); });
  it('saves idempotently, lists only own, and hides drafts', async () => {
    expect((await a.put(`/api/v1/me/bookmarks/${pid}`).set(H)).status).toBe(200);
    expect((await a.put(`/api/v1/me/bookmarks/${pid}`).set(H)).status).toBe(200);
    const mine = await a.get('/api/v1/me/bookmarks'); expect(mine.body.ids).toEqual([pid]); expect(mine.body.items).toHaveLength(1);
    expect((await b.get('/api/v1/me/bookmarks')).body.ids).toEqual([]);
    expect((await a.put(`/api/v1/me/bookmarks/${draftId}`).set(H)).status).toBe(404);
  });
  it('removes a bookmark', async () => {
    await a.delete(`/api/v1/me/bookmarks/${pid}`).set(H);
    expect((await a.get('/api/v1/me/bookmarks')).body.ids).toEqual([]);
  });
});

describe('email verification', () => {
  it('resend returns a dev link (no SMTP), and the link verifies the account', async () => {
    const r = await a.post('/api/v1/auth/resend-verification').set(H);
    expect(r.status).toBe(200); expect(r.body.devLink).toMatch(/verify-email\?token=/);
    const token = new URL(r.body.devLink).searchParams.get('token');
    expect((await request(app).post('/api/v1/auth/verify-email').set(H).send({ token })).status).toBe(200);
    expect((await a.get('/api/v1/auth/me')).body.user.emailVerified).toBe(true);
    expect((await a.post('/api/v1/auth/resend-verification').set(H)).body.alreadyVerified).toBe(true);
  });
  it('a used token cannot be replayed', async () => {
    const r = await b.post('/api/v1/auth/resend-verification').set(H); const token = new URL(r.body.devLink).searchParams.get('token');
    await request(app).post('/api/v1/auth/verify-email').set(H).send({ token });
    expect((await request(app).post('/api/v1/auth/verify-email').set(H).send({ token })).status).toBe(400);
    expect(await User.countDocuments({ emailVerified: true })).toBe(2);
  });
});
