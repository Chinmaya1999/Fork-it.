import { Router } from 'express';
import mongoose from 'mongoose';
import { z } from 'zod';
import { TICKET_CATEGORIES } from '@projectforge/shared';
import { requireAuth } from '../../middleware/auth.js';
import { wrap } from '../../utils/async.js';
import { badRequest, notFound } from '../../utils/errors.js';
import { Order } from '../../models/Order.js';
import { CustomRequest } from '../../models/CustomRequest.js';
import { Project } from '../../models/Project.js';
import { Ticket, TicketReply, addSystemNote, newTicketNumber, notifyStaffAbout } from './ticketService.js';

export const ticketsRouter = Router();
ticketsRouter.use('/tickets', requireAuth);
export const REOPEN_WINDOW_DAYS = 14; // configurable reopen policy

const oid = z.string().refine((v) => mongoose.isValidObjectId(v), 'Invalid id');
const mine = async (req: any) => { if (!mongoose.isValidObjectId(req.params.id)) throw notFound(); const t = await Ticket.findOne({ _id: req.params.id, user: req.user.id }); if (!t) throw notFound('Ticket not found'); return t; }; // object-level authorization

ticketsRouter.get('/tickets', wrap(async (req, res) => {
  const status = z.enum(['open', 'in_progress', 'waiting_student', 'resolved', 'closed']).optional().parse(req.query.status);
  const items = await Ticket.find({ user: req.user!.id, ...(status && { status }) }).sort({ lastActivityAt: -1 }).limit(100).select('-assignedTo').lean();
  res.json({ items });
}));

ticketsRouter.post('/tickets', wrap(async (req, res) => {
  const b = z.object({ subject: z.string().trim().min(5).max(160), description: z.string().trim().min(10).max(5000), category: z.enum(TICKET_CATEGORIES).default('other'), orderId: oid.optional(), projectId: oid.optional(), customRequestId: oid.optional() }).parse(req.body);
  const link: Record<string, unknown> = {};
  if (b.orderId) { const o = await Order.findOne({ _id: b.orderId, user: req.user!.id }); if (!o) throw badRequest('That order is not yours'); link.order = o._id; if (o.project) link.project = o.project; }
  if (b.customRequestId) { if (!(await CustomRequest.exists({ _id: b.customRequestId, user: req.user!.id }))) throw badRequest('That custom request is not yours'); link.customRequest = b.customRequestId; }
  if (b.projectId && !link.project) { if (!(await Project.exists({ _id: b.projectId }))) throw badRequest('Unknown project'); link.project = b.projectId; }
  const t = await Ticket.create({ number: await newTicketNumber(), user: req.user!.id, subject: b.subject, description: b.description, category: b.category, ...link }); // priority is staff-controlled
  await notifyStaffAbout(t, 'New support ticket');
  res.status(201).json({ ticket: t });
}));

ticketsRouter.get('/tickets/:id', wrap(async (req, res) => {
  const t = await mine(req); const replies = await TicketReply.find({ ticket: t._id, internal: false }).sort({ createdAt: 1 }).populate('author', 'name').lean(); // internal notes excluded at query level
  const o = t.toObject() as any; delete o.assignedTo; res.json({ ticket: o, replies, canReopen: canReopen(t) });
}));

const canReopen = (t: any) => (t.status === 'resolved' || t.status === 'closed') && Date.now() - new Date(t.closedAt ?? t.resolvedAt ?? t.updatedAt).getTime() < REOPEN_WINDOW_DAYS * 864e5;

ticketsRouter.post('/tickets/:id/replies', wrap(async (req, res) => {
  const { body } = z.object({ body: z.string().trim().min(1).max(5000) }).parse(req.body); const t = await mine(req);
  if (t.status === 'closed') throw badRequest('This ticket is closed. Reopen it to reply.');
  const r = await TicketReply.create({ ticket: t._id, author: req.user!.id, authorRole: 'student', body });
  t.lastActivityAt = new Date(); if (t.status === 'waiting_student' || t.status === 'resolved') { t.status = 'open'; t.resolvedAt = undefined; } await t.save();
  await notifyStaffAbout(t, 'Student replied to a ticket'); res.status(201).json({ reply: r });
}));

ticketsRouter.post('/tickets/:id/close', wrap(async (req, res) => {
  const t = await mine(req); if (t.status === 'closed') return res.json({ ticket: t });
  t.status = 'closed'; t.closedAt = new Date(); t.lastActivityAt = new Date(); await t.save(); await addSystemNote(t._id, 'Ticket closed by the student.'); res.json({ ticket: t });
}));
ticketsRouter.post('/tickets/:id/reopen', wrap(async (req, res) => {
  const t = await mine(req); if (!canReopen(t)) throw badRequest(`Tickets can be reopened within ${REOPEN_WINDOW_DAYS} days of being resolved or closed. Please open a new ticket.`);
  t.status = 'open'; t.reopenCount += 1; t.closedAt = undefined; t.resolvedAt = undefined; t.lastActivityAt = new Date(); await t.save();
  await addSystemNote(t._id, 'Ticket reopened by the student.'); await notifyStaffAbout(t, 'Ticket reopened'); res.json({ ticket: t });
}));
