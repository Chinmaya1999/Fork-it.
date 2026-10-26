// Secure admin bootstrap. Usage: ADMIN_EMAIL=you@x.com ADMIN_NAME="You" npm run create-admin
// The password is read from a hidden prompt (or ADMIN_PASSWORD env for CI) and never stored in source.
import mongoose from 'mongoose';
import argon2 from 'argon2';
import readline from 'node:readline';
import { env } from '../config/env.js';
import { User } from '../models/User.js';

const email = process.env.ADMIN_EMAIL?.toLowerCase();
if (!email) { console.error('Set ADMIN_EMAIL'); process.exit(1); }

async function askHidden(q: string): Promise<string> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
  (rl as any)._writeToOutput = (s: string) => { if (s.includes(q)) process.stdout.write(s); };
  return new Promise((r) => rl.question(q, (a) => { rl.close(); process.stdout.write('\n'); r(a); }));
}
const password = process.env.ADMIN_PASSWORD ?? (await askHidden('Admin password (min 12 chars): '));
if (password.length < 12) { console.error('Password too short'); process.exit(1); }

await mongoose.connect(env.MONGODB_URI);
const passwordHash = await argon2.hash(password, { type: argon2.argon2id });
await User.findOneAndUpdate({ email }, { name: process.env.ADMIN_NAME ?? 'Administrator', email, passwordHash, role: 'admin', emailVerified: true, status: 'active', $inc: { tokenVersion: 1 } }, { upsert: true, setDefaultsOnInsert: true });
console.log(`Admin ready: ${email}`);
await mongoose.disconnect();
