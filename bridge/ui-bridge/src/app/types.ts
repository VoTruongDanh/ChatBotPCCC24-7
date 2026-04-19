export interface BridgeConfig {
  HOST: string;
  PORT: number;
  NUM_WORKERS: number;
  PREFERRED_BROWSER: string;
  CHAT_URL: string;
  HIDE_WINDOW: boolean;
  LAUNCH_MINIMIZED: boolean;
  LAUNCH_OFFSCREEN: boolean;
  PROFILE_DIR: string;
  STREAM_NO_CHANGE_THRESHOLD: number;
  STREAM_FALLBACK_THRESHOLD: number;
  STREAM_MAX_TIMEOUT: number;
  STREAM_START_TIMEOUT: number;
  STREAM_CHECK_INTERVAL: number;
  BRIDGE_API_KEY: string;
}

export interface ApiKey {
  id: string;
  name: string;
  key: string;
  createdAt: string;
  lastUsed: string | null;
  active: boolean;
}

export interface Worker {
  id: string;
  busy: boolean;
  lastActivity: string | null;
}

export interface SystemStatus {
  system: {
    uptime: number;
    memory: { rss: number; heapTotal: number; heapUsed: number; external: number };
    platform: string;
    nodeVersion: string;
  };
  bridge: {
    host: string;
    port: number;
    workers: { total: number; available: number; busy: number; generating: number };
    authEnabled: boolean;
    config: { preferredBrowser: string; chatUrl: string; hideWindow: boolean };
  };
  admin: { keysCount: number; activeKeys: number };
}

export type AdminTab = 'overview' | 'config' | 'keys' | 'workers' | 'status';
