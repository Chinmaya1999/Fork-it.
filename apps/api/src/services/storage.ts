import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { env } from '../config/env.js';

/**
 * Private object storage. Local-disk adapter for development; keys are random and never exposed to clients.
 * An S3 adapter (private bucket + presigned URLs) is the production target and is pending external configuration.
 */
const root = () => path.resolve(env.STORAGE_DIR);
const full = (key: string) => { const p = path.resolve(root(), key); if (!p.startsWith(root() + path.sep)) throw new Error('bad storage key'); return p; };

export async function saveFromPath(tmpPath: string): Promise<{ key: string; sizeBytes: number; sha256: string }> {
  await fs.promises.mkdir(root(), { recursive: true });
  const key = crypto.randomUUID(); const hash = crypto.createHash('sha256'); let size = 0;
  await new Promise<void>((resolve, reject) => { const s = fs.createReadStream(tmpPath); s.on('data', (c) => { hash.update(c); size += (c as Buffer).length; }); s.on('end', resolve); s.on('error', reject); });
  await fs.promises.rename(tmpPath, full(key)).catch(async () => { await fs.promises.copyFile(tmpPath, full(key)); await fs.promises.unlink(tmpPath); });
  return { key, sizeBytes: size, sha256: hash.digest('hex') };
}
export async function saveBuffer(buf: Buffer) { await fs.promises.mkdir(root(), { recursive: true }); const key = crypto.randomUUID(); await fs.promises.writeFile(full(key), buf); return { key, sizeBytes: buf.length, sha256: crypto.createHash('sha256').update(buf).digest('hex') }; }
export const openStream = (key: string) => fs.createReadStream(full(key));
export const removeObject = (key: string) => fs.promises.unlink(full(key)).catch(() => undefined);
export const exists = (key: string) => fs.promises.access(full(key)).then(() => true, () => false);
