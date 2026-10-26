import type { Request, Response } from 'express';
import crypto from 'node:crypto';
import { Order } from '../../models/Order.js';
import { WebhookEvent } from '../../models/WebhookEvent.js';
import { confirmPayment, markFailedFromGateway } from '../../services/payments.js';
import { cashfreeWebhookSignature } from '../../services/gateway/cashfree.js';
import { safeEqual } from '../../services/gateway/razorpay.js';
import { logger } from '../../utils/logger.js';
import { HttpError } from '../../utils/errors.js';
import { env } from '../../config/env.js';

/** Mounted with express.raw BEFORE the JSON parser: Cashfree signs timestamp + the exact bytes it sent, using the API secret key. */
export async function cashfreeWebhook(req: Request, res: Response) {
  const secret = env.CASHFREE_SECRET_KEY;
  if (!secret) return res.status(503).json({ error: { code: 'webhook_unconfigured', message: 'Cashfree is not configured' } });
  const raw = req.body as Buffer; const sig = String(req.get('x-webhook-signature') ?? ''); const ts = String(req.get('x-webhook-timestamp') ?? '');
  if (!Buffer.isBuffer(raw) || !sig || !ts || !safeEqual(cashfreeWebhookSignature(secret, ts, raw), sig)) return res.status(400).json({ error: { code: 'bad_signature', message: 'Invalid signature' } });

  const event = JSON.parse(raw.toString('utf8')); const pay = event.data?.payment; const orderId = event.data?.order?.order_id;
  const eventId = `cf_${crypto.createHash('sha256').update(raw).digest('hex')}`;
  try { await WebhookEvent.create({ eventId, type: event.type }); } catch (e: any) { if (e?.code === 11000) return res.json({ ok: true, duplicate: true }); throw e; } // duplicate delivery: no second fulfilment
  try {
    if (event.type === 'PAYMENT_SUCCESS_WEBHOOK' && orderId && pay?.cf_payment_id) {
      const o = await Order.findOne({ gatewayOrderId: orderId });
      if (o) await confirmPayment(String(o._id), String(pay.cf_payment_id), { source: 'webhook' }); // re-reads the payment from Cashfree instead of trusting the payload amount
    } else if (event.type === 'PAYMENT_FAILED_WEBHOOK' && orderId && pay?.cf_payment_id) await markFailedFromGateway(orderId, String(pay.cf_payment_id), pay.payment_message ?? 'payment failed');
    res.json({ ok: true });
  } catch (err) {
    if (err instanceof HttpError && err.status < 500) { logger.warn({ eventId, reason: err.message }, 'webhook rejected by business rules'); return res.json({ ok: false, ignored: true }); }
    await WebhookEvent.deleteOne({ eventId }); logger.error({ err, eventId }, 'webhook processing failed'); res.status(500).json({ error: { code: 'processing_failed', message: 'Will be retried' } });
  }
}
