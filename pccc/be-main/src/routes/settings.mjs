import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ENV_PATH = join(__dirname, '../../.env');

function readBridgeKey() {
  try {
    const raw = readFileSync(ENV_PATH, 'utf8');
    const m = raw.match(/^BRIDGE_API_KEY=(.+)$/m);
    return m ? m[1].trim() : '';
  } catch { return ''; }
}

function writeBridgeKey(key) {
  try {
    let raw = existsSync(ENV_PATH) ? readFileSync(ENV_PATH, 'utf8') : '';
    if (raw.match(/^BRIDGE_API_KEY=.*$/m)) {
      raw = raw.replace(/^BRIDGE_API_KEY=.*$/m, `BRIDGE_API_KEY=${key}`);
    } else {
      raw += `\nBRIDGE_API_KEY=${key}\n`;
    }
    writeFileSync(ENV_PATH, raw, 'utf8');
    return true;
  } catch { return false; }
}

export default async function settingsRoutes(fastify, options) {
  const BRIDGE_URL = options.bridgeUrl || 'http://127.0.0.1:1110';
  const BRIDGE_API_KEY = options.bridgeApiKey || '';

  // GET /api/settings - Get current settings (read-only)
  fastify.get('/settings', async (request, reply) => {
    return {
      bridge: {
        url: BRIDGE_URL,
        hasApiKey: BRIDGE_API_KEY.length > 0
      },
      server: {
        version: '1.0.0',
        nodeVersion: process.version,
        platform: process.platform
      }
    };
  });

  // GET /api/settings/bridge-status - Check bridge connection
  fastify.get('/settings/bridge-status', async (request, reply) => {
    try {
      const key = BRIDGE_API_KEY;
      const headers = {};
      if (key) headers['X-Bridge-API-Key'] = key;

      const response = await fetch(`${BRIDGE_URL}/health`, {
        method: 'GET',
        headers
      });

      if (!response.ok) {
        return {
          connected: false,
          error: `Bridge returned ${response.status}`
        };
      }

      const data = await response.json();
      return {
        connected: true,
        ...data
      };
    } catch (err) {
      return {
        connected: false,
        error: err.message
      };
    }
  });

  // GET /api/settings/bridge-key - Lấy key hiện tại (masked)
  fastify.get('/settings/bridge-key', async () => {
    const key = readBridgeKey();
    return { hasKey: key.length > 0, keyPreview: key ? key.slice(0, 8) + '…' : '' };
  });

  // PUT /api/settings/bridge-key - Lưu key mới vào .env (không cần restart)
  fastify.put('/settings/bridge-key', async (request, reply) => {
    const { key } = request.body || {};
    if (!key?.trim()) return reply.status(400).send({ error: 'Key không được để trống' });
    const ok = writeBridgeKey(key.trim());
    if (!ok) return reply.status(500).send({ error: 'Không ghi được .env' });
    return { success: true };
  });
}

