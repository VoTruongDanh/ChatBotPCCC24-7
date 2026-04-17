import 'dotenv/config';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';

function isTruthy(val, def = false) {
  if (val === undefined || val === null || String(val).trim() === '') return Boolean(def);
  return ['1', 'true', 'yes', 'y', 'on'].includes(String(val).trim().toLowerCase());
}

export const HOST = process.env.HOST || '127.0.0.1';
export const PORT = Number(process.env.PORT || 1122);
export const NUM_WORKERS = Math.max(1, Number(process.env.NUM_WORKERS || 2));
export const PREFERRED_BROWSER = process.env.BRIDGE_PREFERRED_BROWSER || 'chrome';
export const CHAT_URL = process.env.CHAT_URL || 'https://chatgpt.com/?temporary-chat=true';
export const HIDE_WINDOW = isTruthy(process.env.BRIDGE_HIDE_CHAT_WINDOW, true);
export const LAUNCH_MINIMIZED = isTruthy(process.env.BRIDGE_LAUNCH_MINIMIZED, HIDE_WINDOW);
export const LAUNCH_OFFSCREEN = isTruthy(process.env.BRIDGE_LAUNCH_OFFSCREEN, false);
export const HIDDEN_X = Number(process.env.BRIDGE_HIDDEN_WINDOW_X || -50000);
export const HIDDEN_Y = Number(process.env.BRIDGE_HIDDEN_WINDOW_Y || -50000);
export const PROFILE_DIR = path.resolve(
  process.env.BRIDGE_PROFILE_DIR || process.cwd(),
  process.env.BRIDGE_PROFILE_DIR ? '' : '.bridge-chrome-profile'
);

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
