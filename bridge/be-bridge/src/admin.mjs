/**
 * Admin API module for be-bridge
 * 
 * Provides endpoints for:
 * - Managing configuration
 * - Generating API keys
 * - Managing workers
 * - System monitoring
 */

import 'dotenv/config';
import { v4 as uuidv4 } from 'uuid';
import fs from 'node:fs';
import path from 'node:path';
import { 
  HOST, PORT, NUM_WORKERS, PREFERRED_BROWSER, CHAT_URL, HIDE_WINDOW,
  LAUNCH_MINIMIZED, LAUNCH_OFFSCREEN, PROFILE_DIR,
  STREAM_NO_CHANGE_THRESHOLD, STREAM_FALLBACK_THRESHOLD,
  STREAM_MAX_TIMEOUT, STREAM_START_TIMEOUT, STREAM_CHECK_INTERVAL,
  API_KEY, ADMIN_API_KEY
} from './config.mjs';
import { launchBrowser, closeBrowser, isGenerating } from './worker.mjs';
import { isAuthConfigured } from './auth.mjs';

// In-memory store for admin API keys (in production, use database)
const adminKeys = new Map();
const configFilePath = path.join(process.cwd(), '.env');

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
    BRIDGE_API_KEY: API_KEY,
    BRIDGE_ADMIN_API_KEY: ADMIN_API_KEY
  };
  return config;
}

/**
 * Save configuration to .env file
 */
function saveConfig(newConfig) {
  const envLines = [];
  
  // Add all config values
  envLines.push(`HOST=${newConfig.HOST || HOST}`);
  envLines.push(`PORT=${newConfig.PORT || PORT}`);
  envLines.push(`NUM_WORKERS=${newConfig.NUM_WORKERS || NUM_WORKERS}`);
  envLines.push(`BRIDGE_PREFERRED_BROWSER=${newConfig.PREFERRED_BROWSER || PREFERRED_BROWSER}`);
  envLines.push(`CHAT_URL=${newConfig.CHAT_URL || CHAT_URL}`);
  envLines.push(`BRIDGE_HIDE_CHAT_WINDOW=${newConfig.HIDE_WINDOW ? 'true' : 'false'}`);
  envLines.push(`BRIDGE_LAUNCH_MINIMIZED=${newConfig.LAUNCH_MINIMIZED ? 'true' : 'false'}`);
  envLines.push(`BRIDGE_LAUNCH_OFFSCREEN=${newConfig.LAUNCH_OFFSCREEN ? 'true' : 'false'}`);
  envLines.push(`BRIDGE_PROFILE_DIR=${newConfig.PROFILE_DIR || PROFILE_DIR}`);
  envLines.push(`STREAM_NO_CHANGE_THRESHOLD=${newConfig.STREAM_NO_CHANGE_THRESHOLD || STREAM_NO_CHANGE_THRESHOLD}`);
  envLines.push(`STREAM_FALLBACK_THRESHOLD=${newConfig.STREAM_FALLBACK_THRESHOLD || STREAM_FALLBACK_THRESHOLD}`);
  envLines.push(`STREAM_MAX_TIMEOUT=${newConfig.STREAM_MAX_TIMEOUT || STREAM_MAX_TIMEOUT}`);
  envLines.push(`STREAM_START_TIMEOUT=${newConfig.STREAM_START_TIMEOUT || STREAM_START_TIMEOUT}`);
  envLines.push(`STREAM_CHECK_INTERVAL=${newConfig.STREAM_CHECK_INTERVAL || STREAM_CHECK_INTERVAL}`);
  
  // Only save API key if provided (for security)
  if (newConfig.BRIDGE_API_KEY) {
    envLines.push(`BRIDGE_API_KEY=${newConfig.BRIDGE_API_KEY}`);
  } else if (process.env.BRIDGE_API_KEY) {
    envLines.push(`BRIDGE_API_KEY=${process.env.BRIDGE_API_KEY}`);
  }
  
  try {
    fs.writeFileSync(configFilePath, envLines.join('\n'));
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
  return keyInfo;
}

/**
 * Validate admin API key
 */
export function validateAdminKey(req) {
  const providedKey = req.headers['x-admin-api-key'] || req.headers['X-Admin-API-Key'] || '';
  
  if (!providedKey) {
    return { valid: false, error: 'Missing admin API key' };
  }
  
  // Check if key exists in our store
  for (const [id, keyInfo] of adminKeys) {
    if (keyInfo.key === providedKey && keyInfo.active) {
      return { valid: true, keyId: id };
    }
  }
  
  return { valid: false, error: 'Invalid admin API key' };
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
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ key: updatedKey }));
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid JSON' }));
      }
    });
  } else if (req.method === 'DELETE') {
    adminKeys.delete(keyId);
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
        authEnabled: isAuthConfigured(),
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
    // Add new worker
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', async () => {
      try {
        const { count = 1 } = JSON.parse(body);
        let successCount = 0;
        
        for (let i = 0; i < count; i++) {
          const workerId = uuidv4();
          try {
            await launchBrowser();
            workers.set(workerId, { id: workerId, busy: false });
            successCount++;
          } catch (err) {
            console.error(`Failed to add worker ${i + 1}:`, err.message);
          }
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

// Initialize with a default admin key for first-time setup
const defaultAdminKey = generateApiKey('Default Admin Key');
console.log(`[Admin] Default admin key generated: ${defaultAdminKey.key.slice(0, 8)}...`);