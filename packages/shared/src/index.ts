import { z } from 'zod';

export const ROLES = ['student', 'admin', 'support', 'developer'] as const;
export type Role = (typeof ROLES)[number];

export const APP_TYPES = ['web', 'mobile', 'desktop', 'ai-ml', 'data-science', 'cybersecurity', 'cloud-devops', 'iot', 'blockchain', 'enterprise', 'research', 'other'] as const;
export const DEGREE_LEVELS = ['BCA', 'MCA', 'B.Tech', 'M.Tech', 'B.Sc CS', 'M.Sc CS', 'BE CSE/IT', 'Diploma', 'Other'] as const;
export const DIFFICULTIES = ['beginner', 'intermediate', 'advanced'] as const;
export const SOURCE_TYPES = ['original', 'authorized-redistribution', 'external-link'] as const;
export const VERIFICATION = ['unverified', 'verified'] as const;
export const PUBLICATION = ['draft', 'published', 'unpublished'] as const;

export const registerSchema = z.object({
  name: z.string().trim().min(2).max(80),
  email: z.string().trim().toLowerCase().email().max(200),
  password: z.string().min(10, 'At least 10 characters').max(128),
  degree: z.enum(DEGREE_LEVELS).optional(),
  college: z.string().trim().max(160).optional(),
});
export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(1).max(128),
});
export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;

export const projectQuerySchema = z.object({
  q: z.string().trim().max(100).optional(),
  category: z.string().trim().max(80).optional(),
  appType: z.enum(APP_TYPES).optional(),
  degree: z.enum(DEGREE_LEVELS).optional(),
  difficulty: z.enum(DIFFICULTIES).optional(),
  tech: z.string().trim().max(200).optional(), // comma-separated, matches ANY
  language: z.string().trim().max(40).optional(),
  database: z.string().trim().max(40).optional(),
  license: z.string().trim().max(40).optional(),
  sourceType: z.enum(SOURCE_TYPES).optional(),
  pricing: z.enum(['free', 'paid']).optional(),
  verified: z.enum(['true']).optional(),
  minPrice: z.coerce.number().int().min(0).optional(),
  maxPrice: z.coerce.number().int().min(0).optional(),
  sort: z.enum(['newest', 'price-asc', 'price-desc', 'popular']).default('newest'),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(48).default(12),
});
export type ProjectQuery = z.infer<typeof projectQuerySchema>;

export const formatINR = (paise: number) =>
  paise === 0 ? 'Free' : new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(paise / 100);

export const TICKET_CATEGORIES = ['installation', 'dependency', 'database', 'environment', 'bug', 'documentation', 'payment', 'download', 'custom_revision', 'other'] as const;
export const TICKET_STATUSES = ['open', 'in_progress', 'waiting_student', 'resolved', 'closed'] as const;
export const TICKET_PRIORITIES = ['low', 'normal', 'high', 'urgent'] as const;
export const CUSTOM_STATUSES = ['submitted', 'under_review', 'clarification', 'quoted', 'awaiting_advance', 'in_development', 'internal_testing', 'student_review', 'revision_requested', 'awaiting_final_payment', 'delivered', 'completed', 'rejected', 'cancelled', 'disputed'] as const;
export type CustomStatus = (typeof CUSTOM_STATUSES)[number];
export const ORDER_TYPES = ['project', 'custom_advance', 'custom_final'] as const;
export const ORDER_STATUSES = ['created', 'paid', 'failed', 'cancelled', 'refunded'] as const;
export const MILESTONE_STATUSES = ['pending', 'in_progress', 'completed'] as const;
