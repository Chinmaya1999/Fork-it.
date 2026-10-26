import { Schema, model } from 'mongoose';
const auditSchema = new Schema({
  actor: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  actorEmail: String,
  action: { type: String, required: true, index: true },
  targetType: String, targetId: String,
  meta: Schema.Types.Mixed,
  ip: String,
}, { timestamps: { createdAt: true, updatedAt: false } });
auditSchema.index({ createdAt: -1 });
export const AuditLog = model('AuditLog', auditSchema);
