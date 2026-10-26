import multer from 'multer';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import { env } from '../config/env.js';
import { badRequest } from '../utils/errors.js';

const ALLOWED = new Set(['.zip', '.sql', '.pdf', '.md', '.txt', '.docx', '.pptx', '.png', '.jpg', '.jpeg']);
export const uploadSingle = multer({
  storage: multer.diskStorage({ destination: os.tmpdir(), filename: (_r, _f, cb) => cb(null, `pf-upload-${Date.now()}-${Math.random().toString(36).slice(2)}`) }),
  limits: { fileSize: env.MAX_UPLOAD_MB * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, cb) => (ALLOWED.has(path.extname(file.originalname).toLowerCase()) ? cb(null, true) : cb(badRequest(`File type not allowed. Allowed: ${[...ALLOWED].join(' ')}`))),
}).single('file');

/** Extension and MIME are not proof of content: check magic bytes for container formats. Real AV scanning is a pending external step. */
export async function validateMagic(file: Express.Multer.File) {
  const ext = path.extname(file.originalname).toLowerCase();
  const fd = await fs.promises.open(file.path, 'r'); const buf = Buffer.alloc(8); await fd.read(buf, 0, 8, 0); await fd.close();
  const isZip = buf[0] === 0x50 && buf[1] === 0x4b; const isPdf = buf.subarray(0, 4).toString() === '%PDF'; const isPng = buf[0] === 0x89 && buf[1] === 0x50; const isJpg = buf[0] === 0xff && buf[1] === 0xd8;
  const ok = { '.zip': isZip, '.docx': isZip, '.pptx': isZip, '.pdf': isPdf, '.png': isPng, '.jpg': isJpg, '.jpeg': isJpg }[ext];
  if (ok === false) { await fs.promises.unlink(file.path).catch(() => undefined); throw badRequest('File content does not match its extension'); }
}
