/**
 * Root Configuration
 * Master config file - imports và exports tất cả configs
 */

const bridgeConfig = require('./bridge.config');
const mainConfig = require('./main.config');

const config = {
  bridge: bridgeConfig,
  main: mainConfig,

  // Global settings
  global: {
    env: process.env.NODE_ENV || 'development',
    logLevel: process.env.LOG_LEVEL || 'info',
  },

  // All services
  get allServices() {
    return {
      'be-bridge': {
        url: this.bridge.backendUrl,
        port: this.bridge.backend.port,
      },
      'ui-bridge': {
        url: this.bridge.frontendUrl,
        port: this.bridge.frontend.port,
      },
      'be-main': {
        url: this.main.backendUrl,
        port: this.main.backend.port,
      },
      'ui': {
        url: this.main.frontendUrl,
        port: this.main.frontend.port,
      }
    };
  },

  // Check if all ports are unique
  validatePorts() {
    const ports = [
      this.bridge.backend.port,
      this.bridge.frontend.port,
      this.main.backend.port,
      this.main.frontend.port,
    ];

    const uniquePorts = new Set(ports);
    if (uniquePorts.size !== ports.length) {
      console.error('❌ Port conflict detected!');
      console.error('Ports:', ports);
      return false;
    }

    return true;
  },

  // Print all config
  print() {
    console.log('🔧 Complete System Configuration\n');
    console.log('=' .repeat(60));
    
    console.log('\n📦 Services:');
    Object.entries(this.allServices).forEach(([name, service]) => {
      console.log(`  ${name.padEnd(15)} → ${service.url}`);
    });

    console.log('\n🔑 API Keys:');
    console.log(`  Bridge API Key:      ${this.bridge.backend.apiKey.slice(0, 8)}...`);
    console.log(`  Bridge Admin Key:    ${this.bridge.backend.adminApiKey.slice(0, 8)}...`);

    console.log('\n👷 Workers:');
    console.log(`  Number:              ${this.bridge.backend.numWorkers}`);
    console.log(`  Browser:             ${this.bridge.backend.preferredBrowser}`);

    console.log('\n' + '='.repeat(60));
    console.log('✅ Ports validation:', this.validatePorts() ? 'PASSED' : 'FAILED');
  }
};

// Export
module.exports = config;

// CLI usage: node config/index.js
if (require.main === module) {
  config.print();
}