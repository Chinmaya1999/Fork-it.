import { Router } from 'express';
import mongoose from 'mongoose';
import { requireAuth } from '../../middleware/auth.js';
import { wrap } from '../../utils/async.js';
import { notFound } from '../../utils/errors.js';
import { User } from '../../models/User.js';
import { Project } from '../../models/Project.js';

export const meRouter = Router();
meRouter.use(requireAuth);
const FIELDS = 'language title slug summary category appType technologies difficulty pricePaise isFree thumbnail verification source.type source.license featured createdAt degreeLevels';

meRouter.get('/bookmarks', wrap(async (req, res) => {
  const u = await User.findById(req.user!.id).select('bookmarks').lean();
  const ids = (u?.bookmarks ?? []).map(String);
  const items = await Project.find({ _id: { $in: ids }, status: 'published' }).select(FIELDS).populate('category', 'name slug').lean(); // unpublished items are hidden
  res.json({ ids, items });
}));

meRouter.put('/bookmarks/:id', wrap(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id) || !(await Project.exists({ _id: req.params.id, status: 'published' }))) throw notFound('Project not found');
  await User.updateOne({ _id: req.user!.id }, { $addToSet: { bookmarks: req.params.id } }); // idempotent
  res.json({ ok: true });
}));

meRouter.delete('/bookmarks/:id', wrap(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) throw notFound();
  await User.updateOne({ _id: req.user!.id }, { $pull: { bookmarks: req.params.id } });
  res.json({ ok: true });
}));
