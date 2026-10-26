import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import type { Role } from '@projectforge/shared';
import { env } from '../config/env.js';
import { User } from '../models/User.js';
import { forbidden, unauthorized } from '../utils/errors.js';

export const COOKIE = 'pf_session';
export interface AuthUser { id: string; role: Role; email: string; name: string }
declare module 'express-serve-static-core' { interface Request { user?: AuthUser } }

export const signSession = (id: string, tokenVersion: number) =>
  jwt.sign({ sub: id, v: tokenVersion }, env.JWT_SECRET, { expiresIn: '7d', algorithm: 'HS256' });

/** Loads the user from the session cookie (if any). Re-checks DB each request so suspension/role changes apply immediately. */
export async function loadUser(req: Request, _res: Response, next: NextFunction) {
  try {
    const bearer = /^Bearer (.+)$/.exec(req.get('authorization') ?? '')?.[1];
    const token = req.cookies?.[COOKIE] ?? bearer;
    if (!token) return next();
    const p = jwt.verify(token, env.JWT_SECRET, { algorithms: ['HS256'] }) as { sub: string; v: number };
    const u = await User.findById(p.sub);
    if (u && u.status === 'active' && u.tokenVersion === p.v) {
      req.user = { id: u.id, role: u.role as Role, email: u.email, name: u.name };
    }
  } catch { /* invalid token => anonymous */ }
  next();
}

export const requireAuth = (req: Request, _res: Response, next: NextFunction) =>
  req.user ? next() : next(unauthorized());

export const requireRole = (...roles: Role[]) => (req: Request, _res: Response, next: NextFunction) => {
  if (!req.user) return next(unauthorized());
  if (!roles.includes(req.user.role)) return next(forbidden());
  next();
};

/** CSRF defence for cookie auth: SameSite=Lax cookie + custom header required on state-changing requests. */
export function csrfGuard(req: Request, _res: Response, next: NextFunction) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  if (req.path.startsWith('/webhooks/')) return next(); // verified by signature instead
  if (req.get('x-requested-with') !== 'projectforge') return next(forbidden('Missing CSRF header'));
  next();
}
