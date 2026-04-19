/**
 * Admin API module for be-bridge
 * 
 * Provides endpoints for:
 * - Managing configuration
 * - Generating API keys
 * - Managing workers
 * - System monitoring
 */

// dotenv already loaded by config.mjs

import { v4 as uuidv4 } from 'uuid';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { 
  HOST, PORT, NUM_WORKERS, PREFERRED_BROWSER, CHAT_URL, HIDE_WINDOW,
  LAUNCH_MINIMIZED, LAUNCH_OFFSCREEN, PROFILE_DIR,
  STREAM_NO_CHANGE_THRESHOLD, STREAM_FALLBACK_THRESHOLD,
  STREAM_MAX_TIMEOUT, STREAM_START_TIMEOUT, STREAM_CHECK_INTERVAL, ADMIN_USERNAME, ADMIN_PASSWORD
} from './config.mjs';
import { isGenerating, showBrowserWindow, hideBrowserWindow, isBrowserRunning } from './worker.mjs';
import { isAuthConfigured } from './auth.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// In-memory store for admin API keys
const adminKeys = new Map();

// Persistent store
const KEYS_PATH = path.join(__dirname, '..', 'keys.json');
function loadKeys() {
  try {
    if (fs.existsSync(KEYS_PATH)) {
      const data = JSON.parse(fs.readFileSync(KEYS_PATH, 'utf8'));
      if (Array.isArray(data)) data.forEach(k => adminKeys.set(k.id, k));
    }
  } catch (e) { console.warn('[admin] Cannot read keys.json:', e.message); }
}
function saveKeys() {
  try { fs.writeFileSync(KEYS_PATH, JSON.stringify([...adminKeys.values()], null, 2), 'utf8'); }
  catch (e) { console.warn('[admin] Cannot write keys.json:', e.message); }
}
export function getAdminKeys() { return [...adminKeys.values()]; }
loadKeys();
// Session store: token -> { expiresAt }
const SESSION_TTL_MS = 8 * 60 * 60 * 1000; // 8h
const sessions = new Map();

function createSession() {
  const token = uuidv4().replace(/-/g, '') + uuidv4().replace(/-/g, '');
  sessions.set(token, { expiresAt: Date.now() + SESSION_TTL_MS });
  return token;
}

export function validateSession(token) {
  if (!token) return false;
  const s = sessions.get(token);
  if (!s) return false;
  if (Date.now() > s.expiresAt) { sessions.delete(token); return false; }
  return true;
}
// Always resolve next to be-bridge (same as dotenv in master.mjs), not process.cwd()
const configFilePath = path.join(__dirname, '..', '.env');

/** @returns {Record<string, string>} */
function readEnvIntoMap(filePath) {
  const out = {};
  if (!fs.existsSync(filePath)) return out;
  const raw = fs.readFileSync(filePath, 'utf8');
  for (const line of raw.split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const i = t.indexOf('=');
    if (i === -1) continue;
    const k = t.slice(0, i).trim();
    const v = t.slice(i + 1);
    out[k] = v;
  }
  return out;
}

/** Preserve key order from file; new keys appended */
function readEnvKeyOrder(filePath) {
  const order = [];
  if (!fs.existsSync(filePath)) return order;
  const raw = fs.readFileSync(filePath, 'utf8');
  for (const line of raw.split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const i = t.indexOf('=');
    if (i === -1) continue;
    const k = t.slice(0, i).trim();
    if (!order.includes(k)) order.push(k);
  }
  return order;
}

function writeEnvMerged(filePath, merged, preferredOrder) {
  const seen = new Set();
  const lines = [];
  for (const k of preferredOrder) {
    if (merged[k] === undefined) continue;
    lines.push(`${k}=${merged[k]}`);
    seen.add(k);
  }
  for (const k of Object.keys(merged).sort()) {
    if (seen.has(k)) continue;
    lines.push(`${k}=${merged[k]}`);
  }
  fs.writeFileSync(filePath, `${lines.join('\n')}\n`);
}

/**
 * Load current configuration from .env file
 */
function loadCurrentConfig() {
  const config = {
    HOST,
    PORT,
    NUM_WORKERS,
    PREFERRED_BROWSER,
    CHAT_URL,
    HIDE_WINDOW,
    LAUNCH_MINIMIZED,
    LAUNCH_OFFSCREEN,
    PROFILE_DIR,
    STREAM_NO_CHANGE_THRESHOLD,
    STREAM_FALLBACK_THRESHOLD,
    STREAM_MAX_TIMEOUT,
    STREAM_START_TIMEOUT,
    STREAM_CHECK_INTERVAL,
  };
  return config;
}

/**
 * Save configuration to .env file (merge; keep ui-bridge NEXT_PUBLIC_* and other keys)
 * Uses same variable names as config.mjs / bridge/.env.example
 */
function saveConfig(newConfig) {
  const preferredOrder = readEnvKeyOrder(configFilePath);
  const merged = readEnvIntoMap(configFilePath);

  const legacyKeys = new Set([
    'HOST',
    'PORT',
    'NUM_WORKERS',
    'CHAT_URL',
    'STREAM_NO_CHANGE_THRESHOLD',
    'STREAM_FALLBACK_THRESHOLD',
    'STREAM_MAX_TIMEOUT',
    'STREAM_START_TIMEOUT',
    'STREAM_CHECK_INTERVAL',
    'BRIDGE_HIDE_CHAT_WINDOW'
  ]);
  for (const k of legacyKeys) {
    delete merged[k];
  }

  const boolStr = (v) => (v ? 'true' : 'false');

  merged.BRIDGE_HOST = String(newConfig.HOST ?? HOST);
  merged.BRIDGE_PORT = String(newConfig.PORT ?? PORT);
  merged.BRIDGE_NUM_WORKERS = String(newConfig.NUM_WORKERS ?? NUM_WORKERS);
  merged.BRIDGE_PREFERRED_BROWSER = String(newConfig.PREFERRED_BROWSER ?? PREFERRED_BROWSER);
  merged.BRIDGE_CHAT_URL = String(newConfig.CHAT_URL ?? CHAT_URL);
  merged.BRIDGE_HIDE_WINDOW = boolStr(Boolean(newConfig.HIDE_WINDOW));
  merged.BRIDGE_LAUNCH_MINIMIZED = boolStr(Boolean(newConfig.LAUNCH_MINIMIZED));
  merged.BRIDGE_LAUNCH_OFFSCREEN = boolStr(Boolean(newConfig.LAUNCH_OFFSCREEN));
  merged.BRIDGE_PROFILE_DIR = String(newConfig.PROFILE_DIR ?? PROFILE_DIR);
  merged.BRIDGE_STREAM_NO_CHANGE_THRESHOLD = String(
    newConfig.STREAM_NO_CHANGE_THRESHOLD ?? STREAM_NO_CHANGE_THRESHOLD
  );
  merged.BRIDGE_STREAM_FALLBACK_THRESHOLD = String(
    newConfig.STREAM_FALLBACK_THRESHOLD ?? STREAM_FALLBACK_THRESHOLD
  );
  merged.BRIDGE_STREAM_MAX_TIMEOUT = String(newConfig.STREAM_MAX_TIMEOUT ?? STREAM_MAX_TIMEOUT);
  merged.BRIDGE_STREAM_START_TIMEOUT = String(newConfig.STREAM_START_TIMEOUT ?? STREAM_START_TIMEOUT);
  merged.BRIDGE_STREAM_CHECK_INTERVAL = String(newConfig.STREAM_CHECK_INTERVAL ?? STREAM_CHECK_INTERVAL);
  try {
    writeEnvMerged(configFilePath, merged, preferredOrder);
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Generate a new API key
 */
function generateApiKey(name = 'New Key') {
  const key = `bridge_${uuidv4().replace(/-/g, '')}`;
  const keyInfo = {
    id: uuidv4(),
    name,
    key,
    createdAt: new Date().toISOString(),
    lastUsed: null,
    active: true
  };
  
  adminKeys.set(keyInfo.id, keyInfo);
  saveKeys();
  return keyInfo;
}

/**
 * Validate admin API key
 */
export async function handleAdminLogin(req, res) {
  if (req.method !== 'POST') {
    res.writeHead(405, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ error: 'Method not allowed' }));
  }
  let body = '';
  req.on('data', chunk => body += chunk);
  req.on('end', () => {
    try {
      const { username, password } = JSON.parse(body);
      if (!ADMIN_PASSWORD) {
        res.writeHead(503, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ error: 'ADMIN_PASSWORD chưa được cấu hình trong .env' }));
      }
      if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
        const token = createSession();
        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ token, expiresIn: SESSION_TTL_MS }));
      }
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Sai tên đăng nhập hoặc mật khẩu' }));
    } catch {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Invalid JSON' }));
    }
  });
}

export async function handleAdminLogout(req, res) {
  const token = req.headers['x-session-token'] || '';
  sessions.delete(token);
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ success: true }));
}
export function validateAdminKey(req) {
  // 1. Session token (username/password login)
  const sessionToken = req.headers['x-session-token'] || '';
  if (sessionToken && validateSession(sessionToken)) return { valid: true, keyId: 'session' };

  // 2. Legacy API key (backward compat)
  const providedKey = req.headers['x-admin-api-key'] || req.headers['X-Admin-API-Key'] || '';
  for (const [id, keyInfo] of adminKeys) {
    if (keyInfo.key === providedKey && keyInfo.active) return { valid: true, keyId: id };
  }
  return { valid: false, error: 'Unauthorized' };
}

/**
 * Admin API handlers
 */
export async function handleAdminConfig(req, res) {
  const auth = validateAdminKey(req);
  if (!auth.valid) {
    res.writeHead(401, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ error: auth.error }));
  }
  
  if (req.method === 'GET') {
    const config = loadCurrentConfig();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ config }));
  } else if (req.method === 'PUT') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        const newConfig = JSON.parse(body);
        const result = saveConfig(newConfig);
        
        if (result.success) {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true, message: 'Configuration updated' }));
        } else {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: result.error }));
        }
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid JSON' }));
      }
    });
  } else {
    res.writeHead(405, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Method not allowed' }));
  }
}

export async function handleAdminKeys(req, res) {
  const auth = validateAdminKey(req);
  if (!auth.valid) {
    res.writeHead(401, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ error: auth.error }));
  }
  
  if (req.method === 'GET') {
    const keys = Array.from(adminKeys.values());
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ keys }));
  } else if (req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        const { name } = JSON.parse(body);
        const newKey = generateApiKey(name || 'New Key');
        res.writeHead(201, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ key: newKey }));
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid JSON' }));
      }
    });
  } else {
    res.writeHead(405, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Method not allowed' }));
  }
}

export async function handleAdminKeyDetail(req, res, keyId) {
  const auth = validateAdminKey(req);
  if (!auth.valid) {
    res.writeHead(401, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ error: auth.error }));
  }
  
  const keyInfo = adminKeys.get(keyId);
  if (!keyInfo) {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ error: 'Key not found' }));
  }
  
  if (req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ key: keyInfo }));
  } else if (req.method === 'PUT') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        const updates = JSON.parse(body);
        const updatedKey = { ...keyInfo, ...updates, updatedAt: new Date().toISOString() };
        adminKeys.set(keyId, updatedKey);
        saveKeys();
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ key: updatedKey }));
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid JSON' }));
      }
    });
  } else if (req.method === 'DELETE') {
    adminKeys.delete(keyId);
    saveKeys();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true }));
  } else {
    res.writeHead(405, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Method not allowed' }));
  }
}

export async function handleAdminStatus(req, res, workers) {
  const auth = validateAdminKey(req);
  if (!auth.valid) {
    res.writeHead(401, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ error: auth.error }));
  }
  
  if (req.method === 'GET') {
    const availableWorkers = [...workers.values()].filter(w => !w.busy).length;
    const busyWorkers = [...workers.values()].filter(w => w.busy).length;
    
    const status = {
      system: {
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        platform: process.platform,
        nodeVersion: process.version
      },
      bridge: {
        host: HOST,
        port: PORT,
        workers: {
          total: workers.size,
          available: availableWorkers,
          busy: busyWorkers,
          generating: isGenerating() ? 1 : 0
        },
        authEnabled: [...adminKeys.values()].some(k => k.active),
        config: {
          preferredBrowser: PREFERRED_BROWSER,
          chatUrl: CHAT_URL,
          hideWindow: HIDE_WINDOW
        }
      },
      admin: {
        keysCount: adminKeys.size,
        activeKeys: Array.from(adminKeys.values()).filter(k => k.active).length
      }
    };
    
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(status));
  } else {
    res.writeHead(405, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Method not allowed' }));
  }
}

export async function handleAdminWorkers(req, res, workers) {
  const auth = validateAdminKey(req);
  if (!auth.valid) {
    res.writeHead(401, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ error: auth.error }));
  }
  
  if (req.method === 'GET') {
    const workerList = Array.from(workers.values()).map(w => ({
      id: w.id,
      busy: w.busy,
      lastActivity: w.lastActivity || null
    }));
    
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ workers: workerList }));
  } else if (req.method === 'POST') {
    // Add logical worker slots (single shared Puppeteer browser in worker.mjs)
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        const { count = 1 } = JSON.parse(body);
        let successCount = 0;
        const n = Math.min(20, Math.max(1, Number(count) || 1));

        for (let i = 0; i < n; i++) {
          const workerId = uuidv4();
          workers.set(workerId, { id: workerId, busy: false });
          successCount++;
        }

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          success: true,
          added: successCount,
          total: workers.size
        }));
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid JSON' }));
      }
    });
  } else if (req.method === 'DELETE') {
    // Remove workers
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', async () => {
      try {
        const { count = 1 } = JSON.parse(body);
        const availableWorkers = Array.from(workers.values()).filter(w => !w.busy);
        const toRemove = Math.min(count, availableWorkers.length);
        let removedCount = 0;
        
        for (let i = 0; i < toRemove; i++) {
          const worker = availableWorkers[i];
          try {
            // Note: We can't close individual browser instances easily
            // For now, just remove from pool
            workers.delete(worker.id);
            removedCount++;
          } catch (err) {
            console.error(`Failed to remove worker ${worker.id}:`, err.message);
          }
        }
        
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ 
          success: true, 
          removed: removedCount,
          total: workers.size 
        }));
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid JSON' }));
      }
    });
  } else {
    res.writeHead(405, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Method not allowed' }));
  }
}


export async function handleAdminBrowser(req, res) {
  const auth = validateAdminKey(req);
  if (!auth.valid) {
    res.writeHead(401, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ error: auth.error }));
  }
  
  if (req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ running: isBrowserRunning() }));
  } else if (req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', async () => {
      try {
        const { action } = JSON.parse(body);
        
        if (action === 'show') {
          await showBrowserWindow();
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true, message: 'Browser window shown' }));
        } else if (action === 'hide') {
          await hideBrowserWindow();
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true, message: 'Browser window hidden' }));
        } else {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Invalid action. Use "show" or "hide"' }));
        }
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid JSON' }));
      }
    });
  } else {
    res.writeHead(405, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Method not allowed' }));
  }
}













