#!/usr/bin/env node

/**
 * Config Sync Script
 * Sync từ module .env files sang app .env files
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.join(__dirname, '..');

// Module configs
const modules = [
  {
    name: 'bridge',
    envFile: path.join(rootDir, 'bridge', '.env'),
    apps: [
      { name: 'be-bridge', path: path.join(rootDir, 'bridge', 'be-bridge', '.env') },
      { name: 'ui-bridge', path: path.join(rootDir, 'bridge', 'ui-bridge', '.env') }
    ]
  },
  {
    name: 'pccc',
    envFile: path.join(rootDir, 'pccc', '.env'),
    apps: [
      { name: 'be-main', path: path.join(rootDir, 'pccc', 'be-main', '.env') },
      { name: 'ui', path: path.join(rootDir, 'pccc', 'ui', '.env') }
    ]
  }
];

console.log('🔄 Syncing configuration from module .env files...\n');

let successCount = 0;
let totalCount = 0;

for (const module of modules) {
  // Check if module .env exists
  if (!fs.existsSync(module.envFile)) {
    console.error(`❌ ${module.name} .env not found: ${module.envFile}`);
    continue;
  }

  // Read module .env
  const envContent = fs.readFileSync(module.envFile, 'utf-8');

  // Sync to each app
  for (const app of module.apps) {
    totalCount++;
    try {
      // Ensure directory exists
      const appDir = path.dirname(app.path);
      if (!fs.existsSync(appDir)) {
        fs.mkdirSync(appDir, { recursive: true });
      }

      // Write .env file
      fs.writeFileSync(app.path, envContent);
      console.log(`✅ ${app.name.padEnd(15)} → ${path.relative(rootDir, app.path)}`);
      successCount++;
    } catch (error) {
      console.error(`❌ ${app.name.padEnd(15)} → Error: ${error.message}`);
    }
  }
}

console.log(`\n✅ Synced ${successCount}/${totalCount} apps`);
console.log('\n💡 Tip: Run this script after updating module .env files\n');
