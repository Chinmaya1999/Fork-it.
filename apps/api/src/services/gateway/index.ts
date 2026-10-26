import { env, isProd } from '../../config/env.js';
import type { Gateway } from './types.js';
import { razorpayGateway } from './razorpay.js';
import { mockGateway } from './mock.js';

/** The sandbox lets anyone "pay" without money, so it is limited to non-production AND a localhost client URL: a deploy that forgets NODE_ENV=production can never expose it. */
export const sandboxAllowed = () => {
  if (isProd) return false;
  try { return ['localhost', '127.0.0.1', '[::1]'].includes(new URL(env.CLIENT_URL).hostname); } catch { return false; }
};

let override: Gateway | null | undefined;
export const setGatewayForTests = (g: Gateway | null | undefined) => { override = g; };

/** Razorpay when keys exist; the dev test gateway otherwise (never in production); null = payments unavailable. */
export function getGateway(): Gateway | null {
  if (override !== undefined) return override;
  if (env.RAZORPAY_KEY_ID && env.RAZORPAY_KEY_SECRET) return razorpayGateway(env.RAZORPAY_KEY_ID, env.RAZORPAY_KEY_SECRET);
  return sandboxAllowed() ? mockGateway : null;
}
