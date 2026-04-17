/**
 * be-main Backend
 * Import config từ root config module
 */

import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { createRequire } from 'module';

// Load .env từ thư mục của app, bất kể CWD ở đâu
const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: join(__dirname, '..', '.env') });

import Fastify from 'fastify';
import cors from '@fastify/cors';

// Load root config
const require = createRequire(import.meta.url);
const rootConfigPath = join(__dirname, '../../../config/main.config.js');

let mainConfig;
try {
  mainConfig = require(rootConfigPath);
} catch (error) {
  console.warn('[be-main] Cannot load root config, using fallback:', error.message);
  mainConfig = null;
}

// Use config từ root hoặc fallback
const HOST = mainConfig?.backend.host || process.env.MAIN_HOST || '127.0.0.1';
const PORT = mainConfig?.backend.port || Number(process.env.MAIN_PORT || 6969);
const BRIDGE_URL = mainConfig?.backend.bridge.url || process.env.BRIDGE_URL || 'http://localhost:1122';
const BRIDGE_API_KEY = mainConfig?.backend.bridge.apiKey || process.env.BRIDGE_API_KEY || '';

const fastify = Fastify({ logger: true });

// CORS
await fastify.register(cors, { origin: '*' });

// Health check
fastify.get('/health', async () => ({
  status: 'ok',
  service: 'be-main',
  bridge: BRIDGE_URL,
  port: PORT,
  authEnabled: BRIDGE_API_KEY.length > 0
}));

// Import routes
import chatRoutes from './routes/chat.mjs';
import rulesRoutes from './routes/rules.mjs';
import settingsRoutes from './routes/settings.mjs';

fastify.register(chatRoutes, { prefix: '/api', bridgeUrl: BRIDGE_URL, bridgeApiKey: BRIDGE_API_KEY });
fastify.register(rulesRoutes, { prefix: '/api' });
fastify.register(settingsRoutes, { prefix: '/api', bridgeUrl: BRIDGE_URL, bridgeApiKey: BRIDGE_API_KEY });

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
