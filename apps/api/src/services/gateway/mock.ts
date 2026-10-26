import crypto from 'node:crypto';
import type { Gateway, PaymentInfo } from './types.js';
import { hmac, safeEqual } from './razorpay.js';

/**
 * DEVELOPMENT-ONLY gateway used when no Razorpay keys are configured (never active in production).
 * It uses the same signature scheme and the same server-side verification path as the real gateway,
 * so the fulfilment logic is exercised for real; only the card UI is simulated.
 */
const secret = () => crypto.createHash('sha256').update('mock-gateway:' + (process.env.JWT_SECRET ?? '')).digest('hex');
const captured = new Map<string, PaymentInfo>(); // in-memory "gateway ledger" (dev only)

export const mockSign = (orderId: string, paymentId: string) => hmac(secret(), `${orderId}|${paymentId}`);
export const mockRecordPayment = (p: PaymentInfo) => { captured.set(p.id, p); };
export const mockGateway: Gateway = {
  name: 'mock',
  async createOrder() { return { id: `mock_order_${crypto.randomBytes(8).toString('hex')}` }; },
  verifySignature: ({ orderId, paymentId, signature }) => safeEqual(mockSign(orderId, paymentId), signature),
  async fetchPayment(id) { return captured.get(id) ?? null; },
  async refund() { return { id: `mock_rfnd_${crypto.randomBytes(6).toString('hex')}` }; },
};
