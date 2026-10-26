import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import argon2 from 'argon2';
import { createApp } from '../src/app.js';
import { User } from '../src/models/User.js';
import { Order } from '../src/models/Order.js';
import { Ticket } from '../src/models/Ticket.js';
import { Notification } from '../src/models/Notification.js';

const app = createApp(); const H = { 'x-requested-with': 'projectforge' }; const pw = 'correct-horse-battery-9';
const stu = request.agent(app), other = request.agent(app), agent = request.agent(app), admin = request.agent(app);
let ticketId: string, otherOrderId: string, agentId: string;

beforeAll(async () => {
  await Promise.all([Ticket.init(), Notification.init()]);
  const passwordHash = await argon2.hash(pw);
  const users = await User.create([{ name: 'Stu', email: 's@t.dev', passwordHash, emailVerified: true }, { name: 'Oth', email: 'o@t.dev', passwordHash, emailVerified: true }, { name: 'Agent', email: 'a@t.dev', passwordHash, role: 'support', emailVerified: true }, { name: 'Admin', email: 'ad@t.dev', passwordHash, role: 'admin', emailVerified: true }]);
  agentId = String(users[2]._id);
  for (const [a, e] of [[stu, 's'], [other, 'o'], [agent, 'a'], [admin, 'ad']] as const) await a.post('/api/v1/auth/login').set(H).send({ email: `${e}@t.dev`, password: pw });
  otherOrderId = String((await Order.create({ ref: 'PF-X1', type: 'project', user: users[1]._id, title: 'Other order', amountPaise: 100, gateway: 'mock' }))._id);
});

describe('student tickets', () => {
  it('validates input and refuses to link another user\'s order', async () => {
    expect((await stu.post('/api/v1/tickets').set(H).send({ subject: 'x', description: 'short' })).status).toBe(400);
    expect((await stu.post('/api/v1/tickets').set(H).send({ subject: 'Cannot install deps', description: 'npm install fails with ERESOLVE', orderId: otherOrderId })).status).toBe(400);
  });
  it('creates a ticket (priority cannot be chosen by the student) and notifies staff', async () => {
    const r = await stu.post('/api/v1/tickets').set(H).send({ subject: 'Cannot install deps', description: 'npm install fails with ERESOLVE', category: 'dependency', priority: 'urgent' });
    expect(r.status).toBe(201); expect(r.body.ticket.number).toMatch(/^TK-\d{6}$/); expect(r.body.ticket.priority).toBe('normal'); ticketId = r.body.ticket._id;
    expect(await Notification.countDocuments({ type: 'ticket_activity' })).toBeGreaterThanOrEqual(2); // admin + support agent
  });
  it('is private to its owner', async () => {
    expect((await other.get(`/api/v1/tickets/${ticketId}`)).status).toBe(404);
    expect((await other.post(`/api/v1/tickets/${ticketId}/replies`).set(H).send({ body: 'hi' })).status).toBe(404);
    expect((await other.get('/api/v1/tickets')).body.items).toHaveLength(0);
  });
});

describe('staff handling', () => {
  it('students cannot reach staff endpoints', async () => { expect((await stu.get('/api/v1/staff/tickets')).status).toBe(403); expect((await request(app).get('/api/v1/staff/tickets')).status).toBe(401); });
  it('support agents can list, filter and search', async () => {
    expect((await agent.get('/api/v1/staff/tickets?status=open&category=dependency&q=install')).body.total).toBe(1);
    expect((await agent.get('/api/v1/staff/tickets?assigned=none')).body.total).toBe(1);
  });
  it('internal notes are visible to staff but NEVER to the student', async () => {
    await agent.post(`/api/v1/staff/tickets/${ticketId}/replies`).set(H).send({ body: 'INTERNAL: probably the lockfile', internal: true });
    await agent.post(`/api/v1/staff/tickets/${ticketId}/replies`).set(H).send({ body: 'Try deleting node_modules and running npm install --legacy-peer-deps' });
    const staffView = (await agent.get(`/api/v1/staff/tickets/${ticketId}`)).body.replies.map((r: any) => r.body); expect(staffView.join('|')).toContain('INTERNAL');
    const studentView = (await stu.get(`/api/v1/tickets/${ticketId}`)).body; expect(JSON.stringify(studentView)).not.toContain('INTERNAL'); expect(studentView.replies.some((r: any) => /legacy-peer-deps/.test(r.body))).toBe(true);
    expect(studentView.ticket.assignedTo).toBeUndefined();
  });
  it('the student gets notifications for the public reply only', async () => {
    const n = (await stu.get('/api/v1/notifications')).body; expect(n.items.filter((i: any) => i.type === 'ticket_reply')).toHaveLength(1); expect(n.unreadCount).toBeGreaterThan(0);
    expect(JSON.stringify(n)).not.toContain('INTERNAL');
  });
  it('assignment must be an active staff member; resolving needs a resolution summary', async () => {
    expect((await agent.patch(`/api/v1/staff/tickets/${ticketId}`).set(H).send({ assignedTo: String((await User.findOne({ email: 's@t.dev' }))!._id) })).status).toBe(400);
    expect((await agent.patch(`/api/v1/staff/tickets/${ticketId}`).set(H).send({ assignedTo: agentId, priority: 'high' })).status).toBe(200);
    expect((await agent.patch(`/api/v1/staff/tickets/${ticketId}`).set(H).send({ status: 'resolved' })).status).toBe(400);
    expect((await agent.patch(`/api/v1/staff/tickets/${ticketId}`).set(H).send({ status: 'resolved', resolution: 'Used --legacy-peer-deps' })).status).toBe(200);
  });
});

describe('lifecycle & reopen policy', () => {
  it('a student reply on a resolved ticket reopens it; closing and reopening works inside the window', async () => {
    await stu.post(`/api/v1/tickets/${ticketId}/replies`).set(H).send({ body: 'Still failing on Windows' }); expect((await Ticket.findById(ticketId))!.status).toBe('open');
    await stu.post(`/api/v1/tickets/${ticketId}/close`).set(H); expect((await stu.post(`/api/v1/tickets/${ticketId}/replies`).set(H).send({ body: 'x' })).status).toBe(400);
    expect((await stu.post(`/api/v1/tickets/${ticketId}/reopen`).set(H)).status).toBe(200); expect((await Ticket.findById(ticketId))!.reopenCount).toBe(1);
  });
  it('cannot reopen after the policy window', async () => {
    await stu.post(`/api/v1/tickets/${ticketId}/close`).set(H); await Ticket.updateOne({ _id: ticketId }, { closedAt: new Date(Date.now() - 20 * 864e5) });
    expect((await stu.post(`/api/v1/tickets/${ticketId}/reopen`).set(H)).status).toBe(400);
  });
});

describe('notifications', () => {
  it('mark-as-read is scoped to the owner, and read-all clears the badge', async () => {
    const first = (await stu.get('/api/v1/notifications?unread=1')).body.items[0]; await other.post(`/api/v1/notifications/${first._id}/read`).set(H); expect((await Notification.findById(first._id))!.readAt).toBeFalsy();
    await stu.post(`/api/v1/notifications/${first._id}/read`).set(H); expect((await Notification.findById(first._id))!.readAt).toBeTruthy();
    await stu.post('/api/v1/notifications/read-all').set(H); expect((await stu.get('/api/v1/notifications/unread-count')).body.unreadCount).toBe(0);
  });
  it('requires authentication', async () => { expect((await request(app).get('/api/v1/notifications')).status).toBe(401); });
});
