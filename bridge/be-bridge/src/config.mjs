/**
 * Bridge Configuration Module
 * Import từ root config để có single source of truth
 */

import { config } from 'dotenv';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Define __dirname first
const __dirname = dirname(fileURLToPath(import.meta.url));

// Load .env from app directory
config({ path: join(__dirname, '..', '.env') });

// Load root config
const rootConfigPath = join(__dirname, '../../../config/bridge.config.js');

let bridgeConfig;
try {
  // Dynamic import cho CommonJS module
  const { createRequire } = await import('module');
  const require = createRequire(import.meta.url);
  bridgeConfig = require(rootConfigPath);
} catch (error) {
  console.warn('[config] Cannot load root config, using fallback:', error.message);
  bridgeConfig = null;
}

// Export config từ root hoặc fallback
export const HOST = bridgeConfig?.backend.host || process.env.BRIDGE_HOST || '127.0.0.1';
export const PORT = bridgeConfig?.backend.port || Number(process.env.BRIDGE_PORT || 1122);
export const NUM_WORKERS = bridgeConfig?.backend.numWorkers || Math.max(1, Number(process.env.BRIDGE_NUM_WORKERS || 2));
export const PREFERRED_BROWSER = bridgeConfig?.backend.preferredBrowser || process.env.BRIDGE_PREFERRED_BROWSER || 'chrome';
export const CHAT_URL = bridgeConfig?.backend.chatUrl || process.env.BRIDGE_CHAT_URL || 'https://chatgpt.com/?temporary-chat=true';
export const HIDE_WINDOW = bridgeConfig?.backend.hideWindow ?? (process.env.BRIDGE_HIDE_WINDOW !== 'false');
export const LAUNCH_MINIMIZED = bridgeConfig?.backend.launchMinimized ?? (process.env.BRIDGE_LAUNCH_MINIMIZED !== 'false');
export const LAUNCH_OFFSCREEN = bridgeConfig?.backend.launchOffscreen ?? (process.env.BRIDGE_LAUNCH_OFFSCREEN === 'true');
export const HIDDEN_X = bridgeConfig?.backend.hiddenWindowX || Number(process.env.BRIDGE_HIDDEN_WINDOW_X || -50000);
export const HIDDEN_Y = bridgeConfig?.backend.hiddenWindowY || Number(process.env.BRIDGE_HIDDEN_WINDOW_Y || -50000);
export const PROFILE_DIR = bridgeConfig?.backend.profileDir || 
  path.resolve(
    process.env.BRIDGE_PROFILE_DIR || process.cwd(),
    process.env.BRIDGE_PROFILE_DIR ? '' : '.bridge-chrome-profile'
  );

// API Keys
export const API_KEY = bridgeConfig?.backend.apiKey || process.env.BRIDGE_API_KEY || '';
export const ADMIN_API_KEY = bridgeConfig?.backend.adminApiKey || process.env.BRIDGE_ADMIN_API_KEY || '';

// Admin login credentials
export const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'admin';
export const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '';

// Streaming Detection Configuration
export const STREAM_NO_CHANGE_THRESHOLD = bridgeConfig?.backend.streaming.noChangeThreshold || 
  Number(process.env.BRIDGE_STREAM_NO_CHANGE_THRESHOLD || 10);
export const STREAM_FALLBACK_THRESHOLD = bridgeConfig?.backend.streaming.fallbackThreshold || 
  Number(process.env.BRIDGE_STREAM_FALLBACK_THRESHOLD || 25);
export const STREAM_MAX_TIMEOUT = bridgeConfig?.backend.streaming.maxTimeout || 
  Number(process.env.BRIDGE_STREAM_MAX_TIMEOUT || 120000);
export const STREAM_START_TIMEOUT = bridgeConfig?.backend.streaming.startTimeout || 
  Number(process.env.BRIDGE_STREAM_START_TIMEOUT || 10000);
export const STREAM_CHECK_INTERVAL = bridgeConfig?.backend.streaming.checkInterval || 
  Number(process.env.BRIDGE_STREAM_CHECK_INTERVAL || 200);

export function getExecutable() {
  if (os.platform() !== 'win32') return null;
  const pf = process.env['ProgramFiles'] || 'C:\\Program Files';
  const pf86 = process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)';
  const la = process.env['LocalAppData'] || path.join(os.homedir(), 'AppData', 'Local');
  const paths = PREFERRED_BROWSER === 'chrome'
    ? [`${pf}\\Google\\Chrome\\Application\\chrome.exe`,
       `${pf86}\\Google\\Chrome\\Application\\chrome.exe`,
       `${la}\\Google\\Chrome\\Application\\chrome.exe`]
    : [`${pf}\\Microsoft\\Edge\\Application\\msedge.exe`,
       `${pf86}\\Microsoft\\Edge\\Application\\msedge.exe`,
       `${la}\\Microsoft\\Edge\\Application\\msedge.exe`];
  for (const p of paths) if (fs.existsSync(p)) return p;
  return null;
}
