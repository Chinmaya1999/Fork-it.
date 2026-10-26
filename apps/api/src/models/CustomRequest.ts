import { Schema, model } from 'mongoose';
import { APP_TYPES, CUSTOM_STATUSES, DEGREE_LEVELS } from '@projectforge/shared';

const historySchema = new Schema({ status: String, by: { type: Schema.Types.ObjectId, ref: 'User' }, role: String, note: { type: String, maxlength: 500 }, at: { type: Date, default: Date.now } }, { _id: false });
const customSchema = new Schema({
  ref: { type: String, required: true, unique: true },
  user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  title: { type: String, required: true, trim: true, maxlength: 140 },
  idea: { type: String, required: true, maxlength: 5000 },
  abstract: { type: String, default: '', maxlength: 5000 },
  degree: { type: String, enum: DEGREE_LEVELS }, department: { type: String, maxlength: 100 },
  appType: { type: String, enum: APP_TYPES, default: 'web' },
  preferredTech: [String], features: [String], roles: [String],
  databaseReq: { type: String, maxlength: 300 }, references: [String],
  deadline: Date, budgetRange: { type: String, maxlength: 60 },
  docsRequired: { type: String, maxlength: 500 }, deploymentReq: { type: String, maxlength: 500 }, notes: { type: String, maxlength: 2000 },
  status: { type: String, enum: CUSTOM_STATUSES, default: 'submitted', index: true },
  assignedTo: { type: Schema.Types.ObjectId, ref: 'User', index: true },
  // terms frozen at quotation acceptance — later quotation edits can never change what was agreed
  agreed: { quotation: { type: Schema.Types.ObjectId, ref: 'Quotation' }, totalPaise: Number, advancePaise: Number, finalPaise: Number, revisionLimit: Number, supportDays: Number, finalPaymentCondition: String },
  revisionsUsed: { type: Number, default: 0 },
  studentApproved: { type: Boolean, default: false },
  statusBeforeDispute: String,
  history: { type: [historySchema], default: [] }, // bounded by the state machine (one entry per transition)
}, { timestamps: true });
customSchema.index({ status: 1, createdAt: -1 });
export const CustomRequest = model('CustomRequest', customSchema);
