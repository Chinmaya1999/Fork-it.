import { Schema, model } from 'mongoose';
const notifSchema = new Schema({
  user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  type: { type: String, required: true },
  title: { type: String, required: true, maxlength: 160 },
  body: { type: String, default: '', maxlength: 500 },
  link: String,
  readAt: Date,
  dedupeKey: String,
}, { timestamps: { createdAt: true, updatedAt: false } });
notifSchema.index({ user: 1, createdAt: -1 });
notifSchema.index({ user: 1, dedupeKey: 1 }, { unique: true, partialFilterExpression: { dedupeKey: { $type: 'string' } } }); // duplicate events cannot double-notify
export const Notification = model('Notification', notifSchema);
