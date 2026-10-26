import { Schema, model } from 'mongoose';
const qSchema = new Schema({
  request: { type: Schema.Types.ObjectId, ref: 'CustomRequest', required: true, index: true },
  version: { type: Number, required: true },
  totalPaise: { type: Number, required: true, min: 100, validate: Number.isInteger },
  advancePercent: { type: Number, required: true, min: 1, max: 100 },
  advancePaise: { type: Number, required: true }, finalPaise: { type: Number, required: true },
  deliveryDays: { type: Number, required: true, min: 1, max: 730 },
  scope: { type: String, required: true, maxlength: 8000 },
  deliverables: [String],
  milestones: [{ title: { type: String, required: true, maxlength: 120 }, description: { type: String, maxlength: 1000 }, dueInDays: { type: Number, min: 0, max: 730 }, _id: false }],
  revisionLimit: { type: Number, default: 2, min: 0, max: 20 }, supportDays: { type: Number, default: 30, min: 0, max: 365 },
  finalPaymentCondition: { type: String, required: true, maxlength: 600 }, cancellationTerms: { type: String, maxlength: 1500 }, refundTerms: { type: String, maxlength: 1500 },
  status: { type: String, enum: ['sent', 'accepted', 'declined', 'superseded'], default: 'sent' },
  createdBy: { type: Schema.Types.ObjectId, ref: 'User' }, respondedAt: Date, declineReason: { type: String, maxlength: 500 },
}, { timestamps: true });
qSchema.index({ request: 1, version: 1 }, { unique: true });
export const Quotation = model('Quotation', qSchema);
