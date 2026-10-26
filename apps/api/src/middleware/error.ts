import type { ErrorRequestHandler, RequestHandler } from 'express';
import { ZodError } from 'zod';
import mongoose from 'mongoose';
import { HttpError } from '../utils/errors.js';
import { isProd } from '../config/env.js';
import { logger } from '../utils/logger.js';

export const notFoundHandler: RequestHandler = (_req, res) =>
  res.status(404).json({ error: { code: 'not_found', message: 'Route not found' } });

export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  if (err instanceof ZodError) {
    return res.status(400).json({ error: { code: 'validation_error', message: 'Invalid input', details: err.flatten().fieldErrors } });
  }
  if (err instanceof HttpError) {
    return res.status(err.status).json({ error: { code: err.code, message: err.message, details: err.details } });
  }
  if (err instanceof mongoose.Error.ValidationError) {
    return res.status(400).json({ error: { code: 'validation_error', message: err.message } });
  }
  if (err instanceof mongoose.Error.CastError) {
    return res.status(404).json({ error: { code: 'not_found', message: 'Not found' } });
  }
  if (err?.code === 11000) {
    return res.status(409).json({ error: { code: 'conflict', message: 'Duplicate value' } });
  }
  logger.error({ err, reqId: req.id }, 'unhandled error');
  res.status(500).json({ error: { code: 'internal', message: isProd ? 'Something went wrong' : String(err?.message ?? err) } });
};
