import Fastify from 'fastify';
import cors from '@fastify/cors';
import 'dotenv/config';

const HOST = process.env.HOST || '127.0.0.1';
const PORT = Number(process.env.PORT || 3001);
const BRIDGE_URL = process.env.BRIDGE_URL || 'http://127.0.0.1:1122';

const fastify = Fastify({ logger: true });

// CORS
await fastify.register(cors, { origin: '*' });

// Health check
fastify.get('/health', async () => ({
  status: 'ok',
  service: 'be-main',
  bridge: BRIDGE_URL
}));

// Import routes
import chatRoutes from './routes/chat.mjs';
fastify.register(chatRoutes, { prefix: '/api', bridgeUrl: BRIDGE_URL });

// Start
const start = async () => {
  try {
    await fastify.listen({ port: PORT, host: HOST });
    console.log(`[be-main] Running at http://${HOST}:${PORT}`);
    console.log(`[be-main] Bridge URL: ${BRIDGE_URL}`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();
