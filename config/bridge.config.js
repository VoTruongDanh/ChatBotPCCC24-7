/**
 * Bridge System Configuration
 * Single source of truth cho be-bridge và ui-bridge
 */

const env = process.env.NODE_ENV || 'development';

const config = {
  // Environment
  env,
  isDevelopment: env === 'development',
  isProduction: env === 'production',

  // be-bridge Backend
  backend: {
    host: process.env.BRIDGE_HOST || '127.0.0.1',
    port: parseInt(process.env.BRIDGE_PORT || '1122'),
    
    // API Keys
    apiKey: process.env.BRIDGE_API_KEY || 'ACvxG%YkCOu7D+Pe',
    adminApiKey: process.env.BRIDGE_ADMIN_API_KEY || 'bridge_admin_default_key',
    
    // Workers
    numWorkers: parseInt(process.env.BRIDGE_NUM_WORKERS || '2'),
    
    // Browser
    preferredBrowser: process.env.BRIDGE_PREFERRED_BROWSER || 'chrome',
    hideWindow: process.env.BRIDGE_HIDE_WINDOW !== 'false',
    launchMinimized: process.env.BRIDGE_LAUNCH_MINIMIZED !== 'false',
    launchOffscreen: process.env.BRIDGE_LAUNCH_OFFSCREEN === 'true',
    hiddenWindowX: parseInt(process.env.BRIDGE_HIDDEN_WINDOW_X || '-50000'),
    hiddenWindowY: parseInt(process.env.BRIDGE_HIDDEN_WINDOW_Y || '-50000'),
    profileDir: process.env.BRIDGE_PROFILE_DIR || '.bridge-chrome-profile',
    
    // Chat
    chatUrl: process.env.BRIDGE_CHAT_URL || 'https://chatgpt.com/?temporary-chat=true',
    
    // Streaming
    streaming: {
      noChangeThreshold: parseInt(process.env.BRIDGE_STREAM_NO_CHANGE_THRESHOLD || '10'),
      fallbackThreshold: parseInt(process.env.BRIDGE_STREAM_FALLBACK_THRESHOLD || '25'),
      maxTimeout: parseInt(process.env.BRIDGE_STREAM_MAX_TIMEOUT || '120000'),
      startTimeout: parseInt(process.env.BRIDGE_STREAM_START_TIMEOUT || '10000'),
      checkInterval: parseInt(process.env.BRIDGE_STREAM_CHECK_INTERVAL || '200'),
    }
  },

  // ui-bridge Frontend
  frontend: {
    port: parseInt(process.env.UI_BRIDGE_PORT || '3002'),
    apiUrl: process.env.NEXT_PUBLIC_BRIDGE_API_URL || 
            `http://localhost:${process.env.BRIDGE_PORT || '1122'}`,
    adminApiKey: process.env.NEXT_PUBLIC_ADMIN_API_KEY || 
                 process.env.BRIDGE_ADMIN_API_KEY || 
                 'bridge_admin_default_key',
  },

  // Computed URLs
  get backendUrl() {
    return `http://${this.backend.host}:${this.backend.port}`;
  },

  get frontendUrl() {
    return `http://localhost:${this.frontend.port}`;
  }
};

// Validation
function validateConfig() {
  const errors = [];

  if (!config.backend.apiKey) {
    errors.push('BRIDGE_API_KEY is required');
  }

  if (config.backend.numWorkers < 1 || config.backend.numWorkers > 10) {
    errors.push('BRIDGE_NUM_WORKERS must be between 1 and 10');
  }

  if (!['chrome', 'edge'].includes(config.backend.preferredBrowser)) {
    errors.push('BRIDGE_PREFERRED_BROWSER must be "chrome" or "edge"');
  }

  if (errors.length > 0) {
    console.error('❌ Bridge Configuration Errors:');
    errors.forEach(err => console.error(`  - ${err}`));
    if (config.isProduction) {
      throw new Error('Invalid bridge configuration');
    }
  }

  return errors.length === 0;
}

// Export
module.exports = config;

// Auto-validate on load
if (require.main !== module) {
  validateConfig();
}

// CLI usage: node config/bridge.config.js
if (require.main === module) {
  console.log('🔧 Bridge Configuration:\n');
  console.log(JSON.stringify(config, null, 2));
  console.log('\n✅ Validation:', validateConfig() ? 'PASSED' : 'FAILED');
}