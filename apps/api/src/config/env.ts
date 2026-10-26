import { z } from 'zod';

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(4000),
  CLIENT_URL: z.string().url().default('http://localhost:5173'),
  MONGODB_URI: z.string().min(1, 'MONGODB_URI is required'),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  CASHFREE_APP_ID: z.string().optional(),
  CASHFREE_SECRET_KEY: z.string().optional(),
  CASHFREE_ENV: z.enum(['production', 'sandbox']).optional(), // default: inferred from the secret key (cfsk_ma_test_… = sandbox)
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

/** Browser origins allowed by CORS (REST + Socket.IO): the configured client plus the deployed Vercel frontend. */
export const allowedOrigins = [...new Set([env.CLIENT_URL, 'https://fork-it-1i7b.vercel.app'])];
