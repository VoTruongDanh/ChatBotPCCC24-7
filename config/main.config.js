/**
 * Main System Configuration
 * Single source of truth cho be-main và ui
 */

const env = process.env.NODE_ENV || 'development';

const config = {
  // Environment
  env,
  isDevelopment: env === 'development',
  isProduction: env === 'production',

  // be-main Backend
  backend: {
    host: process.env.MAIN_HOST || '127.0.0.1',
    port: parseInt(process.env.MAIN_PORT || '6969'),
    
    // Bridge connection
    bridge: {
      url: process.env.BRIDGE_URL || 'http://localhost:1122',
      apiKey: process.env.BRIDGE_API_KEY || 'ACvxG%YkCOu7D+Pe',
      timeout: parseInt(process.env.BRIDGE_TIMEOUT || '30000'),
    }
  },

  // ui Frontend
  frontend: {
    port: parseInt(process.env.UI_PORT || '3000'),
    apiUrl: process.env.NEXT_PUBLIC_API_URL || 
            `http://localhost:${process.env.MAIN_PORT || '6969'}`,
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

  if (!config.backend.bridge.url) {
    errors.push('BRIDGE_URL is required');
  }

  if (!config.backend.bridge.apiKey) {
    errors.push('BRIDGE_API_KEY is required');
  }

  if (config.backend.port === config.frontend.port) {
    errors.push('Backend and frontend ports must be different');
  }

  if (errors.length > 0) {
    console.error('❌ Main Configuration Errors:');
    errors.forEach(err => console.error(`  - ${err}`));
    if (config.isProduction) {
      throw new Error('Invalid main configuration');
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

// CLI usage: node config/main.config.js
if (require.main === module) {
  console.log('🔧 Main Configuration:\n');
  console.log(JSON.stringify(config, null, 2));
  console.log('\n✅ Validation:', validateConfig() ? 'PASSED' : 'FAILED');
}