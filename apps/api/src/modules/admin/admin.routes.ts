import { Router } from 'express';
import { z } from 'zod';
import mongoose from 'mongoose';
import { APP_TYPES, DEGREE_LEVELS, DIFFICULTIES, PUBLICATION, ROLES, SOURCE_TYPES, VERIFICATION } from '@projectforge/shared';
import { requireRole } from '../../middleware/auth.js';
import { wrap } from '../../utils/async.js';
import { badRequest, conflict, forbidden, notFound } from '../../utils/errors.js';
import { audit } from '../../utils/audit.js';
import { slugify } from '../../utils/slug.js';
import { Project } from '../../models/Project.js';
import { Category } from '../../models/Category.js';
import { User } from '../../models/User.js';
import { AuditLog } from '../../models/AuditLog.js';
import { fetchReadme } from '../../integrations/github.js';
import { Order } from '../../models/Order.js';
import { Payment } from '../../models/Payment.js';
import { Refund } from '../../models/Refund.js';
import { ProjectFile } from '../../models/ProjectFile.js';
import { DownloadAudit } from '../../models/DownloadAudit.js';
import { confirmPayment, refundOrder } from '../../services/payments.js';
import { uploadSingle, validateMagic } from '../../services/upload.js';
import { removeObject, saveFromPath } from '../../services/storage.js';
import { isPurchasable } from '../orders/orders.routes.js';
import { CustomRequest } from '../../models/CustomRequest.js';
import { Ticket } from '../../models/Ticket.js';
import { Conversation } from '../../models/Conversation.js';
import { adminCustomRouter } from '../custom/custom.admin.routes.js';

export const adminRouter = Router();
adminRouter.use(requireRole('admin')); // every admin endpoint: server-side role check
adminRouter.use('/custom-requests', adminCustomRouter);

const url = z.string().trim().max(500).url().refine((u) => /^https?:\/\//.test(u), 'Must be http(s)');
const list = z.array(z.string().trim().min(1).max(300)).max(60).default([]);
const optStr = (n = 300) => z.string().trim().max(n).optional().or(z.literal('').transform(() => undefined));

// Whitelisted fields only: prevents mass assignment (no slug/views/_id/etc. from the client).
const projectInput = z.object({
  title: z.string().trim().min(3).max(140),
  summary: z.string().trim().min(3).max(300),
  description: z.string().max(20_000).default(''),
  abstract: z.string().max(10_000).default(''),
  features: list, prerequisites: list, technologies: z.array(z.string().trim().min(1).max(40)).max(30).default([]),
  category: z.string().refine((v) => mongoose.isValidObjectId(v), 'Invalid category'),
  appType: z.enum(APP_TYPES), degreeLevels: z.array(z.enum(DEGREE_LEVELS)).default([]), difficulty: z.enum(DIFFICULTIES).default('intermediate'),
  language: optStr(40), framework: optStr(60), database: optStr(60),
  requirements: z.object({ hardware: list, software: list }).default({ hardware: [], software: [] }),
  pricePaise: z.number().int().min(0).max(100_000_00),
  screenshots: z.array(url).max(12).default([]), thumbnail: url.optional().or(z.literal('').transform(() => undefined)),
  demoUrl: url.optional().or(z.literal('').transform(() => undefined)), videoUrl: url.optional().or(z.literal('').transform(() => undefined)),
  source: z.object({
    type: z.enum(SOURCE_TYPES).default('original'), repoUrl: url.optional().or(z.literal('').transform(() => undefined)), author: optStr(100), license: optStr(60),
    redistributionAllowed: z.boolean().default(false), licenseReviewed: z.boolean().default(false), attribution: optStr(500),
  }).default({}),
  version: z.string().trim().max(20).default('1.0.0'), supportPolicy: optStr(1000),
  verification: z.enum(VERIFICATION).default('unverified'), lastTestedAt: z.coerce.date().optional().or(z.literal('').transform(() => undefined)),
  status: z.enum(PUBLICATION).default('draft'), featured: z.boolean().default(false),
  readme: z.string().max(200_000).default(''),
  setupGuide: z.string().max(200_000).default(''),
});

async function uniqueSlug(title: string, excludeId?: string) {
  const base = slugify(title) || 'project'; let slug = base, n = 1;
  while (await Project.exists({ slug, ...(excludeId && { _id: { $ne: excludeId } }) })) slug = `${base}-${++n}`;
  return slug;
}
const applyReadme = (doc: any, readme: string) => { doc.readme = readme.trim() ? { content: readme, source: 'admin', fetchedAt: new Date() } : { content: '', source: '' }; };

// ── stats ──
adminRouter.get('/stats', wrap(async (_req, res) => {
  const [users, byStatus, free, verified, byRole, recent] = await Promise.all([
    User.countDocuments(), Project.aggregate([{ $group: { _id: '$status', n: { $sum: 1 } } }]),
    Project.countDocuments({ status: 'published', isFree: true }), Project.countDocuments({ verification: 'verified' }),
    User.aggregate([{ $group: { _id: '$role', n: { $sum: 1 } } }]), AuditLog.find().sort({ createdAt: -1 }).limit(8).lean(),
  ]);
  const st = Object.fromEntries(byStatus.map((x) => [x._id, x.n]));
  const [paidAgg, refundAgg, orderCount] = await Promise.all([
    Order.aggregate([{ $match: { status: { $in: ['paid', 'refunded'] } } }, { $group: { _id: null, gross: { $sum: '$amountPaise' }, n: { $sum: 1 } } }]),
    Refund.aggregate([{ $match: { status: 'processed' } }, { $group: { _id: null, total: { $sum: '$amountPaise' } } }]),
    Order.countDocuments({ status: 'paid' }),
  ]);
  const gross = paidAgg[0]?.gross ?? 0, refunded = refundAgg[0]?.total ?? 0;
  const [activeCustom, pendingQuotes, openTickets, unreadChats, activeReqs] = await Promise.all([
    CustomRequest.countDocuments({ status: { $in: ['awaiting_advance', 'in_development', 'internal_testing', 'student_review', 'revision_requested', 'awaiting_final_payment'] } }),
    CustomRequest.countDocuments({ status: { $in: ['submitted', 'under_review', 'clarification'] } }),
    Ticket.countDocuments({ status: { $in: ['open', 'in_progress', 'waiting_student'] } }),
    Conversation.countDocuments({ unreadForStaff: { $gt: 0 } }),
    CustomRequest.find({ 'agreed.totalPaise': { $gt: 0 }, status: { $nin: ['completed', 'cancelled', 'rejected'] } }).select('agreed').lean(),
  ]);
  const agreedTotal = activeReqs.reduce((s, r) => s + (r.agreed?.totalPaise ?? 0), 0);
  const paidOnActive = (await Order.aggregate([{ $match: { status: 'paid', type: { $in: ['custom_advance', 'custom_final'] }, customRequest: { $in: (await CustomRequest.find({ 'agreed.totalPaise': { $gt: 0 }, status: { $nin: ['completed', 'cancelled', 'rejected'] } }).select('_id').lean()).map((r) => r._id) } } }, { $group: { _id: null, t: { $sum: '$amountPaise' } } }]))[0]?.t ?? 0;
  res.json({ users, usersByRole: Object.fromEntries(byRole.map((x) => [x._id, x.n])), projects: { published: st.published ?? 0, draft: st.draft ?? 0, unpublished: st.unpublished ?? 0 }, revenue: { grossCollectedPaise: gross, refundedPaise: refunded, netCollectedPaise: gross - refunded, paidOrders: orderCount }, ops: { activeCustomProjects: activeCustom, pendingQuotations: pendingQuotes, openTickets, unreadConversations: unreadChats, pendingBalancePaise: Math.max(agreedTotal - paidOnActive, 0) }, freePublished: free, paidPublished: (st.published ?? 0) - free, verified, recent });
}));

// ── projects ──
adminRouter.get('/projects', wrap(async (req, res) => {
  const q = z.object({ q: z.string().trim().max(100).optional(), status: z.enum(PUBLICATION).optional(), page: z.coerce.number().int().min(1).default(1), limit: z.coerce.number().int().min(1).max(100).default(20) }).parse(req.query);
  const f: Record<string, unknown> = {};
  if (q.status) f.status = q.status;
  if (q.q) f.title = new RegExp(q.q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
  const [items, total] = await Promise.all([
    Project.find(f).select('title slug status pricePaise isFree verification featured source.type source.license appType difficulty updatedAt').sort({ updatedAt: -1 }).skip((q.page - 1) * q.limit).limit(q.limit).lean(),
    Project.countDocuments(f),
  ]);
  res.json({ items, total, page: q.page, pages: Math.ceil(total / q.limit) });
}));

adminRouter.get('/projects/:id/files', wrap(async (req, res) => { res.json({ items: await ProjectFile.find({ project: req.params.id }).sort({ createdAt: -1 }).lean() }); }));
adminRouter.post('/projects/:id/files', (req, res, next) => uploadSingle(req, res, (e) => (e ? next(e instanceof Error && e.name === 'MulterError' ? badRequest(e.message) : e) : next())), wrap(async (req, res) => {
  const f = req.file; if (!f) throw badRequest('No file uploaded');
  const proj = await Project.findById(req.params.id); if (!proj) { await removeObject(f.path); throw notFound('Project not found'); }
  const meta = z.object({ label: z.string().trim().min(1).max(120), kind: z.enum(['source', 'database', 'docs', 'other']).default('source'), version: z.string().trim().max(20).default('1.0.0') }).parse(req.body);
  await validateMagic(f);
  const saved = await saveFromPath(f.path);
  const doc = await ProjectFile.create({ project: proj._id, ...meta, originalName: f.originalname.slice(0, 200), storageKey: saved.key, sizeBytes: saved.sizeBytes, sha256: saved.sha256, uploadedBy: req.user!.id });
  await audit(req, 'file.upload', 'Project', String(proj._id), { file: doc.originalName, sha256: saved.sha256 });
  res.status(201).json({ file: { ...doc.toObject(), storageKey: undefined } });
}));
adminRouter.delete('/files/:fileId', wrap(async (req, res) => {
  const f = await ProjectFile.findById(req.params.fileId).select('+storageKey'); if (!f) throw notFound();
  await removeObject(f.storageKey); await f.deleteOne(); await audit(req, 'file.delete', 'ProjectFile', req.params.fileId, { name: f.originalName }); res.json({ ok: true });
}));

adminRouter.get('/projects/:id', wrap(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) throw notFound();
  const p = await Project.findById(req.params.id).lean(); if (!p) throw notFound('Project not found');
  res.json({ project: p });
}));

adminRouter.post('/projects', wrap(async (req, res) => {
  const { readme, ...data } = projectInput.parse(req.body);
  if (!(await Category.exists({ _id: data.category }))) throw badRequest('Category does not exist');
  const doc = new Project({ ...data, slug: await uniqueSlug(data.title) });
  applyReadme(doc, readme);
  await doc.save(); // save() runs the license guard + isFree derivation
  await audit(req, 'project.create', 'Project', String(doc._id), { title: doc.title, status: doc.status });
  res.status(201).json({ project: doc });
}));

adminRouter.patch('/projects/:id', wrap(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) throw notFound();
  const doc = await Project.findById(req.params.id); if (!doc) throw notFound('Project not found');
  const { readme, ...data } = projectInput.parse(req.body);
  if (!(await Category.exists({ _id: data.category }))) throw badRequest('Category does not exist');
  const before = { status: doc.status, pricePaise: doc.pricePaise };
  doc.set(data); applyReadme(doc, readme);
  await doc.save();
  await audit(req, 'project.update', 'Project', String(doc._id), { before, after: { status: doc.status, pricePaise: doc.pricePaise } });
  res.json({ project: doc });
}));

adminRouter.patch('/projects/:id/status', wrap(async (req, res) => {
  const { status } = z.object({ status: z.enum(PUBLICATION) }).parse(req.body);
  const doc = await Project.findById(req.params.id); if (!doc) throw notFound('Project not found');
  const from = doc.status; doc.status = status; await doc.save();
  await audit(req, 'project.status', 'Project', String(doc._id), { from, to: status });
  res.json({ ok: true, status });
}));

adminRouter.delete('/projects/:id', wrap(async (req, res) => {
  const doc = await Project.findByIdAndDelete(req.params.id); if (!doc) throw notFound('Project not found');
  await audit(req, 'project.delete', 'Project', req.params.id, { title: doc.title });
  res.json({ ok: true });
}));

adminRouter.post('/projects/:id/fetch-readme', wrap(async (req, res) => {
  const doc = await Project.findById(req.params.id); if (!doc) throw notFound('Project not found');
  const md = await fetchReadme(doc.source?.repoUrl);
  if (!md) throw badRequest('Could not fetch a README from the source repository (not a GitHub URL, no README, or rate-limited).');
  doc.readme = { content: md, source: 'github', fetchedAt: new Date() }; await doc.save();
  await audit(req, 'project.readme.fetch', 'Project', String(doc._id));
  res.json({ readme: md });
}));

// ── categories ──
const catInput = z.object({ name: z.string().trim().min(2).max(60), description: z.string().trim().max(300).default(''), icon: z.string().trim().max(30).default('Folder'), order: z.number().int().min(0).max(999).default(0) });
adminRouter.get('/categories', wrap(async (_req, res) => {
  const counts = await Project.aggregate([{ $group: { _id: '$category', n: { $sum: 1 } } }]); const m = new Map(counts.map((c) => [String(c._id), c.n]));
  res.json({ items: (await Category.find().sort({ order: 1 }).lean()).map((c) => ({ ...c, projectCount: m.get(String(c._id)) ?? 0 })) });
}));
adminRouter.post('/categories', wrap(async (req, res) => {
  const d = catInput.parse(req.body); const slug = slugify(d.name);
  if (await Category.exists({ slug })) throw conflict('A category with this name already exists');
  const c = await Category.create({ ...d, slug }); await audit(req, 'category.create', 'Category', String(c._id), { name: d.name }); res.status(201).json({ category: c });
}));
adminRouter.patch('/categories/:id', wrap(async (req, res) => {
  const c = await Category.findByIdAndUpdate(req.params.id, catInput.parse(req.body), { new: true }); if (!c) throw notFound();
  await audit(req, 'category.update', 'Category', String(c._id)); res.json({ category: c });
}));
adminRouter.delete('/categories/:id', wrap(async (req, res) => {
  if (await Project.exists({ category: req.params.id })) throw conflict('Category still has projects. Move or delete them first.');
  const c = await Category.findByIdAndDelete(req.params.id); if (!c) throw notFound();
  await audit(req, 'category.delete', 'Category', req.params.id, { name: c.name }); res.json({ ok: true });
}));

// ── users ──
adminRouter.get('/users', wrap(async (req, res) => {
  const q = z.object({ q: z.string().trim().max(100).optional(), role: z.enum(ROLES).optional(), page: z.coerce.number().int().min(1).default(1), limit: z.coerce.number().int().min(1).max(100).default(20) }).parse(req.query);
  const f: Record<string, unknown> = {}; if (q.role) f.role = q.role;
  if (q.q) { const r = new RegExp(q.q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'); f.$or = [{ name: r }, { email: r }]; }
  const [items, total] = await Promise.all([User.find(f).select('name email role status emailVerified college degree createdAt').sort({ createdAt: -1 }).skip((q.page - 1) * q.limit).limit(q.limit).lean(), User.countDocuments(f)]);
  res.json({ items, total, page: q.page, pages: Math.ceil(total / q.limit) });
}));
adminRouter.patch('/users/:id', wrap(async (req, res) => {
  const d = z.object({ role: z.enum(ROLES).optional(), status: z.enum(['active', 'suspended']).optional(), emailVerified: z.literal(true).optional() }).parse(req.body);
  if (req.params.id === req.user!.id) throw forbidden('You cannot change your own role or status');
  const u = await User.findById(req.params.id); if (!u) throw notFound('User not found');
  const before = { role: u.role, status: u.status };
  if (d.role) u.role = d.role; if (d.status) u.status = d.status;
  if (d.emailVerified) { u.emailVerified = true; u.emailVerifyTokenHash = undefined; } // manual verification (audited)
  u.tokenVersion += 1; // invalidate existing sessions so changes apply immediately
  await u.save(); await audit(req, 'user.update', 'User', String(u._id), { before, after: d });
  res.json({ ok: true });
}));

// ── audit log ──
adminRouter.get('/audit', wrap(async (req, res) => {
  const page = z.coerce.number().int().min(1).default(1).parse(req.query.page); const limit = 30;
  const [items, total] = await Promise.all([AuditLog.find().sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(), AuditLog.countDocuments()]);
  res.json({ items, total, page, pages: Math.ceil(total / limit) });
}));

// ── orders & payments ──
adminRouter.get('/orders', wrap(async (req, res) => {
  const q = z.object({ q: z.string().trim().max(60).optional(), status: z.enum(['created', 'paid', 'failed', 'cancelled', 'refunded']).optional(), type: z.enum(['project', 'custom_advance', 'custom_final']).optional(), page: z.coerce.number().int().min(1).default(1) }).parse(req.query);
  const f: Record<string, unknown> = {}; if (q.status) f.status = q.status; if (q.type) f.type = q.type;
  if (q.q) { const r = new RegExp(q.q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'); f.$or = [{ ref: r }, { title: r }, { receiptNo: r }]; }
  const limit = 25; const [items, total] = await Promise.all([Order.find(f).sort({ createdAt: -1 }).skip((q.page - 1) * limit).limit(limit).populate('user', 'name email').lean(), Order.countDocuments(f)]);
  res.json({ items, total, page: q.page, pages: Math.ceil(total / limit) });
}));
adminRouter.get('/orders/:id', wrap(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) throw notFound();
  const o = await Order.findById(req.params.id).populate('user', 'name email').populate('project', 'title slug').lean(); if (!o) throw notFound('Order not found');
  const [payments, refunds, downloads] = await Promise.all([Payment.find({ order: o._id }).sort({ createdAt: -1 }).lean(), Refund.find({ order: o._id }).sort({ createdAt: -1 }).lean(), DownloadAudit.countDocuments({ order: o._id })]);
  res.json({ order: o, payments, refunds, downloads });
}));
adminRouter.post('/orders/:id/refund', wrap(async (req, res) => {
  const b = z.object({ amountPaise: z.number().int().min(1).optional(), reason: z.string().trim().min(3).max(500) }).parse(req.body);
  const o = await refundOrder(req.params.id, b.amountPaise, b.reason, req.user!.id);
  await audit(req, 'order.refund', 'Order', String(o._id), { amountPaise: b.amountPaise ?? 'full', reason: b.reason }); res.json({ order: o });
}));
// Controlled reconciliation: an admin supplies a gateway payment id; it is still only accepted if the GATEWAY confirms capture and the amount matches.
adminRouter.post('/orders/:id/reconcile', wrap(async (req, res) => {
  const { paymentId } = z.object({ paymentId: z.string().trim().min(5).max(100) }).parse(req.body);
  const r = await confirmPayment(req.params.id, paymentId, { source: 'reconcile' });
  await audit(req, 'order.reconcile', 'Order', req.params.id, { paymentId }); res.json({ order: r.order, alreadyPaid: r.alreadyPaid });
}));
