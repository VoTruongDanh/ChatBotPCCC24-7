import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SITE_SALES_CONTEXT_FILE = path.join(__dirname, '../../data/site-sales-context.json');

export function getSiteSalesContext() {
  try {
    const data = fs.readFileSync(SITE_SALES_CONTEXT_FILE, 'utf-8');
    return JSON.parse(data);
  } catch {
    return null;
  }
}
