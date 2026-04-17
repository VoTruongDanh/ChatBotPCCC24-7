/**
 * Authentication module for be-bridge
 * 
 * Validates API key from requests to ensure only authorized
 * services (like be-main) can access the bridge.
 */

import { API_KEY } from './config.mjs';

const BRIDGE_API_KEY = API_KEY;

/**
 * Check if API key is configured
 * @returns {boolean}
 */
export function isAuthConfigured() {
  return BRIDGE_API_KEY.length > 0;
}

/**
 * Validate API key from request
 * @param {import('node:http').IncomingMessage} req
 * @returns {{valid: boolean, error?: string}}
 */
export function validateApiKey(req) {
  // If no API key configured, allow all requests (backward compatibility)
  if (!BRIDGE_API_KEY) {
    return { valid: true };
  }

  const providedKey = req.headers['x-bridge-api-key'] || '';
  
  if (!providedKey) {
    return { valid: false, error: 'Missing API key' };
  }

  if (providedKey !== BRIDGE_API_KEY) {
    return { valid: false, error: 'Invalid API key' };
  }

  return { valid: true };
}

/**
 * Send unauthorized response
 * @param {import('node:http').ServerResponse} res
 * @param {string} error
 */
export function sendUnauthorized(res, error) {
  res.writeHead(401, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error }));
}
