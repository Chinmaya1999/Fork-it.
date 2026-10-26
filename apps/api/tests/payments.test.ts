import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import argon2 from 'argon2';
import crypto from 'node:crypto';
import { createApp } from '../src/app.js';
import { User } from '../src/models/User.js';
import { Category } from '../src/models/Category.js';
import { Project } from '../src/models/Project.js';
import { ProjectFile } from '../src/models/ProjectFile.js';
import { Order } from '../src/models/Order.js';
import { Payment } from '../src/models/Payment.js';
import { DownloadAudit } from '../src/models/DownloadAudit.js';
import { Notification } from '../src/models/Notification.js';
import { saveBuffer } from '../src/services/storage.js';

const app = createApp(); const H = { 'x-requested-with': 'projectforge' }; const pw = 'correct-horse-battery-9';
const admin = request.agent(app), stu = request.agent(app), other = request.agent(app), unverified = request.agent(app);
let projectId: string, emptyProjectId: string, fileId: string; const CONTENT = Buffer.from('PK\x03\x04 fake zip bytes for test');

beforeAll(async () => {
  await Promise.all([Order.init(), Payment.init(), Notification.init(), ProjectFile.init(), DownloadAudit.init(), User.init()]); // wait for unique/partial indexes so tests are deterministic
  const passwordHash = await argon2.hash(pw);
  await User.create([
    { name: 'Admin', email: 'admin@pay.dev', passwordHash, role: 'admin', emailVerified: true },
    { name: 'Stu', email: 'stu@pay.dev', passwordHash, emailVerified: true }, { name: 'Other', email: 'other@pay.dev', passwordHash, emailVerified: true }, { name: 'Unv', email: 'unv@pay.dev', passwordHash },
  ]);
  for (const [a, e] of [[admin, 'admin'], [stu, 'stu'], [other, 'other'], [unverified, 'unv']] as const) await a.post('/api/v1/auth/login').set(H).send({ email: `${e}@pay.dev`, password: pw });
  const cat = await Category.create({ name: 'Web', slug: 'web' }); const base = { category: cat._id, appType: 'web' as const, status: 'published' as const };
  const p = await Project.create({ ...base, title: 'Paid Project', slug: 'paid-project', summary: 's', pricePaise: 14900, setupGuide: '# Private setup guide\n1. run it' });
  projectId = String(p._id);
  const saved = await saveBuffer(CONTENT);
  fileId = String((await ProjectFile.create({ project: p._id, label: 'Source ZIP', originalName: 'paid-project.zip', storageKey: saved.key, sizeBytes: saved.sizeBytes, sha256: saved.sha256 }))._id);
  emptyProjectId = String((await Project.create({ ...base, title: 'No Deliverable', slug: 'no-deliverable', summary: 's', pricePaise: 9900 }))._id);
});

describe('checkout rules', () => {
  it('blocks unverified emails and projects with nothing to deliver', async () => {
    expect((await unverified.post('/api/v1/orders').set(H).send({ projectId })).body.error.code).toBe('email_unverified');
    expect((await stu.post('/api/v1/orders').set(H).send({ projectId: emptyProjectId })).status).toBe(400);
  });
  it('requires login and uses the server price, ignoring any amount sent by the browser', async () => {
    expect((await request(app).post('/api/v1/orders').set(H).send({ projectId })).status).toBe(401);
    const r = await stu.post('/api/v1/orders').set(H).send({ projectId, amountPaise: 1, pricePaise: 1 });
    expect(r.status).toBe(201); expect(r.body.order.amountPaise).toBe(14900); expect(r.body.checkout.provider).toBe('mock');
  });
  it('reuses the open order instead of creating duplicates', async () => {
    await stu.post('/api/v1/orders').set(H).send({ projectId }); expect(await Order.countDocuments({ user: (await User.findOne({ email: 'stu@pay.dev' }))!._id, status: 'created' })).toBe(1);
  });
});

describe('payment verification & access', () => {
  let orderId: string, link: string;
  it('unpaid order grants nothing', async () => {
    orderId = (await stu.get('/api/v1/orders')).body.items[0].id;
    const d = (await stu.get(`/api/v1/orders/${orderId}`)).body; expect(d.files).toEqual([]); expect(d.guide).toBe('');
    expect((await stu.post(`/api/v1/files/${fileId}/link`).set(H)).status).toBe(403);
  });
  it('a forged signature is rejected, the order stays unpaid and can be retried', async () => {
    const r = await stu.post(`/api/v1/orders/${orderId}/verify`).set(H).send({ paymentId: 'mock_pay_forged123', signature: 'deadbeef'.repeat(8) });
    expect(r.status).toBe(400); expect((await Order.findById(orderId))!.status).toBe('failed'); expect((await stu.post(`/api/v1/files/${fileId}/link`).set(H)).status).toBe(403);
  });
  it('a simulated failed payment does not unlock anything', async () => {
    await stu.post(`/api/v1/orders/${orderId}/mock-pay`).set(H).send({ outcome: 'failure' }); expect((await Order.findById(orderId))!.status).not.toBe('paid');
  });
  it('a verified payment marks the order paid once, issues a receipt and notifies', async () => {
    const r = await stu.post(`/api/v1/orders/${orderId}/mock-pay`).set(H).send({ outcome: 'success' });
    expect(r.body.order.status).toBe('paid'); expect(r.body.order.receiptNo).toMatch(/^PF-R-\d{4}-\d{6}$/);
    expect(await Notification.countDocuments({ type: 'payment_success' })).toBe(1);
    const again = await stu.post(`/api/v1/orders/${orderId}/mock-pay`).set(H).send({ outcome: 'success' }); // replay
    expect(again.body.order.status).toBe('paid'); expect(await Payment.countDocuments({ order: orderId, status: 'captured' })).toBe(1); expect(await Notification.countDocuments({ type: 'payment_success' })).toBe(1);
    expect((await stu.post('/api/v1/orders').set(H).send({ projectId })).status).toBe(409); // already owned
  });
  it('paid owner sees files + private guide and can download exact bytes via a short-lived link', async () => {
    const d = (await stu.get(`/api/v1/orders/${orderId}`)).body; expect(d.guide).toContain('Private setup guide'); expect(d.files[0].storageKey).toBeUndefined();
    link = (await stu.post(`/api/v1/files/${fileId}/link`).set(H)).body.url; expect(link).toMatch(/^\/api\/v1\/downloads\//);
    const dl = await stu.get(link).buffer(true).parse((res, cb) => { const c: Buffer[] = []; res.on('data', (x: Buffer) => c.push(x)); res.on('end', () => cb(null, Buffer.concat(c))); });
    expect(dl.status).toBe(200); expect((dl.body as Buffer).equals(CONTENT)).toBe(true); expect(dl.headers['content-disposition']).toMatch(/attachment; filename="paid-project.zip"/);
    expect(await DownloadAudit.countDocuments({ file: fileId })).toBe(1);
  });
  it('other users cannot read the order, request links, or use someone else\'s link', async () => {
    expect((await other.get(`/api/v1/orders/${orderId}`)).status).toBe(404);
    expect((await other.post(`/api/v1/files/${fileId}/link`).set(H)).status).toBe(403);
    expect((await other.get(link)).status).toBe(403);
    expect((await request(app).get(link)).status).toBe(401);
    expect((await stu.get('/api/v1/downloads/not-a-real-token')).status).toBe(401);
  });
  it('enforces the per-file download limit', async () => {
    const uid = (await User.findOne({ email: 'stu@pay.dev' }))!._id; await DownloadAudit.insertMany(Array.from({ length: 10 }, () => ({ user: uid, order: orderId, file: fileId })));
    expect((await stu.post(`/api/v1/files/${fileId}/link`).set(H)).status).toBe(429);
    await DownloadAudit.deleteMany({ file: fileId });
  });
  it('students cannot refund; an admin refund revokes access, even for already-issued links', async () => {
    expect((await stu.post(`/api/v1/admin/orders/${orderId}/refund`).set(H).send({ reason: 'pls' })).status).toBe(403);
    const r = await admin.post(`/api/v1/admin/orders/${orderId}/refund`).set(H).send({ reason: 'Customer request' }); expect(r.status).toBe(200); expect(r.body.order.status).toBe('refunded');
    expect((await stu.get(link)).status).toBe(403); expect((await stu.post(`/api/v1/files/${fileId}/link`).set(H)).status).toBe(403);
    expect((await admin.post(`/api/v1/admin/orders/${orderId}/refund`).set(H).send({ reason: 'again' })).status).toBe(400);
  });
});

describe('Razorpay webhook', () => {
  const sign = (body: string) => crypto.createHmac('sha256', 'whsec_test_secret').update(body).digest('hex');
  const post = (body: object, eventId: string, badSig = false) => { const raw = JSON.stringify(body); return request(app).post('/api/v1/webhooks/razorpay').set('content-type', 'application/json').set('x-razorpay-event-id', eventId).set('x-razorpay-signature', badSig ? 'bad' : sign(raw)).send(raw); };
  let o: any;
  beforeAll(async () => { const r = await other.post('/api/v1/orders').set(H).send({ projectId }); o = r.body; });
  it('rejects bad signatures', async () => { expect((await post({ event: 'payment.captured' }, 'e0', true)).status).toBe(400); });
  it('ignores a payload whose amount does not match the order', async () => {
    const r = await post({ event: 'payment.captured', payload: { payment: { entity: { id: 'pay_wrong1', order_id: o.checkout.gatewayOrderId, amount: 100 } } } }, 'e-bad-amount');
    expect(r.body.ignored).toBe(true); expect((await Order.findById(o.order.id))!.status).not.toBe('paid');
  });
  it('fulfils a valid event once; a duplicate delivery changes nothing', async () => {
    const ev = { event: 'payment.captured', payload: { payment: { entity: { id: 'pay_ok_1', order_id: o.checkout.gatewayOrderId, amount: 14900 } } } };
    const r1 = await post(ev, 'e1'); expect(r1.body, JSON.stringify(r1.body)).toMatchObject({ ok: true }); expect((await Order.findById(o.order.id))!.status).toBe('paid');
    expect((await post(ev, 'e1')).body.duplicate).toBe(true);
    expect((await post(ev, 'e2')).body.ok).toBe(true); // a different event id for the same payment must also be idempotent
    expect(await Payment.countDocuments({ gatewayPaymentId: 'pay_ok_1' })).toBe(1); expect(await Notification.countDocuments({ dedupeKey: `paid:${o.order.id}` })).toBe(1);
  });
});

describe('payment hardening', () => {
  const sign = (body: string) => crypto.createHmac('sha256', 'whsec_test_secret').update(body).digest('hex');
  const hook = (body: object, eventId: string) => { const raw = JSON.stringify(body); return request(app).post('/api/v1/webhooks/razorpay').set('content-type', 'application/json').set('x-razorpay-event-id', eventId).set('x-razorpay-signature', sign(raw)).send(raw); };

  it('the sandbox gateway is refused unless the client URL is localhost', async () => {
    const { sandboxAllowed } = await import('../src/services/gateway/index.js'); const { env } = await import('../src/config/env.js');
    expect(sandboxAllowed()).toBe(true);
    const old = env.CLIENT_URL; (env as any).CLIENT_URL = 'https://projects.example.com'; expect(sandboxAllowed()).toBe(false); (env as any).CLIENT_URL = old;
  });

  it('malformed ids return 404 instead of crashing with 500', async () => {
    expect((await stu.get('/api/v1/orders/not-an-id')).status).toBe(404);
    expect((await stu.post('/api/v1/orders/not-an-id/verify').set(H).send({ paymentId: 'pay_12345', signature: 'x'.repeat(20) })).status).toBe(404);
  });

  it('money paid against a cancelled order is still fulfilled once the gateway proves the exact amount', async () => {
    await User.create({ name: 'Late', email: 'late@pay.dev', passwordHash: await argon2.hash(pw), emailVerified: true });
    const r = request.agent(app); await r.post('/api/v1/auth/login').set(H).send({ email: 'late@pay.dev', password: pw });
    const created = (await r.post('/api/v1/orders').set(H).send({ projectId })).body;
    await Order.updateOne({ _id: created.order.id }, { status: 'cancelled' }); // e.g. price changed while the checkout window was open
    const res = await hook({ event: 'payment.captured', payload: { payment: { entity: { id: 'pay_late_1', order_id: created.checkout.gatewayOrderId, amount: 14900 } } } }, 'e-late-1');
    expect(res.body.ok).toBe(true); expect((await Order.findById(created.order.id))!.status).toBe('paid');
  });

  it('a refund cannot be applied twice concurrently and over-refunds are rejected', async () => {
    const o = await Order.findOne({ status: 'paid', refundedPaise: 0 }); expect(o).toBeTruthy();
    const [a, b] = await Promise.all([1, 2].map(() => admin.post(`/api/v1/admin/orders/${o!._id}/refund`).set(H).send({ reason: 'double click', amountPaise: o!.amountPaise })));
    expect([a.status, b.status].filter((s) => s === 200)).toHaveLength(1);
    expect((await Order.findById(o!._id))!.refundedPaise).toBe(o!.amountPaise);
  });
});
