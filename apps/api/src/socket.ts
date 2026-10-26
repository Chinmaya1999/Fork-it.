import type { Server as HttpServer } from 'node:http';
import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';
import { env } from './config/env.js';
import { COOKIE } from './middleware/auth.js';
import { User } from './models/User.js';
import { setIO } from './services/realtime.js';
import { isStaff, loadConversation, markRead, sendMessage, type Actor } from './modules/messages/messageService.js';
import { logger } from './utils/logger.js';

const parseCookies = (h?: string) => Object.fromEntries((h ?? '').split(';').map((p) => p.trim().split('=')).filter((p) => p.length >= 2).map(([k, ...v]) => [k, decodeURIComponent(v.join('='))]));

export function initSocket(server: HttpServer) {
  const io = new Server(server, { cors: { origin: [env.CLIENT_URL], credentials: true }, maxHttpBufferSize: 10_000 });
  setIO(io);
  io.use(async (socket, next) => { // authenticate the connection with the same session cookie as REST
    try {
      const token = parseCookies(socket.handshake.headers.cookie)[COOKIE]; if (!token) return next(new Error('unauthorized'));
      const p = jwt.verify(token, env.JWT_SECRET) as { sub: string; v: number }; const u = await User.findById(p.sub);
      if (!u || u.status !== 'active' || u.tokenVersion !== p.v) return next(new Error('unauthorized'));
      socket.data.actor = { id: u.id, role: u.role, name: u.name } satisfies Actor; next();
    } catch { next(new Error('unauthorized')); }
  });
  io.on('connection', (socket) => {
    const a = socket.data.actor as Actor; socket.join(`user:${a.id}`); if (isStaff(a)) socket.join('staff');
    const sent: number[] = []; const allow = () => { const now = Date.now(); while (sent.length && now - sent[0] > 10_000) sent.shift(); if (sent.length >= 20) return false; sent.push(now); return true; }; // 20 events / 10s / socket
    const guard = (fn: (data: any, ack: (r: unknown) => void) => Promise<void>) => async (data: any, ack?: (r: unknown) => void) => {
      const reply = typeof ack === 'function' ? ack : () => undefined;
      if (!allow()) return reply({ ok: false, error: 'rate_limited' });
      try { await fn(data ?? {}, reply); } catch (e: any) { reply({ ok: false, error: e?.status === 403 ? 'forbidden' : e?.status === 404 ? 'not_found' : e?.message ?? 'error' }); if (!e?.status) logger.error({ err: e }, 'socket handler error'); }
    };
    socket.on('conversation:join', guard(async ({ conversationId }, reply) => { const c = await loadConversation(a, String(conversationId)); await socket.join(`conv:${c._id}`); reply({ ok: true }); })); // joined only after a DB authorization check
    socket.on('conversation:leave', guard(async ({ conversationId }, reply) => { await socket.leave(`conv:${conversationId}`); reply({ ok: true }); }));
    socket.on('message:send', guard(async ({ conversationId, body }, reply) => { reply({ ok: true, message: await sendMessage(a, String(conversationId), body) }); }));
    socket.on('conversation:read', guard(async ({ conversationId }, reply) => { reply(await markRead(a, String(conversationId))); }));
    socket.on('typing', guard(async ({ conversationId }, reply) => { if (socket.rooms.has(`conv:${conversationId}`)) socket.to(`conv:${conversationId}`).emit('typing', { conversationId, name: a.name, role: isStaff(a) ? 'staff' : 'student' }); reply({ ok: true }); }));
  });
  return io;
}
