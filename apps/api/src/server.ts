import http from 'node:http';
import mongoose from 'mongoose';
import { env } from './config/env.js';
import { createApp } from './app.js';
import { initSocket } from './socket.js';
import { logger } from './utils/logger.js';

await mongoose.connect(env.MONGODB_URI);
logger.info('MongoDB connected');
const server = http.createServer(createApp());
initSocket(server);
server.listen(env.PORT, () => logger.info(`API + realtime listening on :${env.PORT}`));
