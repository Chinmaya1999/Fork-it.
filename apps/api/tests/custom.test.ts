import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import argon2 from 'argon2';
import { createApp } from '../src/app.js';
import { splitPayments, nextStatus } from '../src/services/customRules.js';
import { User } from '../src/models/User.js';
import { CustomRequest } from '../src/models/CustomRequest.js';
import { Milestone } from '../src/models/Milestone.js';
import { Order } from '../src/models/Order.js';
import { Payment } from '../src/models/Payment.js';
import { ProjectFile } from '../src/models/ProjectFile.js';
import { Notification } from '../src/models/Notification.js';
import { saveBuffer } from '../src/services/storage.js';

describe('money split (unit)', () => {
  it('advance + final always equals total, including odd paise', () => {
    expect(splitPayments(100000, 30)).toEqual({ advancePaise: 30000, finalPaise: 70000 });
    for (const [t, p] of [[33333, 50], [99999, 33], [101, 1], [5, 100]] as const) { const s = splitPayments(t, p); expect(s.advancePaise + s.finalPaise).toBe(t); expect(Number.isInteger(s.advancePaise)).toBe(true); }
    expect(() => splitPayments(0, 30)).toThrow(); expect(() => splitPayments(1000, 0)).toThrow(); expect(() => splitPayments(10.5, 30)).toThrow();
  });
});
describe('status machine (unit)', () => {
  it('allows the documented path and rejects shortcuts', () => {
    expect(nextStatus('start_review', 'submitted', 'staff')).toBe('under_review');
    expect(nextStatus('start_review', 'submitted', 'student')).toBeNull();            // wrong actor
    expect(nextStatus('accept_quotation', 'under_review', 'student')).toBeNull();      // must be quoted first
    expect(nextStatus('accept_quotation', 'quoted', 'staff')).toBeNull();              // staff cannot accept for the student
    expect(nextStatus('advance_paid', 'quoted', 'system')).toBeNull();                 // cannot skip awaiting_advance
    expect(nextStatus('advance_paid', 'awaiting_advance', 'student')).toBeNull();      // clients can never mark a payment done
    expect(nextStatus('final_paid', 'awaiting_final_payment', 'system')).toBe('delivered');
    expect(nextStatus('cancel', 'delivered', 'staff')).toBeNull(); expect(nextStatus('cancel', 'completed', 'student')).toBeNull();
    expect(nextStatus('resolve_dispute', 'disputed', 'staff', 'student_review')).toBe('student_review');
  });
});

const app = createApp(); const H = { 'x-requested-with': 'projectforge' }; const pw = 'correct-horse-battery-9';
const stu = request.agent(app), other = request.agent(app), admin = request.agent(app); let rid: string; const BYTES = Buffer.from('PK\x03\x04 final deliverable');
const A = (p: string) => `/api/v1/admin/custom-requests${p}`; const S = (p: string) => `/api/v1/custom-requests${p}`;
const quote = (o: object = {}) => ({ totalPaise: 1000000, advancePercent: 30, deliveryDays: 30, scope: 'Build a complete inventory app with auth and reports', deliverables: ['Source code', 'Database file', 'Documentation'], milestones: [{ title: 'Design', dueInDays: 5 }, { title: 'Backend', dueInDays: 15 }, { title: 'Frontend', dueInDays: 25 }], revisionLimit: 2, supportDays: 30, finalPaymentCondition: 'Due after you approve the delivery', ...o });
const payMock = async (orderId: string) => (await stu.post(`/api/v1/orders/${orderId}/mock-pay`).set(H).send({ outcome: 'success' })).body.order;

beforeAll(async () => {
  await Promise.all([Order.init(), Payment.init(), Notification.init(), CustomRequest.init(), User.init()]);
  const passwordHash = await argon2.hash(pw);
  await User.create([{ name: 'Stu', email: 's@c.dev', passwordHash, emailVerified: true }, { name: 'Oth', email: 'o@c.dev', passwordHash, emailVerified: true }, { name: 'Admin', email: 'ad@c.dev', passwordHash, role: 'admin', emailVerified: true }]);
  for (const [a, e] of [[stu, 's'], [other, 'o'], [admin, 'ad']] as const) await a.post('/api/v1/auth/login').set(H).send({ email: `${e}@c.dev`, password: pw });
});

describe('custom project journey', () => {
  it('validates the request form', async () => {
    expect((await stu.post(S('')).set(H).send({ title: 'Hi', idea: 'short' })).status).toBe(400);
    expect((await stu.post(S('')).set(H).send({ title: 'Inventory app', idea: 'A full inventory management system for a small shop', deadline: '2020-01-01' })).status).toBe(400);
    const r = await stu.post(S('')).set(H).send({ title: 'Inventory app', idea: 'A full inventory management system for a small shop', appType: 'web', preferredTech: ['MERN'], features: ['Login', 'Stock reports'], budgetRange: '10-15k' });
    expect(r.status).toBe(201); expect(r.body.request.status).toBe('submitted'); rid = r.body.request._id; expect(r.body.request.ref).toMatch(/^CR-\d{6}$/);
  });
  it('is private and staff-controlled', async () => {
    expect((await other.get(S(`/${rid}`))).status).toBe(404); expect((await stu.get(A(''))).status).toBe(403);
    expect((await stu.post(A(`/${rid}/actions`)).set(H).send({ action: 'start_review' })).status).toBe(403);
    expect((await stu.post(S(`/${rid}/actions`)).set(H).send({ action: 'approve_delivery' })).status).toBe(409); // not in review stage
  });
  it('staff review, then quote; a revised quotation supersedes the old one; only the latest can be accepted', async () => {
    expect((await admin.post(A(`/${rid}/actions`)).set(H).send({ action: 'start_review' })).body.request.status).toBe('under_review');
    expect((await admin.post(A(`/${rid}/quotations`)).set(H).send(quote({ advancePercent: 0 }))).status).toBe(400);
    const v1 = (await admin.post(A(`/${rid}/quotations`)).set(H).send(quote())).body.quotation; expect(v1.advancePaise).toBe(300000); expect(v1.finalPaise).toBe(700000);
    const v2 = (await admin.post(A(`/${rid}/quotations`)).set(H).send(quote({ totalPaise: 900000, advancePercent: 40 }))).body.quotation; expect(v2.version).toBe(2); expect(v2.advancePaise).toBe(360000);
    const seen = (await stu.get(S(`/${rid}`))).body; expect(seen.quotations.map((q: any) => q.status)).toEqual(['sent', 'superseded']);
    expect((await stu.post(S(`/${rid}/quotations/${v1._id}/accept`)).set(H)).status).toBe(400); // stale version
    expect((await other.post(S(`/${rid}/quotations/${v2._id}/accept`)).set(H)).status).toBe(404);
    const acc = await stu.post(S(`/${rid}/quotations/${v2._id}/accept`)).set(H); expect(acc.body.request.status).toBe('awaiting_advance'); expect(acc.body.request.agreed.advancePaise).toBe(360000);
    expect((await stu.post(S(`/${rid}/quotations/${v2._id}/accept`)).set(H)).status).toBe(409); // cannot accept twice
    expect((await admin.post(A(`/${rid}/quotations`)).set(H).send(quote({ totalPaise: 1 * 100 }))).status).toBe(409); // terms are frozen once accepted
  });
  it('advance: amount is server-derived; wrong stage refused; verified payment starts development and creates milestones', async () => {
    expect((await stu.post(S(`/${rid}/pay`)).set(H).send({ stage: 'final' })).status).toBe(409);
    const pay = await stu.post(S(`/${rid}/pay`)).set(H).send({ stage: 'advance', amountPaise: 1 }); expect(pay.status).toBe(201); expect(pay.body.order.amountPaise).toBe(360000);
    expect((await CustomRequest.findById(rid))!.status).toBe('awaiting_advance'); // creating a checkout changes nothing
    expect((await payMock(pay.body.order.id)).status).toBe('paid');
    const st = (await stu.get(S(`/${rid}`))).body; expect(st.request.status).toBe('in_development'); expect(st.milestones.map((m: any) => m.title)).toEqual(['Design', 'Backend', 'Frontend']);
    await payMock(pay.body.order.id); expect(await Milestone.countDocuments({ request: rid })).toBe(3); // replay creates nothing new
    const adm = (await admin.get(A(`/${rid}`))).body; expect(adm.advancePaid).toBe(true); expect(adm.outstandingPaise).toBe(540000);
  });
  it('milestones: staff update and the student is notified; the student can comment', async () => {
    const m = (await stu.get(S(`/${rid}`))).body.milestones[0];
    expect((await admin.patch(A(`/${rid}/milestones/${m._id}`)).set(H).send({ status: 'completed', progressNotes: 'Figma done' })).body.milestone.completedAt).toBeTruthy();
    expect(await Notification.countDocuments({ type: 'milestone' })).toBe(1);
    expect((await stu.post(S(`/${rid}/milestones/${m._id}/comments`)).set(H).send({ body: 'Looks great' })).status).toBe(201); expect((await other.post(S(`/${rid}/milestones/${m._id}/comments`)).set(H).send({ body: 'x' })).status).toBe(404);
  });
  it('cannot jump ahead: final payment needs review, deliverables and approval', async () => {
    expect((await admin.post(A(`/${rid}/actions`)).set(H).send({ action: 'request_final_payment' })).status).toBe(409); // still in development
    await admin.post(A(`/${rid}/actions`)).set(H).send({ action: 'start_testing' }); await admin.post(A(`/${rid}/actions`)).set(H).send({ action: 'send_to_review' });
    expect((await admin.post(A(`/${rid}/actions`)).set(H).send({ action: 'request_final_payment' })).status).toBe(400); // no deliverables uploaded
    const saved = await saveBuffer(BYTES); const f = await ProjectFile.create({ customRequest: rid, label: 'Final source', originalName: 'final.zip', storageKey: saved.key, sizeBytes: saved.sizeBytes, sha256: saved.sha256 });
    expect((await admin.post(A(`/${rid}/actions`)).set(H).send({ action: 'request_final_payment' })).status).toBe(400); // student has not approved
    expect((await stu.get(S(`/${rid}`))).body.files).toEqual([]); expect((await stu.get(S(`/${rid}`))).body.lockedCount).toBe(1); expect((await stu.post(`/api/v1/files/${f._id}/link`).set(H)).status).toBe(403);
  });
  it('revision requests are limited by the agreed terms', async () => {
    expect((await stu.post(S(`/${rid}/actions`)).set(H).send({ action: 'request_revision' })).status).toBe(400); // needs a description
    for (let i = 1; i <= 2; i++) { await stu.post(S(`/${rid}/actions`)).set(H).send({ action: 'request_revision', note: `Change #${i}` }); await admin.post(A(`/${rid}/actions`)).set(H).send({ action: 'back_to_dev' }); await admin.post(A(`/${rid}/actions`)).set(H).send({ action: 'send_to_review' }); }
    expect((await CustomRequest.findById(rid))!.revisionsUsed).toBe(2);
    expect((await stu.post(S(`/${rid}/actions`)).set(H).send({ action: 'request_revision', note: 'One more' })).body.error.code).toBe('revision_limit');
  });
  it('after approval, the final payment unlocks deliverables only once verified', async () => {
    expect((await stu.post(S(`/${rid}/actions`)).set(H).send({ action: 'approve_delivery' })).status).toBe(200);
    expect((await admin.post(A(`/${rid}/actions`)).set(H).send({ action: 'request_final_payment' })).body.request.status).toBe('awaiting_final_payment');
    const pay = await stu.post(S(`/${rid}/pay`)).set(H).send({ stage: 'final' }); expect(pay.body.order.amountPaise).toBe(540000);
    expect((await stu.get(S(`/${rid}`))).body.files).toEqual([]); // creating a checkout is not payment
    expect((await payMock(pay.body.order.id)).status).toBe('paid');
    const d = (await stu.get(S(`/${rid}`))).body; expect(d.request.status).toBe('delivered'); expect(d.files).toHaveLength(1);
    const link = (await stu.post(`/api/v1/files/${d.files[0]._id}/link`).set(H)).body.url;
    const dl = await stu.get(link).buffer(true).parse((res, cb) => { const c: Buffer[] = []; res.on('data', (x: Buffer) => c.push(x)); res.on('end', () => cb(null, Buffer.concat(c))); }); expect((dl.body as Buffer).equals(BYTES)).toBe(true);
    expect((await other.get(link)).status).toBe(403); expect((await admin.get(A(`/${rid}`))).body.outstandingPaise).toBe(0);
  });
  it('a refunded final payment locks the deliverables again and opens a dispute', async () => {
    const fin = await Order.findOne({ customRequest: rid, type: 'custom_final' }); const fileId = (await ProjectFile.findOne({ customRequest: rid }))!._id;
    expect((await admin.post(`/api/v1/admin/orders/${fin!._id}/refund`).set(H).send({ reason: 'Quality dispute' })).status).toBe(200);
    expect((await CustomRequest.findById(rid))!.status).toBe('disputed'); expect((await stu.post(`/api/v1/files/${fileId}/link`).set(H)).status).toBe(403);
    expect((await admin.post(A(`/${rid}/actions`)).set(H).send({ action: 'resolve_dispute', to: 'student_review', note: 'Reworking' })).body.request.status).toBe('student_review');
  });
});
