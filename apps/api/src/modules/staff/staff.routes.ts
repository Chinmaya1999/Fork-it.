import { Router } from 'express';
import mongoose from 'mongoose';
import { z } from 'zod';
import { TICKET_CATEGORIES, TICKET_PRIORITIES, TICKET_STATUSES } from '@projectforge/shared';
import { requireRole } from '../../middleware/auth.js';
import { wrap } from '../../utils/async.js';
import { badRequest, notFound } from '../../utils/errors.js';
import { User } from '../../models/User.js';
import { audit } from '../../utils/audit.js';
import { notify } from '../../services/notify.js';
import { Ticket, TicketReply, addSystemNote } from '../tickets/ticketService.js';

/** Staff area: admins AND support agents (server-side role check on every route). */
export const staffRouter = Router();
staffRouter.use(requireRole('admin', 'support'));
const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

staffRouter.get('/staff-users', wrap(async (_req, res) => { res.json({ items: await User.find({ role: { $in: ['admin', 'support', 'developer'] }, status: 'active' }).select('name email role').sort({ name: 1 }).lean() }); }));

staffRouter.get('/tickets', wrap(async (req, res) => {
  const q = z.object({ q: z.string().trim().max(80).optional(), status: z.enum(TICKET_STATUSES).optional(), priority: z.enum(TICKET_PRIORITIES).optional(), category: z.enum(TICKET_CATEGORIES).optional(), assigned: z.string().optional(), page: z.coerce.number().int().min(1).default(1) }).parse(req.query);
  const f: Record<string, unknown> = {}; if (q.status) f.status = q.status; if (q.priority) f.priority = q.priority; if (q.category) f.category = q.category;
  if (q.assigned === 'me') f.assignedTo = req.user!.id; else if (q.assigned === 'none') f.assignedTo = null; else if (q.assigned && mongoose.isValidObjectId(q.assigned)) f.assignedTo = q.assigned;
  if (q.q) { const r = new RegExp(esc(q.q), 'i'); f.$or = [{ number: r }, { subject: r }]; }
  const limit = 25; const [items, total] = await Promise.all([Ticket.find(f).sort({ lastActivityAt: -1 }).skip((q.page - 1) * limit).limit(limit).populate('user', 'name email').populate('assignedTo', 'name').lean(), Ticket.countDocuments(f)]);
  res.json({ items, total, page: q.page, pages: Math.ceil(total / limit) });
}));
staffRouter.get('/tickets/workload', wrap(async (_req, res) => {
  const rows = await Ticket.aggregate([{ $match: { status: { $in: ['open', 'in_progress', 'waiting_student'] } } }, { $group: { _id: '$assignedTo', n: { $sum: 1 } } }]);
  const users = await User.find({ _id: { $in: rows.map((r) => r._id).filter(Boolean) } }).select('name').lean(); const name = new Map(users.map((u) => [String(u._id), u.name]));
  res.json({ items: rows.map((r) => ({ assignee: r._id ? name.get(String(r._id)) ?? 'Unknown' : 'Unassigned', open: r.n })) });
}));
staffRouter.get('/tickets/:id', wrap(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) throw notFound();
  const t = await Ticket.findById(req.params.id).populate('user', 'name email').populate('assignedTo', 'name').populate('order', 'ref title').populate('project', 'title slug').lean(); if (!t) throw notFound('Ticket not found');
  res.json({ ticket: t, replies: await TicketReply.find({ ticket: t._id }).sort({ createdAt: 1 }).populate('author', 'name').lean() }); // includes internal notes
}));
staffRouter.post('/tickets/:id/replies', wrap(async (req, res) => {
  const b = z.object({ body: z.string().trim().min(1).max(5000), internal: z.boolean().default(false), setStatus: z.enum(['open', 'in_progress', 'waiting_student', 'resolved', 'closed']).optional() }).parse(req.body);
  const t = await Ticket.findById(req.params.id); if (!t) throw notFound('Ticket not found');
  const r = await TicketReply.create({ ticket: t._id, author: req.user!.id, authorRole: 'staff', body: b.body, internal: b.internal });
  t.lastActivityAt = new Date();
  if (!b.internal) {
    if (!t.firstResponseAt) t.firstResponseAt = new Date();
    if (!t.assignedTo) t.assignedTo = req.user!.id as any;
    if (b.setStatus && b.setStatus !== t.status) { await applyStatus(t, b.setStatus); } else if (t.status === 'open') t.status = 'in_progress';
  }
  await t.save();
  if (!b.internal) await notify(String(t.user), { type: 'ticket_reply', title: `New reply on ${t.number}`, body: b.body.slice(0, 140), link: `/dashboard/support/${t._id}`, email: true }); // internal notes never notify the student
  res.status(201).json({ reply: r });
}));
async function applyStatus(t: any, status: string) {
  t.status = status; if (status === 'resolved') t.resolvedAt = new Date(); if (status === 'closed') t.closedAt = new Date();
  await addSystemNote(t._id, `Status changed to ${status.replace('_', ' ')}.`);
}
staffRouter.patch('/tickets/:id', wrap(async (req, res) => {
  const b = z.object({ status: z.enum(TICKET_STATUSES).optional(), priority: z.enum(TICKET_PRIORITIES).optional(), assignedTo: z.string().nullable().optional(), resolution: z.string().trim().max(2000).optional() }).parse(req.body);
  const t = await Ticket.findById(req.params.id); if (!t) throw notFound('Ticket not found');
  if (b.assignedTo !== undefined) {
    if (b.assignedTo === null) t.assignedTo = undefined;
    else { const s = await User.findOne({ _id: b.assignedTo, role: { $in: ['admin', 'support', 'developer'] }, status: 'active' }); if (!s) throw badRequest('Assignee must be an active staff member'); t.assignedTo = s._id as any; await notify(String(s._id), { type: 'ticket_assigned', title: 'Ticket assigned to you', body: `${t.number} · ${t.subject}`, link: `/admin/tickets/${t._id}` }); }
  }
  if (b.priority) t.priority = b.priority; if (b.resolution !== undefined) t.resolution = b.resolution;
  if (b.status && b.status !== t.status) {
    if (b.status === 'resolved' && !(b.resolution ?? t.resolution)) throw badRequest('Add a resolution summary before resolving');
    await applyStatus(t, b.status);
    await notify(String(t.user), { type: 'ticket_status', title: `${t.number} is now ${b.status.replace('_', ' ')}`, body: t.resolution ?? '', link: `/dashboard/support/${t._id}`, email: b.status === 'resolved' });
  }
  t.lastActivityAt = new Date(); await t.save(); await audit(req, 'ticket.update', 'Ticket', String(t._id), b); res.json({ ticket: t });
}));
