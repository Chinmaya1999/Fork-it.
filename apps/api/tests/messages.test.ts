import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import argon2 from 'argon2';
import http from 'node:http';
import { io as ioc, type Socket } from 'socket.io-client';
import { createApp } from '../src/app.js';
import { initSocket } from '../src/socket.js';
import { User } from '../src/models/User.js';
import { Conversation, Message } from '../src/models/Conversation.js';
import { Notification } from '../src/models/Notification.js';
import { CustomRequest } from '../src/models/CustomRequest.js';

const app = createApp(); const H = { 'x-requested-with': 'projectforge' }; const pw = 'correct-horse-battery-9';
const stu = request.agent(app), other = request.agent(app), admin = request.agent(app); let server: http.Server; let port: number;
let stuConv: string, otherConv: string; const sockets: Socket[] = [];

const cookieOf = async (agent: request.Agent, email: string) => { const r = await request(app).post('/api/v1/auth/login').set(H).send({ email, password: pw }); return (r.headers['set-cookie'] as unknown as string[]).map((c) => c.split(';')[0]).join('; '); };
const connect = (cookie?: string) => new Promise<Socket>((resolve, reject) => { const s = ioc(`http://127.0.0.1:${port}`, { extraHeaders: cookie ? { cookie } : {}, transports: ['websocket'], reconnection: false }); sockets.push(s); s.on('connect', () => resolve(s)); s.on('connect_error', (e) => reject(e)); });
const emit = <T = any>(s: Socket, ev: string, data: unknown) => new Promise<T>((resolve) => s.emit(ev, data, resolve));
const once = <T = any>(s: Socket, ev: string) => new Promise<T>((resolve) => s.once(ev, resolve));

beforeAll(async () => {
  await Promise.all([Conversation.init(), Notification.init(), User.init()]);
  server = http.createServer(app); initSocket(server); await new Promise<void>((r) => server.listen(0, '127.0.0.1', r)); port = (server.address() as any).port;
  const passwordHash = await argon2.hash(pw);
  await User.create([{ name: 'Stu', email: 's@m.dev', passwordHash, emailVerified: true }, { name: 'Oth', email: 'o@m.dev', passwordHash, emailVerified: true }, { name: 'Admin', email: 'ad@m.dev', passwordHash, role: 'admin', emailVerified: true }]);
  for (const [a, e] of [[stu, 's'], [other, 'o'], [admin, 'ad']] as const) await a.post('/api/v1/auth/login').set(H).send({ email: `${e}@m.dev`, password: pw });
  stuConv = String((await stu.get('/api/v1/conversations')).body.items[0]._id); otherConv = String((await other.get('/api/v1/conversations')).body.items[0]._id);
});
afterAll(async () => { sockets.forEach((s) => s.close()); await new Promise((r) => server.close(r)); });

describe('REST authorization', () => {
  it('each student gets exactly one private general thread; lists are isolated', async () => {
    expect((await stu.get('/api/v1/conversations')).body.items).toHaveLength(1); expect(stuConv).not.toBe(otherConv);
    expect((await other.get(`/api/v1/conversations/${stuConv}/messages`)).status).toBe(403);
    expect((await other.post(`/api/v1/conversations/${stuConv}/messages`).set(H).send({ body: 'snoop' })).status).toBe(403);
    expect((await request(app).get('/api/v1/conversations')).status).toBe(401); expect((await stu.get('/api/v1/staff/conversations')).status).toBe(403);
  });
  it('persists messages, trims, enforces length, and tracks unread counts + read state', async () => {
    expect((await stu.post(`/api/v1/conversations/${stuConv}/messages`).set(H).send({ body: '   ' })).status).toBeGreaterThanOrEqual(400);
    expect((await stu.post(`/api/v1/conversations/${stuConv}/messages`).set(H).send({ body: 'x'.repeat(2001) })).status).toBeGreaterThanOrEqual(400);
    expect((await stu.post(`/api/v1/conversations/${stuConv}/messages`).set(H).send({ body: ' Hello team ' })).status).toBe(201);
    expect((await Conversation.findById(stuConv))!.unreadForStaff).toBe(1); expect((await admin.get('/api/v1/staff/conversations?unread=1')).body.items).toHaveLength(1);
    expect((await admin.get(`/api/v1/conversations/${stuConv}/messages`)).body.items[0].body).toBe('Hello team'); // staff can read any thread
    await admin.post(`/api/v1/conversations/${stuConv}/messages`).set(H).send({ body: 'Hi! How can we help?' });
    expect((await Conversation.findById(stuConv))!.unreadForUser).toBe(1);
    await stu.post(`/api/v1/conversations/${stuConv}/read`).set(H); expect((await Conversation.findById(stuConv))!.unreadForUser).toBe(0);
    await admin.post(`/api/v1/conversations/${stuConv}/read`).set(H); expect((await Conversation.findById(stuConv))!.unreadForStaff).toBe(0);
  });
  it('sends one notification per unread burst, not one per message', async () => {
    const before = await Notification.countDocuments({ type: 'new_message' });
    for (let i = 0; i < 4; i++) await admin.post(`/api/v1/conversations/${stuConv}/messages`).set(H).send({ body: `burst ${i}` });
    expect(await Notification.countDocuments({ type: 'new_message' })).toBe(before + 1);
  });
  it('custom-request threads can only be opened by the request owner', async () => {
    const r = await CustomRequest.create({ ref: 'CR-9', user: (await User.findOne({ email: 's@m.dev' }))!._id, title: 'Thread test', idea: 'x'.repeat(25) });
    expect((await other.post(`/api/v1/conversations/custom/${r._id}`).set(H)).status).toBe(404); expect((await stu.post(`/api/v1/conversations/custom/${r._id}`).set(H)).body.conversation.kind).toBe('custom');
  });
});

describe('Socket.IO', () => {
  it('rejects unauthenticated and forged connections', async () => {
    await expect(connect()).rejects.toThrow(/unauthorized/); await expect(connect('pf_session=not-a-jwt')).rejects.toThrow(/unauthorized/);
  });
  it('lets a participant join, and refuses rooms the user is not part of (client room ids are not trusted)', async () => {
    const s = await connect(await cookieOf(stu, 's@m.dev'));
    expect((await emit(s, 'conversation:join', { conversationId: stuConv })).ok).toBe(true);
    expect(await emit(s, 'conversation:join', { conversationId: otherConv })).toMatchObject({ ok: false, error: 'forbidden' });
    expect(await emit(s, 'message:send', { conversationId: otherConv, body: 'hack' })).toMatchObject({ ok: false, error: 'forbidden' });
    expect(await Message.countDocuments({ conversation: otherConv })).toBe(0);
  });
  it('delivers messages in real time to the other participant only, and relays typing', async () => {
    const s = await connect(await cookieOf(stu, 's@m.dev')); const a = await connect(await cookieOf(admin, 'ad@m.dev')); const o = await connect(await cookieOf(other, 'o@m.dev'));
    await emit(s, 'conversation:join', { conversationId: stuConv }); await emit(a, 'conversation:join', { conversationId: stuConv }); await emit(o, 'conversation:join', { conversationId: otherConv });
    let leaked = false; o.on('message:new', () => { leaked = true; });
    const got = once(a, 'message:new'); const sent = await emit(s, 'message:send', { conversationId: stuConv, body: 'live message' }); expect(sent.ok).toBe(true);
    expect((await got).body).toBe('live message'); const typing = once(s, 'typing'); a.emit('typing', { conversationId: stuConv }); expect((await typing).role).toBe('staff');
    await new Promise((r) => setTimeout(r, 150)); expect(leaked).toBe(false); expect(await Message.countDocuments({ conversation: stuConv, body: 'live message' })).toBe(1);
  });
  it('rate-limits message floods per socket', async () => {
    const s = await connect(await cookieOf(stu, 's@m.dev')); await emit(s, 'conversation:join', { conversationId: stuConv });
    const results = await Promise.all(Array.from({ length: 30 }, (_, i) => emit(s, 'message:send', { conversationId: stuConv, body: `flood ${i}` })));
    expect(results.some((r) => r.error === 'rate_limited')).toBe(true);
  });
  it('a suspended user cannot connect', async () => {
    const cookie = await cookieOf(other, 'o@m.dev'); await User.updateOne({ email: 'o@m.dev' }, { status: 'suspended' }); await expect(connect(cookie)).rejects.toThrow(/unauthorized/);
  });
});
