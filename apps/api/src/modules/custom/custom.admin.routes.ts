import { Router } from 'express';
import mongoose from 'mongoose';
import { z } from 'zod';
import { CUSTOM_STATUSES, MILESTONE_STATUSES } from '@projectforge/shared';
import { wrap } from '../../utils/async.js';
import { badRequest, HttpError, notFound } from '../../utils/errors.js';
import { audit } from '../../utils/audit.js';
import { User } from '../../models/User.js';
import { CustomRequest } from '../../models/CustomRequest.js';
import { Quotation } from '../../models/Quotation.js';
import { Milestone } from '../../models/Milestone.js';
import { Order } from '../../models/Order.js';
import { ProjectFile } from '../../models/ProjectFile.js';
import { nextStatus, splitPayments, type Action } from '../../services/customRules.js';
import { notify } from '../../services/notify.js';
import { uploadSingle, validateMagic } from '../../services/upload.js';
import { removeObject, saveFromPath } from '../../services/storage.js';
import { transition } from './customService.js';

/** Mounted under /admin (admin-only). */
export const adminCustomRouter = Router();
const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const getReq = async (id: string) => { if (!mongoose.isValidObjectId(id)) throw notFound(); const r = await CustomRequest.findById(id); if (!r) throw notFound('Request not found'); return r; };

adminCustomRouter.get('/', wrap(async (req, res) => {
  const q = z.object({ q: z.string().trim().max(80).optional(), status: z.enum(CUSTOM_STATUSES).optional(), assigned: z.string().optional(), page: z.coerce.number().int().min(1).default(1) }).parse(req.query);
  const f: Record<string, unknown> = {}; if (q.status) f.status = q.status; if (q.assigned === 'none') f.assignedTo = null; else if (q.assigned === 'me') f.assignedTo = req.user!.id;
  if (q.q) { const r = new RegExp(esc(q.q), 'i'); f.$or = [{ ref: r }, { title: r }]; }
  const limit = 25; const [items, total] = await Promise.all([CustomRequest.find(f).sort({ updatedAt: -1 }).skip((q.page - 1) * limit).limit(limit).populate('user', 'name email').populate('assignedTo', 'name').lean(), CustomRequest.countDocuments(f)]);
  res.json({ items, total, page: q.page, pages: Math.ceil(total / limit) });
}));

adminCustomRouter.get('/:id', wrap(async (req, res) => {
  const r = await getReq(req.params.id);
  const [user, assignee, quotations, milestones, orders, files] = await Promise.all([User.findById(r.user).select('name email college degree').lean(), r.assignedTo ? User.findById(r.assignedTo).select('name').lean() : null, Quotation.find({ request: r._id }).sort({ version: -1 }).lean(), Milestone.find({ request: r._id }).sort({ order: 1 }).populate('assignee', 'name').populate('comments.author', 'name').lean(), Order.find({ customRequest: r._id }).sort({ createdAt: 1 }).lean(), ProjectFile.find({ customRequest: r._id }).lean()]);
  const staffActions = (['start_review', 'ask_clarification', 'resume_review', 'reject', 'start_testing', 'send_to_review', 'back_to_dev', 'request_final_payment', 'complete', 'cancel', 'resolve_dispute'] as Action[]).filter((a) => nextStatus(a, r.status, 'staff', r.statusBeforeDispute));
  const paid = (t: string) => orders.some((o) => o.type === t && o.status === 'paid');
  const outstanding = (r.agreed?.totalPaise ?? 0) - orders.filter((o) => o.status === 'paid').reduce((s, o) => s + o.amountPaise - o.refundedPaise, 0);
  res.json({ request: r, user, assignee, quotations, milestones, orders, files, staffActions, advancePaid: paid('custom_advance'), finalPaid: paid('custom_final'), outstandingPaise: r.agreed?.totalPaise ? Math.max(outstanding, 0) : null });
}));

adminCustomRouter.post('/:id/actions', wrap(async (req, res) => {
  const b = z.object({ action: z.enum(['start_review', 'ask_clarification', 'resume_review', 'reject', 'start_testing', 'send_to_review', 'back_to_dev', 'request_final_payment', 'complete', 'cancel', 'resolve_dispute']), note: z.string().trim().max(500).optional(), to: z.enum(CUSTOM_STATUSES).optional(), force: z.boolean().default(false) }).parse(req.body);
  const r = await getReq(req.params.id);
  const legal = nextStatus(b.action, r.status, 'staff', r.statusBeforeDispute);
  if (!legal) throw new HttpError(409, `Cannot ${b.action.replace(/_/g, ' ')} while the request is "${r.status}"`, 'invalid_transition'); // state machine first, then business preconditions
  if ((b.action === 'reject' || b.action === 'cancel') && !b.note) throw badRequest('A reason is required');
  if (b.action === 'request_final_payment') {
    if (!(await ProjectFile.exists({ customRequest: r._id }))) throw badRequest('Upload the final deliverables first — they are released automatically once the final payment is verified');
    if (!r.studentApproved && !b.force) throw badRequest('The student has not approved the delivery yet. Use "force" only if the agreed acceptance condition has been met.');
  }
  let updated;
  if (b.action === 'resolve_dispute' && b.to) { // staff may resolve a dispute into a specific state
    if (r.status !== 'disputed' || !['in_development', 'student_review', 'cancelled', 'completed', 'delivered'].includes(b.to)) throw new HttpError(409, 'Invalid dispute resolution', 'invalid_transition');
    updated = await CustomRequest.findOneAndUpdate({ _id: r._id, status: 'disputed' }, { $set: { status: b.to }, $push: { history: { status: b.to, role: 'staff', by: req.user!.id, note: b.note ?? 'Dispute resolved', at: new Date() } } }, { new: true });
    if (updated) await notify(String(updated.user), { type: 'custom_status', title: 'Your dispute was resolved', body: `${updated.ref} → ${b.to.replace('_', ' ')}`, link: `/dashboard/custom/${updated._id}` });
  } else updated = await transition(r, b.action, 'staff', { id: req.user!.id }, b.note);
  await audit(req, `custom.${b.action}`, 'CustomRequest', String(r._id), { note: b.note, force: b.force }); res.json({ request: updated });
}));

adminCustomRouter.patch('/:id/assign', wrap(async (req, res) => {
  const { assignedTo } = z.object({ assignedTo: z.string().nullable() }).parse(req.body); const r = await getReq(req.params.id);
  if (assignedTo === null) r.assignedTo = undefined; else { const s = await User.findOne({ _id: assignedTo, role: { $in: ['admin', 'support', 'developer'] }, status: 'active' }); if (!s) throw badRequest('Assignee must be an active staff member'); r.assignedTo = s._id as any; await notify(String(s._id), { type: 'custom_assigned', title: 'Custom project assigned to you', body: `${r.ref} · ${r.title}`, link: `/admin/custom/${r._id}` }); }
  await r.save(); await audit(req, 'custom.assign', 'CustomRequest', String(r._id), { assignedTo }); res.json({ ok: true });
}));

// ── quotations (create / revise) ──
const quoteSchema = z.object({
  totalPaise: z.number().int().min(100), advancePercent: z.number().min(1).max(100), deliveryDays: z.number().int().min(1).max(730), scope: z.string().trim().min(20).max(8000),
  deliverables: z.array(z.string().trim().min(1).max(200)).min(1).max(30), milestones: z.array(z.object({ title: z.string().trim().min(1).max(120), description: z.string().trim().max(1000).optional(), dueInDays: z.number().int().min(0).max(730).default(0) })).min(1).max(20),
  revisionLimit: z.number().int().min(0).max(20).default(2), supportDays: z.number().int().min(0).max(365).default(30), finalPaymentCondition: z.string().trim().min(5).max(600), cancellationTerms: z.string().trim().max(1500).optional(), refundTerms: z.string().trim().max(1500).optional(),
});
adminCustomRouter.post('/:id/quotations', wrap(async (req, res) => {
  const b = quoteSchema.parse(req.body); const r = await getReq(req.params.id);
  if (!nextStatus('send_quotation', r.status, 'staff')) throw new HttpError(409, `A quotation cannot be sent while the request is "${r.status}"`, 'invalid_transition');
  const { advancePaise, finalPaise } = splitPayments(b.totalPaise, b.advancePercent);
  const last = await Quotation.findOne({ request: r._id }).sort({ version: -1 });
  const q = await Quotation.create({ ...b, request: r._id, version: (last?.version ?? 0) + 1, advancePaise, finalPaise, createdBy: req.user!.id });
  await Quotation.updateMany({ request: r._id, _id: { $ne: q._id }, status: 'sent' }, { status: 'superseded' }); // only the newest version can be accepted
  await transition(r, 'send_quotation', 'staff', { id: req.user!.id }, `Quotation v${q.version} sent`);
  await audit(req, 'custom.quotation', 'CustomRequest', String(r._id), { version: q.version, totalPaise: q.totalPaise }); res.status(201).json({ quotation: q });
}));

// ── milestones ──
const msSchema = z.object({ title: z.string().trim().min(1).max(120), description: z.string().trim().max(1000).optional(), deliverables: z.array(z.string().trim().max(200)).max(20).optional(), dueDate: z.coerce.date().optional(), status: z.enum(MILESTONE_STATUSES).optional(), assignee: z.string().nullable().optional(), progressNotes: z.string().trim().max(2000).optional() });
adminCustomRouter.post('/:id/milestones', wrap(async (req, res) => { const r = await getReq(req.params.id); const b = msSchema.parse(req.body); const n = await Milestone.countDocuments({ request: r._id }); res.status(201).json({ milestone: await Milestone.create({ ...b, assignee: b.assignee ?? undefined, request: r._id, order: n }) }); }));
adminCustomRouter.patch('/:id/milestones/:mid', wrap(async (req, res) => {
  const r = await getReq(req.params.id); const b = msSchema.partial().parse(req.body); const m = await Milestone.findOne({ _id: req.params.mid, request: r._id }); if (!m) throw notFound('Milestone not found');
  const before = m.status; const { assignee, ...rest } = b; m.set(rest); if (assignee !== undefined) m.assignee = (assignee ?? undefined) as any;
  if (b.status === 'completed' && before !== 'completed') m.completedAt = new Date(); if (b.status && b.status !== 'completed') m.completedAt = undefined;
  await m.save();
  if (b.status && b.status !== before) await notify(String(r.user), { type: 'milestone', title: b.status === 'completed' ? 'Milestone completed' : 'Milestone started', body: `${r.ref} · ${m.title}`, link: `/dashboard/custom/${r._id}`, dedupeKey: `ms:${m._id}:${b.status}` });
  res.json({ milestone: m });
}));
adminCustomRouter.delete('/:id/milestones/:mid', wrap(async (req, res) => { await Milestone.deleteOne({ _id: req.params.mid, request: req.params.id }); res.json({ ok: true }); }));

// ── deliverables (locked until the final payment is verified) ──
adminCustomRouter.post('/:id/files', (req, res, next) => uploadSingle(req, res, (e) => (e ? next(e instanceof Error && e.name === 'MulterError' ? badRequest(e.message) : e) : next())), wrap(async (req, res) => {
  const f = req.file; if (!f) throw badRequest('No file uploaded'); const r = await CustomRequest.findById(req.params.id); if (!r) { await removeObject(f.path); throw notFound('Request not found'); }
  const meta = z.object({ label: z.string().trim().min(1).max(120), kind: z.enum(['source', 'database', 'docs', 'other']).default('source') }).parse(req.body);
  await validateMagic(f); const saved = await saveFromPath(f.path);
  const doc = await ProjectFile.create({ customRequest: r._id, ...meta, originalName: f.originalname.slice(0, 200), storageKey: saved.key, sizeBytes: saved.sizeBytes, sha256: saved.sha256, uploadedBy: req.user!.id });
  await audit(req, 'file.upload', 'CustomRequest', String(r._id), { file: doc.originalName }); res.status(201).json({ file: { ...doc.toObject(), storageKey: undefined } });
}));
