import { z } from 'zod';

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(4000),
  CLIENT_URL: z.string().url().default('http://localhost:5173'),
  MONGODB_URI: z.string().min(1, 'MONGODB_URI is required'),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  RAZORPAY_KEY_ID: z.string().optional(),
  RAZORPAY_KEY_SECRET: z.string().optional(),
  RAZORPAY_WEBHOOK_SECRET: z.string().optional(),
  GITHUB_TOKEN: z.string().optional(),
  STORAGE_DIR: z.string().default('./storage/private'),
  DOWNLOAD_LIMIT: z.coerce.number().int().min(1).default(10), // max downloads per file per purchase
  MAX_UPLOAD_MB: z.coerce.number().int().min(1).default(200),
});

export const env = schema.parse(process.env);
export const isProd = env.NODE_ENV === 'production';
