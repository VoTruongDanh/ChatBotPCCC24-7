import { validateSession } from './admin.mjs';

// getAdminKeys được export từ admin.mjs để tránh circular dependency
let _getKeys = null;
export function registerKeyStore(fn) { _getKeys = fn; }

export function isAuthConfigured() {
  if (!_getKeys) return false;
  return _getKeys().some(k => k.active);
}

export function validateApiKey(req) {
  const key = req.headers['x-bridge-api-key'] || '';
  if (!key) return { valid: false, error: 'Missing API key' };
  if (!_getKeys) return { valid: false, error: 'Key store not initialized' };
  const keys = _getKeys();
  const match = keys.find(k => k.key === key && k.active);
  if (!match) return { valid: false, error: 'Invalid API key' };
  // Update lastUsed
  match.lastUsed = new Date().toISOString();
  return { valid: true };
}

export function sendUnauthorized(res, error) {
  res.writeHead(401, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error }));
}
