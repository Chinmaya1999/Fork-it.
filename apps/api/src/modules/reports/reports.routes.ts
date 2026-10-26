import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { requireAuth } from '../../middleware/auth.js';
import { wrap } from '../../utils/async.js';
import { forbidden, notFound } from '../../utils/errors.js';
import { Project } from '../../models/Project.js';
import { Order } from '../../models/Order.js';
import { generateReport } from '../../services/report/index.js';
import { env } from '../../config/env.js';

export const reportsRouter = Router();
reportsRouter.use('/projects/:slug/report', requireAuth);
const limiter = rateLimit({ windowMs: 60 * 60_000, limit: env.NODE_ENV === 'test' ? 1000 : 20, keyGenerator: (req) => (req as any).user?.id ?? req.ip, standardHeaders: true, legacyHeaders: false, message: { error: { code: 'rate_limited', message: 'Too many reports requested. Try again later.' } } });
const field = z.string().trim().max(120).transform((s) => s.replace(/[\u0000-\u001F\u007F]/g, '')).optional();
const schema = z.object({ format: z.enum(['pdf', 'docx']).default('pdf'), details: z.object({ studentName: field, rollNo: field, degree: field, department: field, college: field, university: field, guide: field, year: field }).default({}) });

/**
 * Project Report Kit. Free projects: any logged-in user. Paid projects: only a verified paid, non-refunded purchase (or staff).
 * The document is a scaffold built from the project's REAL metadata; project-specific narrative is left for the student.
 */
reportsRouter.post('/projects/:slug/report', limiter, wrap(async (req, res) => {
  const { format, details } = schema.parse(req.body ?? {});
  const p = await Project.findOne({ slug: req.params.slug, status: 'published' }).lean(); if (!p) throw notFound('Project not found');
  const staff = req.user!.role === 'admin' || req.user!.role === 'support';
  if (!p.isFree && !staff && !(await Order.exists({ user: req.user!.id, project: p._id, type: 'project', status: 'paid' }))) throw forbidden('The report kit for paid projects is available to customers who have purchased the project.');
  const r = await generateReport({
    title: p.title, slug: p.slug, summary: p.summary, description: p.description, abstract: p.abstract, features: p.features ?? [], technologies: p.technologies ?? [], language: p.language, framework: p.framework, database: p.database,
    appType: p.appType, difficulty: p.difficulty ?? 'intermediate', prerequisites: p.prerequisites ?? [], requirements: p.requirements as any, version: p.version, source: p.source as any, readme: p.readme?.content ?? null,
  }, { ...details, degree: details.degree || p.degreeLevels?.[0] }, format);
  res.set({ 'Content-Type': r.contentType, 'Content-Disposition': `attachment; filename="${r.filename}"`, 'X-Report-Pages': String(r.pages), 'Access-Control-Expose-Headers': 'X-Report-Pages, Content-Disposition', 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' });
  res.send(r.buffer);
}));
