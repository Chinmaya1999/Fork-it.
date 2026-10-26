import { Router } from 'express';
import mongoose from 'mongoose';
import path from 'node:path';
import { requireAuth } from '../../middleware/auth.js';
import { wrap } from '../../utils/async.js';
import { forbidden, notFound, unauthorized } from '../../utils/errors.js';
import { ProjectFile } from '../../models/ProjectFile.js';
import { DownloadAudit } from '../../models/DownloadAudit.js';
import { entitlement, issueLink, safeFilename, verifyToken } from '../../services/downloads.js';
import { exists, openStream } from '../../services/storage.js';

export const downloadsRouter = Router();
downloadsRouter.use(['/files', '/downloads'], requireAuth);

// 1) ask for a short-lived link (entitlement + limit checked now)
downloadsRouter.post('/files/:id/link', wrap(async (req, res) => { res.json(await issueLink(req.user!.id, req.params.id)); }));

// 2) use it (entitlement re-checked now; the link is bound to this user's session)
downloadsRouter.get('/downloads/:token', wrap(async (req, res) => {
  const t = verifyToken(req.params.token); if (!t) throw unauthorized('Download link expired or invalid');
  if (t.sub !== req.user!.id) throw forbidden('This link was issued to another account');
  const file = await ProjectFile.findById(t.fid).select('+storageKey').lean(); if (!file || !mongoose.isValidObjectId(t.fid)) throw notFound('File not found');
  const ent = await entitlement(req.user!.id, file); if (!ent) throw forbidden('Access to this file has been revoked'); // e.g. refunded after the link was issued
  if (!(await exists(file.storageKey))) throw notFound('File is missing from storage');
  await DownloadAudit.create({ user: req.user!.id, order: ent.orderId, file: file._id, ip: req.ip, userAgent: String(req.get('user-agent') ?? '').slice(0, 200) });
  res.set({ 'Content-Type': 'application/octet-stream', 'Content-Disposition': `attachment; filename="${safeFilename(path.basename(file.originalName))}"`, 'Content-Length': String(file.sizeBytes), 'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'private, no-store' });
  const stream = openStream(file.storageKey);
  stream.on('error', () => { if (!res.headersSent) res.status(404).end(); else res.destroy(); }); // a vanished file must never crash the process
  res.on('close', () => stream.destroy());
  stream.pipe(res);
}));
