import type { Request } from 'express';
import { AuditLog } from '../models/AuditLog.js';
/** Records a sensitive admin action. Never put secrets/passwords in `meta`. */
export const audit = (req: Request, action: string, targetType?: string, targetId?: string, meta?: unknown) =>
  AuditLog.create({ actor: req.user!.id, actorEmail: req.user!.email, action, targetType, targetId, meta, ip: req.ip });
