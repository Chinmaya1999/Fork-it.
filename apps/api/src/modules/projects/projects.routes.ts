import { Router } from 'express';
import type { FilterQuery } from 'mongoose';
import { projectQuerySchema } from '@projectforge/shared';
import { Project } from '../../models/Project.js';
import { Category } from '../../models/Category.js';
import { wrap } from '../../utils/async.js';
import { notFound } from '../../utils/errors.js';
import { fetchReadme } from '../../integrations/github.js';
import { isPurchasable } from '../orders/orders.routes.js';
import { generateReadme, stripCloneSteps } from '../../utils/readme.js';

export const projectsRouter = Router();
const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
// Public list fields: never expose private storage keys or internal review data.
const LIST_FIELDS = 'thumbnail language title slug summary category appType technologies difficulty pricePaise isFree thumbnail verification source.type source.license featured createdAt degreeLevels';

projectsRouter.get('/', wrap(async (req, res) => {
  const q = projectQuerySchema.parse(req.query);
  const f: FilterQuery<any> = { status: 'published' };
  if (q.q) f.$or = [{ title: new RegExp(esc(q.q), 'i') }, { summary: new RegExp(esc(q.q), 'i') }, { technologies: new RegExp(esc(q.q), 'i') }];
  if (q.appType) f.appType = q.appType;
  if (q.degree) f.degreeLevels = q.degree;
  if (q.difficulty) f.difficulty = q.difficulty;
  if (q.tech) f.technologies = { $in: q.tech.split(',').map((t) => t.trim()).filter(Boolean).map((t) => new RegExp(`^${esc(t)}$`, 'i')) };
  if (q.language) f.language = new RegExp(`^${esc(q.language)}$`, 'i');
  if (q.database) f.database = new RegExp(`^${esc(q.database)}$`, 'i');
  if (q.license) f['source.license'] = q.license;
  if (q.sourceType) f['source.type'] = q.sourceType;
  if (q.pricing) f.isFree = q.pricing === 'free';
  if (q.verified) f.verification = 'verified';
  if (q.category) { const c = await Category.findOne({ slug: q.category }); f.category = c?._id ?? null; }
  if (q.minPrice != null || q.maxPrice != null) {
    f.pricePaise = { ...(q.minPrice != null && { $gte: q.minPrice * 100 }), ...(q.maxPrice != null && { $lte: q.maxPrice * 100 }) };
  }
  const sort = ({ newest: { createdAt: -1 }, 'price-asc': { pricePaise: 1 }, 'price-desc': { pricePaise: -1 }, popular: { views: -1 } } as Record<string, Record<string, 1 | -1>>)[q.sort];
  const [items, total] = await Promise.all([
    Project.find(f).select(LIST_FIELDS).populate('category', 'name slug').sort(sort).skip((q.page - 1) * q.limit).limit(q.limit).lean(),
    Project.countDocuments(f),
  ]);
  res.json({ items, total, page: q.page, pages: Math.ceil(total / q.limit) });
}));

const count = (field: string, unwind = false, limit = 30) => [
  { $match: { status: 'published', [field.replace('$', '')]: { $nin: [null, ''] } } },
  ...(unwind ? [{ $unwind: field }] : []),
  { $group: { _id: field, n: { $sum: 1 } } }, { $sort: { n: -1 as const } }, { $limit: limit },
];
projectsRouter.get('/facets', wrap(async (_req, res) => {
  const [technologies, languages, databases, licenses, degrees, appTypes, difficulty, sourceTypes] = await Promise.all([
    Project.aggregate([
      { $match: { status: 'published' } }, { $unwind: '$technologies' },
      { $match: { technologies: { $nin: [/^hacktoberfest/i, /^hacktober/i, /^project$/i, /^projects$/i, /^open-?source$/i, /^github/i, /^awesome/i, ''] } } },
      { $group: { _id: { $toLower: '$technologies' }, name: { $first: '$technologies' }, n: { $sum: 1 } } }, { $sort: { n: -1 } }, { $limit: 40 },
      { $project: { _id: '$name', n: 1 } },
    ]), Project.aggregate(count('$language', false, 25)), Project.aggregate(count('$database', false, 12)),
    Project.aggregate(count('$source.license', false, 12)), Project.aggregate(count('$degreeLevels', true, 12)), Project.aggregate(count('$appType', false, 12)),
    Project.aggregate(count('$difficulty')), Project.aggregate(count('$source.type')),
  ]);
  const m = (a: any[]) => a.map((x) => ({ name: x._id, count: x.n }));
  res.json({ technologies: m(technologies), languages: m(languages), databases: m(databases), licenses: m(licenses), degrees: m(degrees), appTypes: m(appTypes), difficulty: m(difficulty), sourceTypes: m(sourceTypes) });
}));

/** README for a project: admin-written > fetched from the original GitHub repo (cached) > clearly-labelled generic fallback. */
projectsRouter.get('/:slug/readme', wrap(async (req, res) => {
  const p = await Project.findOne({ slug: req.params.slug, status: 'published' }); if (!p) throw notFound('Project not found');
  let src: 'admin' | 'github' | 'generated' = 'generated'; let markdown = '';
  if (p.readme?.content) { markdown = p.readme.content; src = (p.readme.source || 'admin') as 'admin' | 'github'; }
  else {
    const fetched = p.source?.type === 'external-link' ? await fetchReadme(p.source?.repoUrl) : null;
    if (fetched) { p.readme = { content: fetched, source: 'github', fetchedAt: new Date() }; await p.save(); markdown = fetched; src = 'github'; }
    else markdown = generateReadme(p.toObject() as any);
  }
  res.json({ markdown: stripCloneSteps(markdown), source: src, repoUrl: p.source?.repoUrl ?? null });
}));

projectsRouter.get('/:slug', wrap(async (req, res) => {
  const p = await Project.findOneAndUpdate({ slug: req.params.slug, status: 'published' }, { $inc: { views: 1 } }, { new: true }).populate('category', 'name slug').lean();
  if (!p) throw notFound('Project not found');
  const related = await Project.find({ status: 'published', _id: { $ne: p._id }, $or: [{ appType: p.appType }, { technologies: { $in: p.technologies } }] }).select(LIST_FIELDS).limit(3).lean();
  res.json({ project: { ...p, setupGuide: undefined, purchasable: !p.isFree && (await isPurchasable(p)) }, related }); // setup guide is private to purchasers
}));
