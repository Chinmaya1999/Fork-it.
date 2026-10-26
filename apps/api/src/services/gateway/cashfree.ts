import crypto from 'node:crypto';
import type { Gateway, PaymentInfo } from './types.js';

const HOSTS = { production: 'https://api.cashfree.com/pg', sandbox: 'https://sandbox.cashfree.com/pg' } as const;
export type CashfreeMode = keyof typeof HOSTS;
const rupees = (paise: number) => (paise / 100).toFixed(2);
const toPaise = (r: number | string) => Math.round(Number(r) * 100);
const STATUS: Record<string, string> = { SUCCESS: 'captured', FAILED: 'failed', USER_DROPPED: 'failed', CANCELLED: 'failed', NOT_ATTEMPTED: 'created', PENDING: 'created' };
const toInfo = (orderId: string, p: any): PaymentInfo => ({ id: String(p.cf_payment_id), orderId, status: STATUS[p.payment_status] ?? 'created', amountPaise: toPaise(p.payment_amount) });

/** Cashfree sends base64(HMAC-SHA256(timestamp + rawBody, secret)) in x-webhook-signature. */
export const cashfreeWebhookSignature = (secret: string, timestamp: string, raw: Buffer) => crypto.createHmac('sha256', secret).update(timestamp + raw.toString('utf8')).digest('base64');

/** Cashfree PG adapter (API 2023-08-01). Secrets stay on the server; amounts are integer paise internally and rupees on the wire. The browser never signs anything: the server asks Cashfree for the truth. */
export function cashfreeGateway(appId: string, secretKey: string, mode: CashfreeMode): Gateway {
  const call = async (path: string, init?: RequestInit) => {
    const res = await fetch(HOSTS[mode] + path, { ...init, headers: { 'x-client-id': appId, 'x-client-secret': secretKey, 'x-api-version': '2023-08-01', 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(15000) });
    const data: any = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(`Cashfree ${res.status}: ${data?.message ?? 'request failed'}`);
    return data;
  };
  const list = async (orderId: string): Promise<PaymentInfo[]> => { const r = await call(`/orders/${encodeURIComponent(orderId)}/payments`); return (Array.isArray(r) ? r : []).map((p) => toInfo(orderId, p)); };
  return {
    name: 'cashfree', mode,
    async createOrder({ amountPaise, receipt, customer, returnUrl }) {
      const o = await call('/orders', { method: 'POST', body: JSON.stringify({
        order_id: receipt, order_amount: Number(rupees(amountPaise)), order_currency: 'INR',
        customer_details: { customer_id: customer?.id ?? 'guest', customer_name: customer?.name, customer_email: customer?.email, customer_phone: customer?.phone ?? '9999999999' }, // Cashfree requires a phone; we do not collect one
        ...(returnUrl?.startsWith('https://') && { order_meta: { return_url: returnUrl } }),
      }) });
      return { id: o.order_id as string, sessionId: o.payment_session_id as string };
    },
    listPayments: list,
    async fetchPayment(paymentId, orderId) { if (!orderId) return null; try { return toInfo(orderId, await call(`/orders/${encodeURIComponent(orderId)}/payments/${encodeURIComponent(paymentId)}`)); } catch { return null; } },
    async refund({ amountPaise, orderId }) {
      const refundId = `rf_${orderId}_${crypto.randomBytes(4).toString('hex')}`;
      const r = await call(`/orders/${encodeURIComponent(orderId!)}/refunds`, { method: 'POST', body: JSON.stringify({ refund_id: refundId, refund_amount: Number(rupees(amountPaise)), refund_speed: 'STANDARD' }) });
      return { id: String(r.cf_refund_id ?? refundId) };
    },
  };
}
