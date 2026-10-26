import { Schema, model } from 'mongoose';
import { APP_TYPES, DEGREE_LEVELS, DIFFICULTIES, SOURCE_TYPES, VERIFICATION, PUBLICATION } from '@projectforge/shared';

const projectSchema = new Schema({
  title: { type: String, required: true, trim: true, maxlength: 140 },
  slug: { type: String, required: true, unique: true, lowercase: true },
  summary: { type: String, required: true, maxlength: 300 },
  description: { type: String, default: '' },
  abstract: { type: String, default: '' },
  features: [String],
  category: { type: Schema.Types.ObjectId, ref: 'Category', required: true, index: true },
  appType: { type: String, enum: APP_TYPES, required: true },
  degreeLevels: [{ type: String, enum: DEGREE_LEVELS }],
  technologies: [{ type: String, trim: true }],
  language: String, framework: String, database: String,
  difficulty: { type: String, enum: DIFFICULTIES, default: 'intermediate' },
  prerequisites: [String],
  requirements: { hardware: [String], software: [String] },
  pricePaise: { type: Number, required: true, min: 0, default: 0 }, // integer paise
  isFree: { type: Boolean, default: false, index: true },
  screenshots: [String],
  thumbnail: String,
  demoUrl: String,
  videoUrl: String,
  source: {
    type: { type: String, enum: SOURCE_TYPES, default: 'original' },
    repoUrl: String,
    author: String,
    license: String,           // SPDX id or 'NONE'
    redistributionAllowed: { type: Boolean, default: false },
    attribution: String,
    licenseReviewed: { type: Boolean, default: false },
    stars: Number,
    repoUpdatedAt: Date,
  },
  readme: { content: { type: String, default: '', maxlength: 200_000 }, source: { type: String, enum: ['admin', 'github', ''], default: '' }, fetchedAt: Date },
  setupGuide: { type: String, default: '', maxlength: 200_000 }, // private: shown only to purchasers
  version: { type: String, default: '1.0.0' },
  changelog: [{ version: String, date: Date, notes: String }],
  supportPolicy: String,
  verification: { type: String, enum: VERIFICATION, default: 'unverified' },
  lastTestedAt: Date,
  status: { type: String, enum: PUBLICATION, default: 'draft', index: true },
  isSample: { type: Boolean, default: false },
  views: { type: Number, default: 0 },
  downloads: { type: Number, default: 0 },
  featured: { type: Boolean, default: false },
}, { timestamps: true });

// `language` is a data field (e.g. "PHP"), so tell Mongo NOT to treat it as the text-search language override.
projectSchema.index({ title: 'text', summary: 'text', technologies: 'text' }, { language_override: 'textLanguage', default_language: 'none' });
projectSchema.index({ status: 1, appType: 1, difficulty: 1, pricePaise: 1 });
projectSchema.index({ status: 1, technologies: 1 });
projectSchema.index({ status: 1, createdAt: -1 });

// Business rule: a project may only be hosted/sold when its license permits redistribution.
projectSchema.pre('validate', function (next) {
  if (this.source?.type === 'authorized-redistribution' && !(this.source.redistributionAllowed && this.source.licenseReviewed)) {
    this.invalidate('source.license', 'Authorized redistribution requires a reviewed license that permits redistribution');
  }
  this.isFree = this.pricePaise === 0;
  next();
});

export const Project = model('Project', projectSchema);
