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
const PORT = mainConfig?.backend.port || Number(process.env.MAIN_PORT || 8888);
const BRIDGE_URL = mainConfig?.backend.bridge.url || process.env.BRIDGE_URL || 'http://localhost:1110';

// Đọc key động từ .env mỗi request để không cần restart khi đổi key
import { readFileSync, existsSync } from 'node:fs';
function getBridgeApiKey() {
  try {
    const envPath = join(__dirname, '..', '.env');
    if (!existsSync(envPath)) return process.env.BRIDGE_API_KEY || '';
    const raw = readFileSync(envPath, 'utf8');
    const match = raw.match(/^BRIDGE_API_KEY=(.+)$/m);
    return match ? match[1].trim() : process.env.BRIDGE_API_KEY || '';
  } catch { return process.env.BRIDGE_API_KEY || ''; }
}

const fastify = Fastify({ 
  logger: true,
  bodyLimit: 10 * 1024 * 1024 // 10MB để hỗ trợ ảnh base64
});

// CORS
await fastify.register(cors, { origin: '*' });

// Health check
fastify.get('/health', async () => ({
  status: 'ok',
  service: 'be-main',
  bridge: BRIDGE_URL,
  port: PORT,
  authEnabled: getBridgeApiKey().length > 0
}));

// Import routes
import chatRoutes from './routes/chat.mjs';
import rulesRoutes from './routes/rules.mjs';
import settingsRoutes from './routes/settings.mjs';
import servicePackagesRoutes from './routes/service-packages.mjs';

fastify.register(chatRoutes, { prefix: '/api', bridgeUrl: BRIDGE_URL, getBridgeApiKey });
fastify.register(rulesRoutes, { prefix: '/api' });
fastify.register(settingsRoutes, { prefix: '/api', bridgeUrl: BRIDGE_URL, bridgeApiKey: getBridgeApiKey() });
fastify.register(servicePackagesRoutes, { prefix: '/api' });

// Start
const start = async () => {
  try {
    await fastify.listen({ port: PORT, host: HOST });
    console.log(`[be-main] Running at http://${HOST}:${PORT}`);
    console.log(`[be-main] Bridge URL: ${BRIDGE_URL}`);
    if (getBridgeApiKey()) {
      console.log(`[be-main] Bridge Authentication: ENABLED`);
    } else {
      console.log(`[be-main] Bridge Authentication: DISABLED — them key trong PCCC Admin`);
    }
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();


