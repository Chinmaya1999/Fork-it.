import { Router } from 'express';
import mongoose from 'mongoose';
import { z } from 'zod';
import { APP_TYPES, DEGREE_LEVELS } from '@projectforge/shared';
import { requireAuth } from '../../middleware/auth.js';
import { wrap } from '../../utils/async.js';
import { badRequest, HttpError, notFound } from '../../utils/errors.js';
import { User } from '../../models/User.js';
import { CustomRequest } from '../../models/CustomRequest.js';
import { Quotation } from '../../models/Quotation.js';
import { Milestone } from '../../models/Milestone.js';
import { Order } from '../../models/Order.js';
import { ProjectFile } from '../../models/ProjectFile.js';
import { createCheckout } from '../../services/payments.js';
import { nextStatus, type Action } from '../../services/customRules.js';
import { newRef, notifyStaffFor, transition } from './customService.js';
import { notifyStaff } from '../../services/notify.js';

export const customRouter = Router();
customRouter.use('/custom-requests', requireAuth);

const list = (max = 30) => z.array(z.string().trim().min(1).max(200)).max(max).default([]);
const url = z.string().trim().url().max(300).refine((u) => /^https?:\/\//.test(u), 'Must be http(s)');
const createSchema = z.object({
  title: z.string().trim().min(5).max(140), idea: z.string().trim().min(20).max(5000), abstract: z.string().trim().max(5000).default(''),
  degree: z.enum(DEGREE_LEVELS).optional(), department: z.string().trim().max(100).optional(), appType: z.enum(APP_TYPES).default('web'),
  preferredTech: list(20), features: list(40), roles: list(20), databaseReq: z.string().trim().max(300).optional(), references: z.array(url).max(10).default([]),
  deadline: z.coerce.date().refine((d) => d.getTime() > Date.now(), 'Deadline must be in the future').optional(), budgetRange: z.string().trim().max(60).optional(),
  docsRequired: z.string().trim().max(500).optional(), deploymentReq: z.string().trim().max(500).optional(), notes: z.string().trim().max(2000).optional(),
});
const STUDENT_ACTIONS: Action[] = ['resume_review', 'approve_delivery', 'request_revision', 'cancel', 'dispute', 'complete'];
const CANCEL_BEFORE: string[] = ['submitted', 'under_review', 'clarification', 'quoted', 'awaiting_advance']; // after the advance is paid, cancelling needs staff (money is involved)

const own = async (req: any) => { if (!mongoose.isValidObjectId(req.params.id)) throw notFound(); const r = await CustomRequest.findOne({ _id: req.params.id, user: req.user.id }); if (!r) throw notFound('Request not found'); return r; }; // object-level authorization

customRouter.post('/custom-requests', wrap(async (req, res) => {
  const b = createSchema.parse(req.body);
  const r = await CustomRequest.create({ ...b, ref: await newRef(), user: req.user!.id, history: [{ status: 'submitted', role: 'student', note: 'Request submitted', at: new Date() }] });
  await notifyStaff({ type: 'custom_new', title: 'New custom project request', body: `${r.ref} · ${r.title}`, link: `/admin/custom/${r._id}` });
  res.status(201).json({ request: r });
}));

customRouter.get('/custom-requests', wrap(async (req, res) => { res.json({ items: await CustomRequest.find({ user: req.user!.id }).sort({ updatedAt: -1 }).select('ref title status appType deadline agreed createdAt updatedAt').lean() }); }));

customRouter.get('/custom-requests/:id', wrap(async (req, res) => {
  const r = await own(req);
  const [quotations, milestones, orders] = await Promise.all([Quotation.find({ request: r._id }).sort({ version: -1 }).lean(), Milestone.find({ request: r._id }).sort({ order: 1 }).populate('comments.author', 'name').lean(), Order.find({ customRequest: r._id, status: { $ne: 'cancelled' } }).sort({ createdAt: 1 }).lean()]);
  const unlocked = ['delivered', 'completed'].includes(r.status) && orders.some((o) => o.type === 'custom_final' && o.status === 'paid');
  const files = unlocked ? await ProjectFile.find({ customRequest: r._id }).select('label kind version originalName sizeBytes sha256 createdAt').lean() : [];
  const lockedCount = unlocked ? 0 : await ProjectFile.countDocuments({ customRequest: r._id }); // tells the student something is waiting, without exposing it
  const actions = STUDENT_ACTIONS.filter((a) => nextStatus(a, r.status, 'student', r.statusBeforeDispute) && (a !== 'cancel' || CANCEL_BEFORE.includes(r.status)) && (a !== 'request_revision' || r.revisionsUsed < (r.agreed?.revisionLimit ?? 0)));
  const o = r.toObject() as any; delete o.assignedTo;
  res.json({ request: o, quotations, milestones, orders: orders.map((x) => ({ id: String(x._id), ref: x.ref, type: x.type, amountPaise: x.amountPaise, status: x.status, receiptNo: x.receiptNo, paidAt: x.paidAt })), files, lockedCount, actions, studentCanAcceptQuote: r.status === 'quoted' });
}));

customRouter.post('/custom-requests/:id/quotations/:qid/accept', wrap(async (req, res) => {
  const r = await own(req); if (!mongoose.isValidObjectId(req.params.qid)) throw notFound();
  const latest = await Quotation.findOne({ request: r._id }).sort({ version: -1 }); if (!latest || String(latest._id) !== req.params.qid) throw badRequest('This quotation has been replaced by a newer version');
  if (r.status !== 'quoted') throw new HttpError(409, 'This request is not awaiting your decision', 'invalid_transition');
  const q = await Quotation.findOneAndUpdate({ _id: latest._id, status: 'sent' }, { status: 'accepted', respondedAt: new Date() }, { new: true }); if (!q) throw new HttpError(409, 'Quotation was already answered', 'conflict'); // atomic: cannot be accepted twice
  const updated = await transition(r, 'accept_quotation', 'student', { id: req.user!.id }, `Accepted quotation v${q.version}`, { agreed: { quotation: q._id, totalPaise: q.totalPaise, advancePaise: q.advancePaise, finalPaise: q.finalPaise, revisionLimit: q.revisionLimit, supportDays: q.supportDays, finalPaymentCondition: q.finalPaymentCondition } }); // terms frozen
  res.json({ request: updated });
}));
customRouter.post('/custom-requests/:id/quotations/:qid/decline', wrap(async (req, res) => {
  const { reason } = z.object({ reason: z.string().trim().max(500).default('') }).parse(req.body); const r = await own(req);
  const q = await Quotation.findOneAndUpdate({ _id: req.params.qid, request: r._id, status: 'sent' }, { status: 'declined', respondedAt: new Date(), declineReason: reason }); if (!q) throw new HttpError(409, 'Quotation can no longer be declined', 'conflict');
  res.json({ request: await transition(r, 'decline_quotation', 'student', { id: req.user!.id }, reason || 'Quotation declined') });
}));

customRouter.post('/custom-requests/:id/actions', wrap(async (req, res) => {
  const { action, note } = z.object({ action: z.enum(['resume_review', 'approve_delivery', 'request_revision', 'cancel', 'dispute', 'complete']), note: z.string().trim().max(500).optional() }).parse(req.body);
  const r = await own(req);
  if (action === 'cancel' && !CANCEL_BEFORE.includes(r.status)) throw new HttpError(409, 'After the advance is paid, cancellation must be arranged with the team (open a message or dispute).', 'invalid_transition');
  if (action === 'request_revision') { const limit = r.agreed?.revisionLimit ?? 0; if (r.revisionsUsed >= limit) throw new HttpError(409, `You have used all ${limit} included revisions. Contact the team to agree additional work.`, 'revision_limit'); if (!note) throw badRequest('Please describe the changes you need'); }
  if (action === 'dispute' && !note) throw badRequest('Please explain the issue');
  res.json({ request: await transition(r, action, 'student', { id: req.user!.id }, note, action === 'request_revision' ? { revisionsUsed: r.revisionsUsed + 1 } : {}) });
}));

// Pay the advance or final instalment. The amount comes from the terms frozen at acceptance, never from the client.
customRouter.post('/custom-requests/:id/pay', wrap(async (req, res) => {
  const { stage } = z.object({ stage: z.enum(['advance', 'final']) }).parse(req.body); const r = await own(req);
  const me = await User.findById(req.user!.id).select('emailVerified'); if (!me?.emailVerified) throw new HttpError(403, 'Please verify your email before paying', 'email_unverified');
  if (stage === 'advance' && r.status !== 'awaiting_advance') throw new HttpError(409, 'The advance is not due right now', 'invalid_transition');
  if (stage === 'final' && r.status !== 'awaiting_final_payment') throw new HttpError(409, 'The final payment is not due right now', 'invalid_transition');
  const amount = stage === 'advance' ? r.agreed?.advancePaise : r.agreed?.finalPaise; if (!amount) throw badRequest('No agreed amount on this request');
  const { order, checkout } = await createCheckout({ userId: req.user!.id, type: stage === 'advance' ? 'custom_advance' : 'custom_final', customRequest: r._id, title: `${r.title} — ${stage} payment`, amountPaise: amount });
  res.status(201).json({ order: { id: String(order._id), ref: order.ref, amountPaise: order.amountPaise, status: order.status }, checkout: { ...checkout, prefill: { name: req.user!.name, email: req.user!.email } } });
}));

customRouter.post('/custom-requests/:id/milestones/:mid/comments', wrap(async (req, res) => {
  const { body } = z.object({ body: z.string().trim().min(1).max(1000) }).parse(req.body); const r = await own(req); if (!mongoose.isValidObjectId(req.params.mid)) throw notFound();
  const m = await Milestone.findOneAndUpdate({ _id: req.params.mid, request: r._id, 'comments.99': { $exists: false } }, { $push: { comments: { author: req.user!.id, role: 'student', body, at: new Date() } } }, { new: true }); if (!m) throw notFound('Milestone not found');
  await notifyStaffFor(r, `${r.ref}: student commented on a milestone`); res.status(201).json({ milestone: m });
}));
