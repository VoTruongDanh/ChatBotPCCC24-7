import Fastify from 'fastify';
import cors from '@fastify/cors';
import 'dotenv/config';

const HOST = process.env.HOST || '127.0.0.1';
const PORT = Number(process.env.PORT || 3001);
const BRIDGE_URL = process.env.BRIDGE_URL || 'http://127.0.0.1:1122';
const BRIDGE_API_KEY = process.env.BRIDGE_API_KEY || '';

const fastify = Fastify({ logger: true });

// CORS
await fastify.register(cors, { origin: '*' });

// Health check
fastify.get('/health', async () => ({
  status: 'ok',
  service: 'be-main',
  bridge: BRIDGE_URL,
  authEnabled: BRIDGE_API_KEY.length > 0
}));

// Import routes
import chatRoutes from './routes/chat.mjs';
import rulesRoutes from './routes/rules.mjs';

fastify.register(chatRoutes, { prefix: '/api', bridgeUrl: BRIDGE_URL, bridgeApiKey: BRIDGE_API_KEY });
fastify.register(rulesRoutes, { prefix: '/api' });

// Start
const start = async () => {
  try {
    await fastify.listen({ port: PORT, host: HOST });
    console.log(`[be-main] Running at http://${HOST}:${PORT}`);
    console.log(`[be-main] Bridge URL: ${BRIDGE_URL}`);
    if (BRIDGE_API_KEY) {
      console.log(`[be-main] Bridge Authentication: ENABLED`);
    } else {
      console.log(`[be-main] Bridge Authentication: DISABLED (no BRIDGE_API_KEY set)`);
    }
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();
