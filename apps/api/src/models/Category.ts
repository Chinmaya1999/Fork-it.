import { Schema, model } from 'mongoose';
const categorySchema = new Schema({
  name: { type: String, required: true, trim: true },
  slug: { type: String, required: true, unique: true, lowercase: true },
  description: { type: String, default: '' },
  icon: { type: String, default: 'Folder' },
  order: { type: Number, default: 0 },
}, { timestamps: true });
export const Category = model('Category', categorySchema);
