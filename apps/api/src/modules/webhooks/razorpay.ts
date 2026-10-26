import type { Request, Response } from 'express';
import { Order } from '../../models/Order.js';
import { WebhookEvent } from '../../models/WebhookEvent.js';
import { confirmPayment, markFailedFromGateway } from '../../services/payments.js';
import { hmac, safeEqual } from '../../services/gateway/razorpay.js';
import { logger } from '../../utils/logger.js';
import crypto from 'node:crypto';
import { HttpError } from '../../utils/errors.js';

/** Mounted with express.raw BEFORE the JSON parser: the signature is computed over the exact bytes Razorpay sent. */
export async function razorpayWebhook(req: Request, res: Response) {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!secret) return res.status(503).json({ error: { code: 'webhook_unconfigured', message: 'Webhook secret not configured' } });
  const raw = req.body as Buffer; const sig = String(req.get('x-razorpay-signature') ?? '');
  if (!Buffer.isBuffer(raw) || !sig || !safeEqual(hmac(secret, raw), sig)) return res.status(400).json({ error: { code: 'bad_signature', message: 'Invalid signature' } });

  const event = JSON.parse(raw.toString('utf8')); const eventId = String(req.get('x-razorpay-event-id') ?? crypto.createHash('sha256').update(raw).digest('hex'));
  try { await WebhookEvent.create({ eventId, type: event.event }); } catch (e: any) { if (e?.code === 11000) return res.json({ ok: true, duplicate: true }); throw e; } // duplicate delivery: no second fulfilment
  try {
    const pay = event.payload?.payment?.entity;
    if ((event.event === 'payment.captured' || event.event === 'order.paid') && pay?.order_id) {
      const o = await Order.findOne({ gatewayOrderId: pay.order_id });
      if (o) await confirmPayment(String(o._id), pay.id, { source: 'webhook', webhookAmountPaise: pay.amount });
    } else if (event.event === 'payment.failed' && pay?.order_id) await markFailedFromGateway(pay.order_id, pay.id, pay.error_description ?? 'payment failed');
    res.json({ ok: true });
  } catch (err) {
    if (err instanceof HttpError && err.status < 500) { logger.warn({ eventId, reason: err.message }, 'webhook rejected by business rules'); return res.json({ ok: false, ignored: true }); } // a retry could never succeed: acknowledge, don't loop
    await WebhookEvent.deleteOne({ eventId }); logger.error({ err, eventId }, 'webhook processing failed'); res.status(500).json({ error: { code: 'processing_failed', message: 'Will be retried' } }); } // let Razorpay retry
}
