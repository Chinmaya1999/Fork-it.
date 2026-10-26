import { Schema, model } from 'mongoose';
const auditSchema = new Schema({
  user: { type: Schema.Types.ObjectId, ref: 'User', index: true }, order: { type: Schema.Types.ObjectId, ref: 'Order', index: true },
  file: { type: Schema.Types.ObjectId, ref: 'ProjectFile', index: true }, ip: String, userAgent: String,
}, { timestamps: { createdAt: true, updatedAt: false } });
export const DownloadAudit = model('DownloadAudit', auditSchema);
