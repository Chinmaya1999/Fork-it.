import type { NextFunction, Request, Response } from 'express';
/** Rejects Mongo operator injection: keys starting with '$' or containing '.' in body/query/params. */
const bad = (v: unknown): boolean => {
  if (Array.isArray(v)) return v.some(bad);
  if (v && typeof v === 'object') return Object.entries(v).some(([k, x]) => k.startsWith('$') || k.includes('.') || bad(x));
  return false;
};
export default function mongoSanitize(req: Request, res: Response, next: NextFunction) {
  if (bad(req.body) || bad(req.query) || bad(req.params)) return res.status(400).json({ error: { code: 'bad_request', message: 'Invalid characters in input' } });
  next();
}
