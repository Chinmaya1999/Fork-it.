import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import { beforeAll, afterAll } from 'vitest';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret-test-secret-test-secret-123';
process.env.CLIENT_URL = 'http://localhost:5173';
process.env.RAZORPAY_WEBHOOK_SECRET = 'whsec_test_secret';
process.env.STORAGE_DIR = require('node:path').join(require('node:os').tmpdir(), `pf-test-storage-${process.pid}`);
process.env.MONGODB_URI = 'mongodb://placeholder'; // replaced by the in-memory server URI in beforeAll
let mongod: MongoMemoryServer;
beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  process.env.MONGODB_URI = mongod.getUri();
  await mongoose.connect(process.env.MONGODB_URI);
});
afterAll(async () => { await mongoose.disconnect(); await mongod.stop(); });
