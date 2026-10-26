import { Schema, model, type InferSchemaType } from 'mongoose';
import { ROLES, DEGREE_LEVELS } from '@projectforge/shared';

const userSchema = new Schema({
  name: { type: String, required: true, trim: true, maxlength: 80 },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  passwordHash: { type: String, required: true, select: false },
  role: { type: String, enum: ROLES, default: 'student', index: true },
  status: { type: String, enum: ['active', 'suspended'], default: 'active' },
  emailVerified: { type: Boolean, default: false },
  emailVerifyTokenHash: { type: String, select: false },
  resetTokenHash: { type: String, select: false },
  resetTokenExpires: { type: Date, select: false },
  tokenVersion: { type: Number, default: 0 },
  degree: { type: String, enum: DEGREE_LEVELS },
  college: { type: String, trim: true, maxlength: 160 },
  semester: { type: Number, min: 1, max: 12 },
  failedLogins: { type: Number, default: 0 },
  lockUntil: { type: Date },
  bookmarks: [{ type: Schema.Types.ObjectId, ref: 'Project' }],
}, { timestamps: true });

export type UserDoc = InferSchemaType<typeof userSchema> & { _id: import('mongoose').Types.ObjectId };
export const User = model('User', userSchema);
