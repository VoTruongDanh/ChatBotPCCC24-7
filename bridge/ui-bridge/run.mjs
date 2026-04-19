import { config } from 'dotenv';
import { spawn } from 'child_process';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: join(__dirname, '.env') });

const mode = process.argv[2] || 'dev';
const port = process.env.UI_BRIDGE_PORT || '1111';

const child = spawn('next', [mode, '-p', port], {
  stdio: 'inherit',
  shell: true,
  env: { ...process.env },
});

child.on('exit', code => process.exit(code ?? 0));
