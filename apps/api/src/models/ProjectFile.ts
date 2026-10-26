import { Schema, model } from 'mongoose';
const fileSchema = new Schema({
  project: { type: Schema.Types.ObjectId, ref: 'Project', index: true },
  customRequest: { type: Schema.Types.ObjectId, ref: 'CustomRequest', index: true },
  label: { type: String, required: true, maxlength: 120 },
  kind: { type: String, enum: ['source', 'database', 'docs', 'other'], default: 'source' },
  version: { type: String, default: '1.0.0' },
  originalName: { type: String, required: true },
  storageKey: { type: String, required: true, select: false }, // never serialised to clients
  sizeBytes: { type: Number, required: true },
  sha256: { type: String, required: true },
  uploadedBy: { type: Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });
export const ProjectFile = model('ProjectFile', fileSchema);
