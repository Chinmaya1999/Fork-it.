import type { Types } from 'mongoose';
import { Order } from '../models/Order.js';
import { Payment } from '../models/Payment.js';
import { Refund } from '../models/Refund.js';
import { nextSeq } from '../models/Counter.js';
import { badRequest, HttpError } from '../utils/errors.js';
import { getGateway } from './gateway/index.js';
import { notify, notifyStaff } from './notify.js';
import { formatINR } from '@projectforge/shared';

type PaidHook = (order: any) => Promise<void>;
const hooks = new Map<string, PaidHook>();
/** Feature modules (e.g. custom requests) register what must happen once an order is VERIFIED paid. */
export const onOrderPaid = (type: string, fn: PaidHook) => { hooks.set(type, fn); };
export const onOrderRefunded = (type: string, fn: PaidHook) => { hooks.set(`refund:${type}`, fn); };

export interface CheckoutInput { userId: string; type: 'project' | 'custom_advance' | 'custom_final'; title: string; amountPaise: number; project?: Types.ObjectId | string; customRequest?: Types.ObjectId | string }

/** Creates (or reuses) a pending order with a SERVER-calculated amount and opens a gateway order. */
export async function createCheckout(i: CheckoutInput) {
  const gw = getGateway(); if (!gw) throw new HttpError(503, 'Payments are not configured on this server', 'payments_unavailable');
  if (!Number.isInteger(i.amountPaise) || i.amountPaise < 1) throw badRequest('Invalid amount');
  const key = { user: i.userId, type: i.type, ...(i.project && { project: i.project }), ...(i.customRequest && { customRequest: i.customRequest }) };
  let order = await Order.findOne({ ...key, status: { $in: ['created', 'failed'] } }).sort({ createdAt: -1 });
  if (order && (order.amountPaise !== i.amountPaise || order.gateway !== gw.name)) { order.status = 'cancelled'; await order.save(); order = null; } // price changed: never reuse a stale order
  if (!order) {
    const ref = `PF-${String(await nextSeq('order')).padStart(6, '0')}`;
    const g = await gw.createOrder({ amountPaise: i.amountPaise, receipt: ref });
    order = await Order.create({ ...key, ref, title: i.title, amountPaise: i.amountPaise, gateway: gw.name, gatewayOrderId: g.id });
  } else if (order.status === 'failed') { order.status = 'created'; await order.save(); }
  return { order, checkout: { provider: gw.name, keyId: gw.keyId, gatewayOrderId: order.gatewayOrderId!, amountPaise: order.amountPaise, currency: 'INR', description: order.title, orderId: String(order._id) } };
}

/**
 * The ONLY place an order becomes "paid". Requires: valid gateway signature (client path), gateway-confirmed capture,
 * matching order id and amount. Idempotent: the state transition is atomic, so side effects run exactly once.
 */
export async function confirmPayment(orderId: string, paymentId: string, opts: { signature?: string; source: 'client_verify' | 'webhook' | 'reconcile'; webhookAmountPaise?: number }) {
  const order = await Order.findById(orderId); if (!order) throw new HttpError(404, 'Order not found', 'not_found');
  if (order.status === 'paid') return { order, alreadyPaid: true };
  if (order.status === 'refunded') throw badRequest('This order can no longer be paid');
  // A 'cancelled' order (e.g. price changed after checkout opened) is still fulfilled if the gateway proves the customer paid exactly that order's amount: never keep money without delivering.
  const gw = getGateway(); if (!gw || gw.name !== order.gateway) throw new HttpError(503, 'Payment gateway unavailable', 'payments_unavailable');

  if (opts.source === 'client_verify') { // browsers are untrusted: signature is mandatory
    if (!opts.signature || !gw.verifySignature({ orderId: order.gatewayOrderId!, paymentId, signature: opts.signature })) { await recordFailure(order, paymentId, 'signature mismatch'); throw badRequest('Payment signature could not be verified'); }
  }
  let amount = opts.webhookAmountPaise; // webhook payloads are HMAC-verified by the caller
  if (opts.source !== 'webhook' || amount === undefined) {
    let info = await gw.fetchPayment(paymentId); // trusted gateway data, not browser data
    if (info?.status === 'authorized' && info.orderId === order.gatewayOrderId && info.amountPaise === order.amountPaise && gw.capturePayment) { // manual-capture accounts: capture only after order + amount match
      try { await gw.capturePayment({ paymentId, amountPaise: info.amountPaise }); } catch { /* may have been captured concurrently: re-read the truth below */ }
      info = await gw.fetchPayment(paymentId);
    }
    if (!info || info.orderId !== order.gatewayOrderId || info.status !== 'captured') throw badRequest('Payment is not confirmed by the gateway yet');
    amount = info.amountPaise;
  }
  if (amount !== order.amountPaise) { await recordFailure(order, paymentId, `amount mismatch (${amount} vs ${order.amountPaise})`); throw badRequest('Paid amount does not match the order'); }

  await Payment.findOneAndUpdate({ gatewayPaymentId: paymentId }, { $set: { order: order._id, gateway: order.gateway, gatewayOrderId: order.gatewayOrderId, amountPaise: amount, status: 'captured', signatureVerified: opts.source === 'client_verify', source: opts.source === 'reconcile' ? 'client_verify' : opts.source, capturedAt: new Date() } }, { upsert: true });
  const receiptNo = `PF-R-${new Date().getFullYear()}-${String(await nextSeq('receipt')).padStart(6, '0')}`;
  let won;
  try { won = await Order.findOneAndUpdate({ _id: order._id, status: { $in: ['created', 'failed', 'cancelled'] } }, { status: 'paid', paidAt: new Date(), receiptNo }, { new: true }); } // atomic transition
  catch (e: any) { if (e?.code !== 11000) throw e; await notifyStaff({ type: 'order_paid', title: 'Duplicate payment needs a refund', body: `${order.ref}: payment ${paymentId} captured but the user already owns this item. Refund it in the gateway dashboard.`, link: `/admin/orders/${order._id}`, dedupeKey: `dup-pay:${paymentId}` }); return { order: (await Order.findById(order._id))!, alreadyPaid: true }; }
  if (!won) return { order: (await Order.findById(order._id))!, alreadyPaid: true }; // lost a race with the webhook/another request: already fulfilled
  await hooks.get(won.type)?.(won);
  await notify(String(won.user), { type: 'payment_success', title: 'Payment received', body: `${won.title} — ${formatINR(won.amountPaise)} (receipt ${won.receiptNo})`, link: `/dashboard/orders/${won._id}`, dedupeKey: `paid:${won._id}`, email: true });
  await notifyStaff({ type: 'order_paid', title: 'New payment', body: `${won.ref} · ${won.title} · ${formatINR(won.amountPaise)}`, link: `/admin/orders/${won._id}`, dedupeKey: `staff-paid:${won._id}` });
  return { order: won, alreadyPaid: false };
}

async function recordFailure(order: any, paymentId: string, reason: string) {
  await Payment.findOneAndUpdate({ gatewayPaymentId: paymentId }, { $set: { order: order._id, gateway: order.gateway, gatewayOrderId: order.gatewayOrderId, amountPaise: order.amountPaise, status: 'failed', failureReason: reason, signatureVerified: false } }, { upsert: true });
  if (order.status === 'created') { order.status = 'failed'; await order.save(); } // recoverable: user can retry the same order
}
export const markFailedFromGateway = async (gatewayOrderId: string, paymentId: string, reason: string) => { const o = await Order.findOne({ gatewayOrderId }); if (o && o.status !== 'paid') await recordFailure(o, paymentId, reason); };

/** Admin refund through the gateway. Revokes access by moving the order to refunded (full) — partial amounts are tracked. */
export async function refundOrder(orderId: string, amountPaise: number | undefined, reason: string, adminId: string) {
  const order = await Order.findById(orderId); if (!order) throw new HttpError(404, 'Order not found', 'not_found');
  if (order.status !== 'paid') throw badRequest('Only paid orders can be refunded');
  const payment = await Payment.findOne({ order: order._id, status: 'captured' }); if (!payment?.gatewayPaymentId) throw badRequest('No captured payment found for this order');
  const remaining = order.amountPaise - order.refundedPaise; const amt = amountPaise ?? remaining;
  if (!Number.isInteger(amt) || amt < 1 || amt > remaining) throw badRequest(`Refund must be between ₹0.01 and ${formatINR(remaining)}`);
  const gw = getGateway(); if (!gw || gw.name !== order.gateway) throw new HttpError(503, 'Payment gateway unavailable', 'payments_unavailable');
  // Reserve the amount atomically BEFORE calling the gateway: a double-click or two admins can never refund the same money twice.
  const reserved = await Order.findOneAndUpdate({ _id: order._id, status: 'paid', refundedPaise: { $lte: order.amountPaise - amt } }, { $inc: { refundedPaise: amt } }, { new: true });
  if (!reserved) throw new HttpError(409, 'A refund for this order is already in progress or exceeds the remaining amount', 'conflict');
  let r: { id: string };
  try { r = await gw.refund({ paymentId: payment.gatewayPaymentId, amountPaise: amt }); }
  catch (e) { await Order.updateOne({ _id: order._id }, { $inc: { refundedPaise: -amt } }); throw e; } // gateway refused: release the reservation
  await Refund.create({ order: order._id, payment: payment._id, amountPaise: amt, reason, gatewayRefundId: r.id, createdBy: adminId });
  if (reserved.refundedPaise >= reserved.amountPaise) { order.status = 'refunded'; order.refundedPaise = reserved.refundedPaise; await Order.updateOne({ _id: order._id }, { status: 'refunded' }); await hooks.get(`refund:${order.type}`)?.(order); } else { order.refundedPaise = reserved.refundedPaise; }
  await notify(String(order.user), { type: 'refund', title: 'Refund processed', body: `${formatINR(amt)} refunded for ${order.title}.`, link: `/dashboard/orders/${order._id}`, email: true });
  return order;
}
