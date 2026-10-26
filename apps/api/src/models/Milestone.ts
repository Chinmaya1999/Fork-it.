import { Schema, model } from 'mongoose';
import { MILESTONE_STATUSES } from '@projectforge/shared';
const mSchema = new Schema({
  request: { type: Schema.Types.ObjectId, ref: 'CustomRequest', required: true, index: true },
  order: { type: Number, default: 0 },
  title: { type: String, required: true, maxlength: 120 }, description: { type: String, maxlength: 1000 }, deliverables: [String],
  dueDate: Date, status: { type: String, enum: MILESTONE_STATUSES, default: 'pending' },
  assignee: { type: Schema.Types.ObjectId, ref: 'User' }, progressNotes: { type: String, maxlength: 2000 }, completedAt: Date,
  comments: { type: [new Schema({ author: { type: Schema.Types.ObjectId, ref: 'User' }, role: String, body: { type: String, maxlength: 1000 }, at: { type: Date, default: Date.now } }, { _id: false })], default: [], validate: (a: unknown[]) => a.length <= 100 },
}, { timestamps: true });
export const Milestone = model('Milestone', mSchema);
