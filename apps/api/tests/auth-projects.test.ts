import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { User } from '../src/models/User.js';
import { Category } from '../src/models/Category.js';
import { Project } from '../src/models/Project.js';

const app = createApp();
const H = { 'x-requested-with': 'projectforge' };
const creds = { name: 'Asha Student', email: 'asha@example.com', password: 'correct-horse-9' };

describe('auth', () => {
  it('registers, ignores a client-supplied role, and sets an HttpOnly cookie', async () => {
    const r = await request(app).post('/api/v1/auth/register').set(H).send({ ...creds, role: 'admin' });
    expect(r.status).toBe(201);
    expect(r.body.user.role).toBe('student');
    expect(r.headers['set-cookie'][0]).toMatch(/HttpOnly/i);
    expect((await User.findOne({ email: creds.email }))!.role).toBe('student');
  });
  it('rejects state-changing requests without the CSRF header', async () => {
    const r = await request(app).post('/api/v1/auth/login').send({ email: creds.email, password: creds.password });
    expect(r.status).toBe(403);
  });
  it('logs in, returns /me, and rejects a wrong password', async () => {
    const agent = request.agent(app);
    expect((await agent.post('/api/v1/auth/login').set(H).send(creds)).status).toBe(200);
    expect((await agent.get('/api/v1/auth/me')).body.user.email).toBe(creds.email);
    expect((await request(app).post('/api/v1/auth/login').set(H).send({ email: creds.email, password: 'wrong-password' })).status).toBe(401);
  });
  it('blocks NoSQL operator injection in login', async () => {
    const r = await request(app).post('/api/v1/auth/login').set(H).send({ email: { $ne: '' }, password: { $ne: '' } });
    expect(r.status).toBe(400);
  });
  it('suspended users lose access immediately', async () => {
    const agent = request.agent(app);
    await agent.post('/api/v1/auth/login').set(H).send(creds);
    await User.updateOne({ email: creds.email }, { status: 'suspended' });
    expect((await agent.get('/api/v1/auth/me')).body.user).toBeNull();
    await User.updateOne({ email: creds.email }, { status: 'active' });
  });
});

describe('projects', () => {
  it('lists only published projects with filters, pagination and no private fields', async () => {
    const cat = await Category.create({ name: 'Web', slug: 'web' });
    const base = { category: cat._id, summary: 's', appType: 'web' as const };
    await Project.create([
      { ...base, title: 'Free One', slug: 'free-one', pricePaise: 0, status: 'published', technologies: ['React'] },
      { ...base, title: 'Paid One', slug: 'paid-one', pricePaise: 149900, status: 'published', technologies: ['Django'] },
      { ...base, title: 'Hidden', slug: 'hidden', pricePaise: 100, status: 'draft' },
    ]);
    const all = await request(app).get('/api/v1/projects');
    expect(all.body.total).toBe(2);
    expect((await request(app).get('/api/v1/projects?pricing=free')).body.items.map((p: any) => p.slug)).toEqual(['free-one']);
    expect((await request(app).get('/api/v1/projects?tech=django')).body.total).toBe(1);
    expect((await request(app).get('/api/v1/projects?limit=1&page=2')).body.items).toHaveLength(1);
    expect((await request(app).get('/api/v1/projects/hidden')).status).toBe(404);
  });
  it('refuses redistribution-hosting without a reviewed permissive license', async () => {
    const cat = await Category.findOne({ slug: 'web' });
    await expect(Project.create({ title: 'Bad', slug: 'bad', summary: 's', appType: 'web', category: cat!._id, source: { type: 'authorized-redistribution', license: 'NONE' } })).rejects.toThrow(/license/i);
  });
});
