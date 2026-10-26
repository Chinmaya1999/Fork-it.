import express from 'express';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import crypto from 'node:crypto';
import { pinoHttp } from 'pino-http';
import mongoSanitize from './middleware/sanitize.js';
import { env } from './config/env.js';
import { logger } from './utils/logger.js';
import { csrfGuard, loadUser } from './middleware/auth.js';
import { errorHandler, notFoundHandler } from './middleware/error.js';
import { authRouter } from './modules/auth/auth.routes.js';
import { projectsRouter } from './modules/projects/projects.routes.js';
import { meRouter } from './modules/me/me.routes.js';
import { ordersRouter } from './modules/orders/orders.routes.js';
import { downloadsRouter } from './modules/downloads/downloads.routes.js';
import { razorpayWebhook } from './modules/webhooks/razorpay.js';
import { notificationsRouter } from './modules/notifications/notifications.routes.js';
import { ticketsRouter } from './modules/tickets/tickets.routes.js';
import { staffRouter } from './modules/staff/staff.routes.js';
import { customRouter } from './modules/custom/custom.routes.js';
import './modules/custom/customService.js'; // registers payment hooks
import { messagesRouter, staffMessagesRouter } from './modules/messages/messages.routes.js';
import { reportsRouter } from './modules/reports/reports.routes.js';
import { adminRouter } from './modules/admin/admin.routes.js';
import { categoriesRouter } from './modules/categories/categories.routes.js';

export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 1);
  app.use((req, res, next) => { req.id = req.get('x-request-id') ?? crypto.randomUUID(); res.setHeader('x-request-id', req.id); next(); });
  app.use(pinoHttp({ logger, genReqId: (r) => (r as any).id }));
  app.use(helmet());
  app.use(cors({ origin: [env.CLIENT_URL], credentials: true }));
  app.post('/api/v1/webhooks/razorpay', express.raw({ type: '*/*', limit: '1mb' }), (req, res, next) => { razorpayWebhook(req, res).catch(next); }); // raw body, before JSON parsing
  app.use(express.json({ limit: '100kb' }));
  app.use(cookieParser());
  app.use(mongoSanitize);

  app.get('/health', (_req, res) => res.json({ status: 'ok' }));

  const api = express.Router();
  api.use(rateLimit({ windowMs: 60_000, limit: env.NODE_ENV === 'test' ? 100_000 : 600, standardHeaders: true, legacyHeaders: false, message: { error: { code: 'rate_limited', message: 'Too many requests. Slow down and try again.' } } })); // per-IP backstop; auth/report/download routes have tighter limits of their own
  api.use(csrfGuard, loadUser);
  api.use('/auth', authRouter);
  api.use('/projects', projectsRouter);
  api.use('/categories', categoriesRouter);
  api.use('/admin', adminRouter);
  api.use('/staff', staffRouter);
  api.use('/staff', staffMessagesRouter);
  api.use('/me', meRouter);
  api.use(notificationsRouter);
  api.use(messagesRouter);
  api.use(ticketsRouter);
  api.use(customRouter);
  api.use(reportsRouter);
  api.use(ordersRouter);
  api.use(downloadsRouter);
  app.use('/api/v1', api);

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
