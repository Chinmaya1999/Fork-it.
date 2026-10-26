import { Router } from 'express';
import { z } from 'zod';
import mongoose from 'mongoose';
import { requireAuth } from '../../middleware/auth.js';
import { wrap } from '../../utils/async.js';
import { Notification } from '../../models/Notification.js';

export const notificationsRouter = Router();
notificationsRouter.use('/notifications', requireAuth);

notificationsRouter.get('/notifications', wrap(async (req, res) => {
  const q = z.object({ page: z.coerce.number().int().min(1).default(1), unread: z.enum(['1']).optional() }).parse(req.query); const limit = 20;
  const f: Record<string, unknown> = { user: req.user!.id }; if (q.unread) f.readAt = null;
  const [items, unreadCount, total] = await Promise.all([Notification.find(f).sort({ createdAt: -1 }).skip((q.page - 1) * limit).limit(limit).lean(), Notification.countDocuments({ user: req.user!.id, readAt: null }), Notification.countDocuments(f)]);
  res.json({ items, unreadCount, total, page: q.page, pages: Math.ceil(total / limit) });
}));
notificationsRouter.get('/notifications/unread-count', wrap(async (req, res) => { res.json({ unreadCount: await Notification.countDocuments({ user: req.user!.id, readAt: null }) }); }));
notificationsRouter.post('/notifications/read-all', wrap(async (req, res) => { await Notification.updateMany({ user: req.user!.id, readAt: null }, { readAt: new Date() }); res.json({ ok: true }); }));
notificationsRouter.post('/notifications/:id/read', wrap(async (req, res) => {
  if (mongoose.isValidObjectId(req.params.id)) await Notification.updateOne({ _id: req.params.id, user: req.user!.id }, { readAt: new Date() }); // scoped to the owner
  res.json({ ok: true });
}));
