const fs = require('fs');
let c = fs.readFileSync('C:\\CNX\\ChatBotPCCC\\bridge\\be-bridge\\src\\admin.mjs', 'utf8');

// Find the position after saveKeys function
const marker = "}\\nexport function getAdminKeys()";
const idx = c.indexOf(marker);
if (idx === -1) {
  console.log('Marker not found');
  process.exit(1);
}

const syncFunc = `

// Sync active key to bridge/.env for config sync
function syncKeyToEnv(key) {
  try {
    let envContent = '';
    if (fs.existsSync(BRIDGE_ENV_PATH)) {
      envContent = fs.readFileSync(BRIDGE_ENV_PATH, 'utf8');
    }
    
    const keyLine = \`BRIDGE_API_KEY=\${key}\`;
    if (envContent.includes('BRIDGE_API_KEY=')) {
      envContent = envContent.replace(/^BRIDGE_API_KEY=.*$/m, keyLine);
    } else {
      envContent += \`\\n\${keyLine}\\n\`;
    }
    
    fs.writeFileSync(BRIDGE_ENV_PATH, envContent, 'utf8');
    console.log('[admin] Synced BRIDGE_API_KEY to bridge/.env');
  } catch (e) { console.warn('[admin] Cannot sync key to .env:', e.message); }
}
`;

c = c.substring(0, idx) + syncFunc + c.substring(idx);

// Modify generateApiKey to sync key to env
c = c.replace(
  'adminKeys.set(keyInfo.id, keyInfo);\\n  saveKeys();\\n  return keyInfo;',
  `adminKeys.set(keyInfo.id, keyInfo);
  saveKeys();
  syncKeyToEnv(key);
  return keyInfo;`
);

// Modify handleAdminKeyDetail PUT to sync key to env when activating
c = c.replace(
  'const updatedKey = { ...keyInfo, ...updates, updatedAt: new Date().toISOString() };\\n        adminKeys.set(keyId, updatedKey);\\n        saveKeys();',
  `const updatedKey = { ...keyInfo, ...updates, updatedAt: new Date().toISOString() };
        adminKeys.set(keyId, updatedKey);
        saveKeys();
        if (updatedKey.active) syncKeyToEnv(updatedKey.key);`
);

fs.writeFileSync('C:\\CNX\\ChatBotPCCC\\bridge\\be-bridge\\src\\admin.mjs', c, 'utf8');
console.log('Done');
