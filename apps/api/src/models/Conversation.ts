import { Schema, model } from 'mongoose';
const convSchema = new Schema({
  user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true }, // the student
  kind: { type: String, enum: ['general', 'custom'], default: 'general' },
  customRequest: { type: Schema.Types.ObjectId, ref: 'CustomRequest' },
  title: { type: String, maxlength: 140 },
  lastMessageAt: { type: Date, default: Date.now }, lastMessagePreview: { type: String, default: '' },
  unreadForUser: { type: Number, default: 0 }, unreadForStaff: { type: Number, default: 0 },
  lastReadByUser: Date, lastReadByStaff: Date,
}, { timestamps: true });
convSchema.index({ user: 1, kind: 1, customRequest: 1 }, { unique: true }); // exactly one general thread per student, one per custom request
convSchema.index({ lastMessageAt: -1 });
export const Conversation = model('Conversation', convSchema);

const msgSchema = new Schema({
  conversation: { type: Schema.Types.ObjectId, ref: 'Conversation', required: true },
  sender: { type: Schema.Types.ObjectId, ref: 'User', required: true }, senderRole: { type: String, enum: ['student', 'staff'], required: true },
  body: { type: String, required: true, maxlength: 2000 },
}, { timestamps: { createdAt: true, updatedAt: false } });
msgSchema.index({ conversation: 1, createdAt: -1 });
export const Message = model('Message', msgSchema);
