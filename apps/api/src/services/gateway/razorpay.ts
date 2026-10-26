import crypto from 'node:crypto';
import type { Gateway, PaymentInfo } from './types.js';

const BASE = 'https://api.razorpay.com/v1';
export const hmac = (secret: string, data: string | Buffer) => crypto.createHmac('sha256', secret).update(data).digest('hex');
export const safeEqual = (a: string, b: string) => a.length === b.length && crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));

/** Razorpay REST adapter. Secrets stay on the server; amounts are integer paise. */
export function razorpayGateway(keyId: string, keySecret: string): Gateway {
  const auth = 'Basic ' + Buffer.from(`${keyId}:${keySecret}`).toString('base64');
  const call = async (path: string, init?: RequestInit) => {
    const res = await fetch(BASE + path, { ...init, headers: { Authorization: auth, 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(15000) });
    const data: any = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(`Razorpay ${res.status}: ${data?.error?.description ?? 'request failed'}`);
    return data;
  };
  return {
    name: 'razorpay', keyId,
    async createOrder({ amountPaise, receipt }) { const o = await call('/orders', { method: 'POST', body: JSON.stringify({ amount: amountPaise, currency: 'INR', receipt }) }); return { id: o.id as string }; },
    verifySignature: ({ orderId, paymentId, signature }) => safeEqual(hmac(keySecret, `${orderId}|${paymentId}`), signature),
    async fetchPayment(paymentId): Promise<PaymentInfo | null> { try { const p = await call(`/payments/${encodeURIComponent(paymentId)}`); return { id: p.id, orderId: p.order_id, status: p.status, amountPaise: p.amount }; } catch { return null; } },
    async capturePayment({ paymentId, amountPaise }) { await call(`/payments/${encodeURIComponent(paymentId)}/capture`, { method: 'POST', body: JSON.stringify({ amount: amountPaise, currency: 'INR' }) }); },
    async refund({ paymentId, amountPaise }) { const r = await call(`/payments/${encodeURIComponent(paymentId)}/refund`, { method: 'POST', body: JSON.stringify({ amount: amountPaise }) }); return { id: r.id as string }; },
  };
}
