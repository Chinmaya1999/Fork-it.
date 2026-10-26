import { Router } from 'express';
import argon2 from 'argon2';
import crypto from 'node:crypto';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { registerSchema, loginSchema } from '@projectforge/shared';
import { User } from '../../models/User.js';
import { COOKIE, requireAuth, signSession } from '../../middleware/auth.js';
import { wrap } from '../../utils/async.js';
import { badRequest, conflict, unauthorized, HttpError } from '../../utils/errors.js';
import { env, isProd } from '../../config/env.js';
import { mailConfigured, sendMail } from '../../utils/mailer.js';

export const authRouter = Router();
const limiter = rateLimit({ windowMs: 15 * 60_000, limit: env.NODE_ENV === 'test' ? 1000 : 30, standardHeaders: true, legacyHeaders: false });
const sha = (s: string) => crypto.createHash('sha256').update(s).digest('hex');
const MAX_FAILS = 5;
const DUMMY_HASH = await argon2.hash('timing-equaliser-not-a-real-password', { type: argon2.argon2id }); // verified for unknown emails so response time does not reveal which accounts exist

const setCookie = (res: import('express').Response, token: string) =>
  res.cookie(COOKIE, token, { httpOnly: true, sameSite: 'lax', secure: isProd, maxAge: 7 * 864e5, path: '/' });

/** Cross-origin clients (frontend on another site, Safari blocks third-party cookies) opt in with X-Token-Auth and get the session token in the body too. Cookie clients never see it. */
const withToken = (req: import('express').Request, user: any) => ({ user: publicUser(user), ...(req.get('x-token-auth') === '1' && { token: signSession(user.id, user.tokenVersion) }) });
const publicUser = (u: any) => ({ id: u.id, name: u.name, email: u.email, role: u.role, emailVerified: u.emailVerified, degree: u.degree, college: u.college, semester: u.semester });

authRouter.post('/register', limiter, wrap(async (req, res) => {
  const input = registerSchema.parse(req.body); // role is never accepted from the client
  if (await User.exists({ email: input.email })) throw conflict('An account with this email already exists');
  const verifyToken = crypto.randomBytes(32).toString('hex');
  const user = await User.create({
    name: input.name, email: input.email, degree: input.degree, college: input.college,
    passwordHash: await argon2.hash(input.password, { type: argon2.argon2id }),
    emailVerifyTokenHash: sha(verifyToken),
  });
  await sendMail(user.email, 'Verify your email', `Verify: ${env.CLIENT_URL}/verify-email?token=${verifyToken}`);
  setCookie(res, signSession(user.id, user.tokenVersion));
  res.status(201).json(withToken(req, user));
}));

authRouter.post('/login', limiter, wrap(async (req, res) => {
  const { email, password } = loginSchema.parse(req.body);
  const user = await User.findOne({ email }).select('+passwordHash');
  if (user?.lockUntil && user.lockUntil > new Date()) throw new HttpError(429, 'Account temporarily locked. Try again later.', 'locked');
  const ok = await argon2.verify(user ? user.passwordHash : DUMMY_HASH, password) && !!user;
  if (!user || !ok) {
    if (user) {
      user.failedLogins += 1;
      if (user.failedLogins >= MAX_FAILS) { user.lockUntil = new Date(Date.now() + 15 * 60_000); user.failedLogins = 0; }
      await user.save();
    }
    throw unauthorized('Invalid email or password');
  }
  if (user.status !== 'active') throw new HttpError(403, 'Account suspended', 'suspended');
  user.failedLogins = 0; user.lockUntil = undefined; await user.save();
  setCookie(res, signSession(user.id, user.tokenVersion));
  res.json(withToken(req, user));
}));

authRouter.post('/logout', (_req, res) => { res.clearCookie(COOKIE, { path: '/' }); res.json({ ok: true }); });

authRouter.get('/me', wrap(async (req, res) => {
  if (!req.user) return res.json({ user: null });
  const u = await User.findById(req.user.id);
  res.json({ user: u ? publicUser(u) : null });
}));

authRouter.post('/verify-email', limiter, wrap(async (req, res) => {
  const { token } = z.object({ token: z.string().min(20) }).parse(req.body);
  const u = await User.findOneAndUpdate({ emailVerifyTokenHash: sha(token) }, { emailVerified: true, $unset: { emailVerifyTokenHash: 1 } });
  if (!u) throw badRequest('Invalid or expired verification link');
  res.json({ ok: true });
}));

authRouter.post('/resend-verification', requireAuth, limiter, wrap(async (req, res) => {
  const u = await User.findById(req.user!.id); if (!u) throw unauthorized();
  if (u.emailVerified) return res.json({ ok: true, alreadyVerified: true });
  const token = crypto.randomBytes(32).toString('hex');
  u.emailVerifyTokenHash = sha(token); await u.save();
  const link = `${env.CLIENT_URL}/verify-email?token=${token}`;
  await sendMail(u.email, 'Verify your email', `Verify your ProjectForge email: ${link}`);
  // Dev convenience only: with no SMTP configured and not in production, hand the link back so flows can be tested.
  res.json({ ok: true, emailed: mailConfigured(), ...(!mailConfigured() && !isProd && { devLink: link }) });
}));

authRouter.post('/forgot-password', limiter, wrap(async (req, res) => {
  const { email } = z.object({ email: z.string().email().toLowerCase() }).parse(req.body);
  const u = await User.findOne({ email });
  if (u) {
    const t = crypto.randomBytes(32).toString('hex');
    u.resetTokenHash = sha(t); u.resetTokenExpires = new Date(Date.now() + 3600_000); await u.save();
    await sendMail(u.email, 'Reset your password', `Reset: ${env.CLIENT_URL}/reset-password?token=${t} (valid 1 hour)`);
  }
  res.json({ ok: true }); // identical response whether or not the account exists
}));

authRouter.post('/reset-password', limiter, wrap(async (req, res) => {
  const { token, password } = z.object({ token: z.string().min(20), password: z.string().min(10).max(128) }).parse(req.body);
  const u = await User.findOne({ resetTokenHash: sha(token), resetTokenExpires: { $gt: new Date() } }).select('+resetTokenHash');
  if (!u) throw badRequest('Invalid or expired reset link');
  u.passwordHash = await argon2.hash(password, { type: argon2.argon2id });
  u.resetTokenHash = undefined; u.resetTokenExpires = undefined; u.tokenVersion += 1; // invalidates existing sessions
  await u.save();
  res.json({ ok: true });
}));

authRouter.post('/change-password', requireAuth, wrap(async (req, res) => {
  const { current, password } = z.object({ current: z.string(), password: z.string().min(10).max(128) }).parse(req.body);
  const u = await User.findById(req.user!.id).select('+passwordHash');
  if (!u || !(await argon2.verify(u.passwordHash, current))) throw unauthorized('Current password is incorrect');
  u.passwordHash = await argon2.hash(password, { type: argon2.argon2id }); u.tokenVersion += 1; await u.save();
  setCookie(res, signSession(u.id, u.tokenVersion));
  res.json({ ok: true, ...(req.get('x-token-auth') === '1' && { token: signSession(u.id, u.tokenVersion) }) });
}));

authRouter.patch('/profile', requireAuth, wrap(async (req, res) => {
  const body = z.object({ name: z.string().trim().min(2).max(80), college: z.string().trim().max(160).optional(), semester: z.number().int().min(1).max(12).optional(), degree: registerSchema.shape.degree }).parse(req.body);
  const u = await User.findByIdAndUpdate(req.user!.id, body, { new: true }); // whitelisted fields only (no role/status)
  res.json({ user: publicUser(u) });
}));
