// Re-applies difficulty / degree / pricing heuristics to imported third-party listings (not samples, not admin-edited ones if you set `locked`).
import mongoose from 'mongoose';
import { env } from '../config/env.js';
import { Project } from '../models/Project.js';
import { difficultyFor, degreesFor, priceFor, classify } from '../integrations/classify.js';

await mongoose.connect(env.MONGODB_URI);
const ops: any[] = [];
for await (const p of Project.find({ isSample: false, 'source.type': 'external-link' }).lean()) {
  const text = `${p.title} ${p.technologies.join(' ')} ${p.summary}`;
  const { appType } = classify(text);
  const difficulty = difficultyFor(text, p.appType ?? appType);
  const pricePaise = priceFor(difficulty, p.source?.stars ?? 0);
  ops.push({ updateOne: { filter: { _id: p._id }, update: { $set: { difficulty, degreeLevels: degreesFor(difficulty, p.appType), pricePaise, isFree: pricePaise === 0 } } } });
}
const r = await Project.bulkWrite(ops);
console.log(`Repriced ${r.modifiedCount} listings`);
await mongoose.disconnect();
