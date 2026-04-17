#!/usr/bin/env node

/**
 * Script kiểm tra cấu hình của tất cả services
 */

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const services = [
  {
    name: 'be-bridge',
    path: 'apps/be-bridge/.env',
    required: ['HOST', 'PORT', 'BRIDGE_API_KEY', 'NUM_WORKERS'],
    optional: ['BRIDGE_PREFERRED_BROWSER', 'CHAT_URL']
  },
  {
    name: 'be-main',
    path: 'apps/be-main/.env',
    required: ['HOST', 'PORT', 'BRIDGE_URL', 'BRIDGE_API_KEY'],
    optional: []
  },
  {
    name: 'ui',
    path: 'apps/ui/.env',
    required: ['NEXT_PUBLIC_API_URL'],
    optional: []
  },
  {
    name: 'ui-bridge',
    path: 'apps/ui-bridge/.env',
    required: ['NEXT_PUBLIC_BRIDGE_API_URL', 'NEXT_PUBLIC_ADMIN_API_KEY'],
    optional: []
  }
];

function parseEnv(content) {
  const env = {};
  const lines = content.split('\n');
  
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    
    const [key, ...valueParts] = trimmed.split('=');
    if (key && valueParts.length > 0) {
      env[key.trim()] = valueParts.join('=').trim();
    }
  }
  
  return env;
}

function checkService(service) {
  console.log(`\n📦 Checking ${service.name}...`);
  
  if (!existsSync(service.path)) {
    console.log(`  ❌ File not found: ${service.path}`);
    return false;
  }
  
  const content = readFileSync(service.path, 'utf-8');
  const env = parseEnv(content);
  
  let allGood = true;
  
  // Check required variables
  for (const key of service.required) {
    if (!env[key] || env[key] === '') {
      console.log(`  ❌ Missing required: ${key}`);
      allGood = false;
    } else {
      console.log(`  ✅ ${key}=${env[key]}`);
    }
  }
  
  // Check optional variables
  for (const key of service.optional) {
    if (env[key]) {
      console.log(`  ℹ️  ${key}=${env[key]}`);
    }
  }
  
  return allGood;
}

function checkConnections() {
  console.log('\n🔗 Checking connections...');
  
  // Read configs
  const bridgeEnv = parseEnv(readFileSync('apps/be-bridge/.env', 'utf-8'));
  const mainEnv = parseEnv(readFileSync('apps/be-main/.env', 'utf-8'));
  const uiEnv = parseEnv(readFileSync('apps/ui/.env', 'utf-8'));
  const uiBridgeEnv = parseEnv(readFileSync('apps/ui-bridge/.env', 'utf-8'));
  
  // Check be-main → be-bridge
  const bridgeUrl = `http://${bridgeEnv.HOST}:${bridgeEnv.PORT}`;
  if (mainEnv.BRIDGE_URL === bridgeUrl || mainEnv.BRIDGE_URL === `http://localhost:${bridgeEnv.PORT}`) {
    console.log(`  ✅ be-main → be-bridge: ${mainEnv.BRIDGE_URL}`);
  } else {
    console.log(`  ⚠️  be-main BRIDGE_URL mismatch:`);
    console.log(`     Expected: ${bridgeUrl} or http://localhost:${bridgeEnv.PORT}`);
    console.log(`     Got: ${mainEnv.BRIDGE_URL}`);
  }
  
  // Check API keys match
  if (bridgeEnv.BRIDGE_API_KEY === mainEnv.BRIDGE_API_KEY) {
    console.log(`  ✅ BRIDGE_API_KEY matches`);
  } else {
    console.log(`  ❌ BRIDGE_API_KEY mismatch:`);
    console.log(`     be-bridge: ${bridgeEnv.BRIDGE_API_KEY}`);
    console.log(`     be-main: ${mainEnv.BRIDGE_API_KEY}`);
  }
  
  // Check ui → be-main
  const mainUrl = `http://${mainEnv.HOST}:${mainEnv.PORT}`;
  if (uiEnv.NEXT_PUBLIC_API_URL === mainUrl || uiEnv.NEXT_PUBLIC_API_URL === `http://localhost:${mainEnv.PORT}`) {
    console.log(`  ✅ ui → be-main: ${uiEnv.NEXT_PUBLIC_API_URL}`);
  } else {
    console.log(`  ⚠️  ui API_URL mismatch:`);
    console.log(`     Expected: ${mainUrl} or http://localhost:${mainEnv.PORT}`);
    console.log(`     Got: ${uiEnv.NEXT_PUBLIC_API_URL}`);
  }
  
  // Check ui-bridge → be-bridge
  if (uiBridgeEnv.NEXT_PUBLIC_BRIDGE_API_URL === bridgeUrl || uiBridgeEnv.NEXT_PUBLIC_BRIDGE_API_URL === `http://localhost:${bridgeEnv.PORT}`) {
    console.log(`  ✅ ui-bridge → be-bridge: ${uiBridgeEnv.NEXT_PUBLIC_BRIDGE_API_URL}`);
  } else {
    console.log(`  ⚠️  ui-bridge BRIDGE_API_URL mismatch:`);
    console.log(`     Expected: ${bridgeUrl} or http://localhost:${bridgeEnv.PORT}`);
    console.log(`     Got: ${uiBridgeEnv.NEXT_PUBLIC_BRIDGE_API_URL}`);
  }
}

function main() {
  console.log('🔍 Configuration Checker\n');
  console.log('='.repeat(50));
  
  let allServicesOk = true;
  
  for (const service of services) {
    const ok = checkService(service);
    if (!ok) allServicesOk = false;
  }
  
  checkConnections();
  
  console.log('\n' + '='.repeat(50));
  
  if (allServicesOk) {
    console.log('\n✅ All configurations look good!');
    console.log('\nYou can start the services with:');
    console.log('  npm run dev');
  } else {
    console.log('\n❌ Some configurations are missing or incorrect.');
    console.log('\nPlease fix the issues above before starting the services.');
  }
}

main();