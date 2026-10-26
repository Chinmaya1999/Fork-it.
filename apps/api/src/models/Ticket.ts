import { Schema, model } from 'mongoose';
import { TICKET_CATEGORIES, TICKET_PRIORITIES, TICKET_STATUSES } from '@projectforge/shared';

const ticketSchema = new Schema({
  number: { type: String, required: true, unique: true },
  user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  order: { type: Schema.Types.ObjectId, ref: 'Order' }, project: { type: Schema.Types.ObjectId, ref: 'Project' }, customRequest: { type: Schema.Types.ObjectId, ref: 'CustomRequest' },
  subject: { type: String, required: true, trim: true, maxlength: 160 },
  description: { type: String, required: true, maxlength: 5000 },
  category: { type: String, enum: TICKET_CATEGORIES, default: 'other' },
  priority: { type: String, enum: TICKET_PRIORITIES, default: 'normal', index: true },
  status: { type: String, enum: TICKET_STATUSES, default: 'open', index: true },
  assignedTo: { type: Schema.Types.ObjectId, ref: 'User', index: true },
  resolution: { type: String, maxlength: 2000 },
  resolvedAt: Date, closedAt: Date, reopenCount: { type: Number, default: 0 },
  lastActivityAt: { type: Date, default: Date.now },
  firstResponseAt: Date, // SLA field
}, { timestamps: true });
ticketSchema.index({ status: 1, lastActivityAt: -1 });
ticketSchema.index({ subject: 'text', description: 'text' }, { default_language: 'none', language_override: 'textLanguage' });
export const Ticket = model('Ticket', ticketSchema);

const replySchema = new Schema({
  ticket: { type: Schema.Types.ObjectId, ref: 'Ticket', required: true, index: true },
  author: { type: Schema.Types.ObjectId, ref: 'User' }, authorRole: { type: String, enum: ['student', 'staff', 'system'], required: true },
  kind: { type: String, enum: ['message', 'system'], default: 'message' },
  body: { type: String, required: true, maxlength: 5000 },
  internal: { type: Boolean, default: false }, // staff-only note: NEVER returned to students
}, { timestamps: { createdAt: true, updatedAt: false } });
export const TicketReply = model('TicketReply', replySchema);
