import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { requireAuth, requireRole } from '../../middleware/auth.js';
import { wrap } from '../../utils/async.js';
import { Conversation, Message } from '../../models/Conversation.js';
import { env } from '../../config/env.js';
import { ensureCustom, ensureGeneral, loadConversation, markRead, sendMessage, type Actor } from './messageService.js';

export const messagesRouter = Router();
messagesRouter.use('/conversations', requireAuth);
const actor = (req: any): Actor => ({ id: req.user.id, role: req.user.role, name: req.user.name });
const sendLimit = rateLimit({ windowMs: 60_000, limit: env.NODE_ENV === 'test' ? 1000 : 30, keyGenerator: (req) => (req as any).user?.id ?? req.ip, standardHeaders: true, legacyHeaders: false });

messagesRouter.get('/conversations', wrap(async (req, res) => { await ensureGeneral(req.user!.id); res.json({ items: await Conversation.find({ user: req.user!.id }).sort({ lastMessageAt: -1 }).lean() }); }));
messagesRouter.post('/conversations/custom/:requestId', wrap(async (req, res) => { res.json({ conversation: await ensureCustom(req.user!.id, req.params.requestId) }); }));
messagesRouter.get('/conversations/:id', wrap(async (req, res) => { res.json({ conversation: await loadConversation(actor(req), req.params.id) }); }));
messagesRouter.get('/conversations/:id/messages', wrap(async (req, res) => {
  const c = await loadConversation(actor(req), req.params.id); const before = z.coerce.date().optional().parse(req.query.before); const limit = 50;
  const items = await Message.find({ conversation: c._id, ...(before && { createdAt: { $lt: before } }) }).sort({ createdAt: -1 }).limit(limit).populate('sender', 'name').lean();
  res.json({ items: items.reverse(), hasMore: items.length === limit, conversation: c });
}));
messagesRouter.post('/conversations/:id/messages', sendLimit, wrap(async (req, res) => { const { body } = z.object({ body: z.string() }).parse(req.body); res.status(201).json({ message: await sendMessage(actor(req), req.params.id, body) }); }));
messagesRouter.post('/conversations/:id/read', wrap(async (req, res) => { res.json(await markRead(actor(req), req.params.id)); }));

// Staff inbox (admin + support)
export const staffMessagesRouter = Router();
staffMessagesRouter.use(requireRole('admin', 'support'));
const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
staffMessagesRouter.get('/conversations', wrap(async (req, res) => {
  const q = z.object({ q: z.string().trim().max(60).optional(), unread: z.enum(['1']).optional(), page: z.coerce.number().int().min(1).default(1) }).parse(req.query); const limit = 30;
  const f: Record<string, unknown> = {}; if (q.unread) f.unreadForStaff = { $gt: 0 };
  let items = await Conversation.find(f).sort({ lastMessageAt: -1 }).skip((q.page - 1) * limit).limit(limit).populate('user', 'name email').lean();
  if (q.q) { const r = new RegExp(esc(q.q), 'i'); items = items.filter((c: any) => r.test(c.user?.name ?? '') || r.test(c.user?.email ?? '') || r.test(c.title ?? '')); }
  res.json({ items, unreadTotal: await Conversation.countDocuments({ unreadForStaff: { $gt: 0 } }) });
}));
staffMessagesRouter.post('/conversations/start/:userId', wrap(async (req, res) => { res.json({ conversation: await ensureGeneral(req.params.userId) }); }));
staffMessagesRouter.post('/conversations/custom/:requestId', wrap(async (req, res) => {
  const { CustomRequest } = await import('../../models/CustomRequest.js'); const r = await CustomRequest.findById(req.params.requestId).select('user'); if (!r) return res.status(404).json({ error: { code: 'not_found', message: 'Request not found' } });
  res.json({ conversation: await ensureCustom(String(r.user), req.params.requestId) });
}));
