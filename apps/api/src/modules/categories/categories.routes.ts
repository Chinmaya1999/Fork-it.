import { Router } from 'express';
import { Category } from '../../models/Category.js';
import { Project } from '../../models/Project.js';
import { wrap } from '../../utils/async.js';
export const categoriesRouter = Router();
categoriesRouter.get('/', wrap(async (_req, res) => {
  const counts = await Project.aggregate([{ $match: { status: 'published' } }, { $group: { _id: '$category', n: { $sum: 1 } } }]);
  const map = new Map(counts.map((c) => [String(c._id), c.n]));
  const cats = await Category.find().sort({ order: 1 }).lean();
  res.json({ items: cats.map((c) => ({ ...c, projectCount: map.get(String(c._id)) ?? 0 })) });
}));
