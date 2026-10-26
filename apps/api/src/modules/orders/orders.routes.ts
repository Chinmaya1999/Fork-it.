import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import mongoose from 'mongoose';
import { z } from 'zod';
import { requireAuth } from '../../middleware/auth.js';
import { wrap } from '../../utils/async.js';
import { badRequest, forbidden, HttpError, notFound } from '../../utils/errors.js';
import { User } from '../../models/User.js';
import { Project } from '../../models/Project.js';
import { ProjectFile } from '../../models/ProjectFile.js';
import { Order } from '../../models/Order.js';
import { Payment } from '../../models/Payment.js';
import { createCheckout, confirmPayment, markFailedFromGateway } from '../../services/payments.js';
import { getGateway } from '../../services/gateway/index.js';
import { mockRecordPayment, mockSign } from '../../services/gateway/mock.js';
import { isProd } from '../../config/env.js';
import crypto from 'node:crypto';

export const ordersRouter = Router();
ordersRouter.use(['/orders', '/payments'], requireAuth);
const moneyLimiter = rateLimit({ windowMs: 10 * 60_000, limit: process.env.NODE_ENV === 'test' ? 100_000 : 60, standardHeaders: true, legacyHeaders: false, message: { error: { code: 'rate_limited', message: 'Too many payment attempts. Please wait a few minutes.' } } });
ordersRouter.post(['/orders', '/orders/:id/verify', '/orders/:id/failed'], moneyLimiter);

export const isPurchasable = async (p: { _id: any; setupGuide?: string | null }) => !!p.setupGuide?.trim() || !!(await ProjectFile.exists({ project: p._id }));
const view = (o: any) => ({ id: String(o._id), ref: o.ref, type: o.type, title: o.title, amountPaise: o.amountPaise, status: o.status, createdAt: o.createdAt, paidAt: o.paidAt, receiptNo: o.receiptNo, refundedPaise: o.refundedPaise, project: o.project && typeof o.project === 'object' && o.project.slug ? { slug: o.project.slug, title: o.project.title } : undefined, customRequest: o.customRequest ? String(o.customRequest._id ?? o.customRequest) : undefined });

ordersRouter.get('/payments/config', wrap(async (_req, res) => { const g = getGateway(); res.json(g ? { provider: g.name, keyId: g.keyId, mode: g.mode, sandbox: g.name === 'mock' } : { provider: null }); }));

ordersRouter.post('/orders', wrap(async (req, res) => {
  const { projectId } = z.object({ projectId: z.string().refine((v) => mongoose.isValidObjectId(v)) }).parse(req.body);
  const me = await User.findById(req.user!.id).select('emailVerified'); if (!me?.emailVerified) throw new HttpError(403, 'Please verify your email before purchasing', 'email_unverified');
  const p = await Project.findOne({ _id: projectId, status: 'published' }); if (!p) throw notFound('Project not found');
  if (p.isFree || p.pricePaise < 1) throw badRequest('This project is free — nothing to purchase');
  if (!(await isPurchasable(p))) throw badRequest('This project has no deliverable yet (no files or setup guide), so it cannot be purchased');
  if (await Order.exists({ user: req.user!.id, project: p._id, type: 'project', status: 'paid' })) throw new HttpError(409, 'You already own this project', 'conflict');
  const { order, checkout } = await createCheckout({ userId: req.user!.id, type: 'project', project: p._id, title: p.title, amountPaise: p.pricePaise }); // price comes from the DB, never from the request
  res.status(201).json({ order: view(order), checkout: { ...checkout, prefill: { name: req.user!.name, email: req.user!.email } } });
}));

ordersRouter.get('/orders', wrap(async (req, res) => {
  const items = await Order.find({ user: req.user!.id, status: { $ne: 'cancelled' } }).sort({ createdAt: -1 }).limit(100).populate('project', 'slug title').lean();
  res.json({ items: items.map(view) });
}));

ordersRouter.get('/orders/:id', wrap(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) throw notFound();
  const o: any = await Order.findOne({ _id: req.params.id, user: req.user!.id }).populate('project', 'slug title setupGuide').lean(); // object-level authorization: only the owner
  if (!o) throw notFound('Order not found');
  const paid = o.status === 'paid';
  const files = paid && o.project ? await ProjectFile.find({ project: o.project._id }).select('label kind version originalName sizeBytes sha256 createdAt').lean() : [];
  const attempts = await Payment.find({ order: o._id }).select('status createdAt failureReason amountPaise').sort({ createdAt: -1 }).lean();
  res.json({ order: view(o), files, guide: paid ? (o.project?.setupGuide ?? '') : '', attempts });
}));

// Client-side verify: signature is mandatory and the gateway is asked for the real payment status.
ordersRouter.post('/orders/:id/verify', wrap(async (req, res) => {
  const b = z.object({ paymentId: z.string().min(5).max(100).optional(), signature: z.string().min(10).max(200).optional() }).parse(req.body);
  const o = await Order.findOne({ _id: req.params.id, user: req.user!.id }); if (!o) throw notFound('Order not found');
  let paymentId = b.paymentId;
  const gw = getGateway();
  if (gw?.listPayments && o.gatewayOrderId && gw.name === o.gateway) { // gateways without a signed browser callback (Cashfree): find the successful payment ourselves
    paymentId = (await gw.listPayments(o.gatewayOrderId)).find((p) => p.status === 'captured')?.id;
    if (!paymentId) throw badRequest('Payment is not confirmed by the gateway yet');
  }
  if (!paymentId) throw badRequest('paymentId is required');
  const r = await confirmPayment(String(o._id), paymentId, { signature: b.signature, source: 'client_verify' });
  res.json({ order: view(r.order), alreadyPaid: r.alreadyPaid });
}));

ordersRouter.post('/orders/:id/failed', wrap(async (req, res) => { // browser reports a failed attempt: informational only, can never grant access
  const { paymentId, reason } = z.object({ paymentId: z.string().max(100).optional(), reason: z.string().max(200).default('failed') }).parse(req.body);
  const o = await Order.findOne({ _id: req.params.id, user: req.user!.id }); if (!o) throw notFound();
  if (o.gatewayOrderId && paymentId) await markFailedFromGateway(o.gatewayOrderId, paymentId, reason);
  res.json({ ok: true });
}));

/** DEV SANDBOX ONLY. Simulates the gateway's card page; completion still goes through signature + capture verification. */
ordersRouter.post('/orders/:id/mock-pay', wrap(async (req, res) => {
  if (isProd || getGateway()?.name !== 'mock') throw notFound();
  const { outcome } = z.object({ outcome: z.enum(['success', 'failure']) }).parse(req.body);
  const o = await Order.findOne({ _id: req.params.id, user: req.user!.id }); if (!o) throw notFound('Order not found');
  if (o.gateway !== 'mock') throw forbidden();
  const paymentId = `mock_pay_${crypto.randomBytes(8).toString('hex')}`;
  if (outcome === 'failure') { await markFailedFromGateway(o.gatewayOrderId!, paymentId, 'simulated failure'); return res.json({ ok: false, order: view((await Order.findById(o._id))!) }); }
  mockRecordPayment({ id: paymentId, orderId: o.gatewayOrderId!, status: 'captured', amountPaise: o.amountPaise });
  const r = await confirmPayment(String(o._id), paymentId, { signature: mockSign(o.gatewayOrderId!, paymentId), source: 'client_verify' });
  res.json({ ok: true, order: view(r.order) });
}));
