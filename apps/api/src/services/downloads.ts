import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import { env } from '../config/env.js';
import { Order } from '../models/Order.js';
import { ProjectFile } from '../models/ProjectFile.js';
import { DownloadAudit } from '../models/DownloadAudit.js';
import { CustomRequest } from '../models/CustomRequest.js';
import { forbidden, HttpError, notFound } from '../utils/errors.js';

export const safeFilename = (n: string) => n.replace(/[^\w.\- ()]/g, '_').slice(0, 120) || 'download';

/** Current entitlement check: a PAID, non-refunded order of this user that covers the file. Re-evaluated on every issue AND every use. */
export async function entitlement(userId: string, file: { _id: any; project?: any; customRequest?: any }): Promise<{ orderId: string } | null> {
  if (file.project) {
    const o = await Order.findOne({ user: userId, project: file.project, type: 'project', status: 'paid' }).select('_id').lean();
    return o ? { orderId: String(o._id) } : null;
  }
  if (file.customRequest) {
    const r = await CustomRequest.findOne({ _id: file.customRequest, user: userId, status: { $in: ['delivered', 'completed'] } }).select('_id').lean();
    const o = r && await Order.findOne({ user: userId, customRequest: file.customRequest, type: 'custom_final', status: 'paid' }).select('_id').lean(); // deliverables unlock only after VERIFIED final payment
    return o ? { orderId: String(o._id) } : null;
  }
  return null;
}

export async function issueLink(userId: string, fileId: string) {
  if (!mongoose.isValidObjectId(fileId)) throw notFound('File not found');
  const file = await ProjectFile.findById(fileId).lean(); if (!file) throw notFound('File not found');
  const ent = await entitlement(userId, file); if (!ent) throw forbidden('You do not have access to this file');
  const used = await DownloadAudit.countDocuments({ user: userId, file: file._id });
  if (used >= env.DOWNLOAD_LIMIT) throw new HttpError(429, `Download limit reached (${env.DOWNLOAD_LIMIT}). Contact support if you need more.`, 'download_limit');
  const token = jwt.sign({ typ: 'dl', sub: userId, fid: String(file._id), oid: ent.orderId }, env.JWT_SECRET, { expiresIn: '5m' }); // short-lived
  return { url: `/api/v1/downloads/${token}`, expiresInSeconds: 300 };
}
export const verifyToken = (token: string) => { try { const p = jwt.verify(token, env.JWT_SECRET, { algorithms: ['HS256'] }) as { typ: string; sub: string; fid: string; oid: string }; return p.typ === 'dl' ? p : null; } catch { return null; } };
