import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Load .env từ thư mục app TRƯỚC khi import các module khác
const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: join(__dirname, '..', '.env') });

// Import các module SAU khi đã load .env
import http from 'node:http';
import { URL } from 'node:url';
import { v4 as uuidv4 } from 'uuid';
import { HOST, PORT, NUM_WORKERS, getExecutable, PREFERRED_BROWSER } from './config.mjs';
import {
  launchBrowser,
  closeBrowser,
  sendPromptAndWaitResponse,
  startNewTemporaryChat,
} from './worker.mjs';
import { buildPrompt } from './prompt-builder.mjs';
import { validateApiKey, sendUnauthorized, isAuthConfigured, registerKeyStore } from './auth.mjs';
import { 
  handleAdminConfig, 
  handleAdminKeys, 
  handleAdminKeyDetail, 
  handleAdminStatus, 
  handleAdminWorkers, handleAdminBrowser,
  handleAdminLogin, handleAdminLogout,
  getAdminKeys
} from './admin.mjs';

// Wire key store vào auth module
registerKeyStore(getAdminKeys);

// Worker pool
const workers = new Map();

// Chat counter - reset sau 20 lượt
let chatCounter = 0;
const CHAT_RESET_THRESHOLD = 20;

// ============================================
// WORKER POOL MANAGEMENT
// ============================================

async function initWorkerPool() {
  console.log(`[Master] Khởi tạo ${NUM_WORKERS} workers...`);

  // Kiểm tra Chrome/Edge trước
  const executable = getExecutable();
  if (!executable) {
    throw new Error(
      `Không tìm thấy ${PREFERRED_BROWSER === 'chrome' ? 'Chrome' : 'Edge'}. Vui lòng cài đặt trình duyệt.`
    );
  }
  console.log(`[Master] Sử dụng browser: ${executable}`);
  
  let successCount = 0;
  for (let i = 0; i < NUM_WORKERS; i++) {
    const workerId = uuidv4();
    try {
      await launchBrowser();
      workers.set(workerId, { id: workerId, busy: false });
      successCount++;
      console.log(`[Master] Worker ${i + 1}/${NUM_WORKERS} sẵn sàng: ${workerId.slice(0, 8)}`);
    } catch (err) {
      console.error(`[Master] Lỗi worker ${i + 1}:`, err.message);
      console.error(`[Master] Stack trace:`, err.stack);
    }
  }
  
  if (successCount === 0) {
    throw new Error(
      'Không thể khởi tạo bất kỳ worker nào. Kiểm tra Chrome/Edge và quyền truy cập.'
    );
  }

  console.log(`[Master] Đã khởi tạo ${successCount}/${NUM_WORKERS} workers thành công`);
}

function getAvailableWorker() {
  for (const [id, w] of workers) {
    if (!w.busy) return id;
  }
  return null;
}

function setWorkerBusy(workerId, busy) {
  const worker = workers.get(workerId);
  if (worker) worker.busy = busy;
}

// ============================================
// HTTP SERVER & ROUTES
// ============================================

const server = http.createServer(async (req, res) => {
  const parsedUrl = new URL(req.url, `http://${req.headers.host}`);
  const pathname = parsedUrl.pathname;

  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Bridge-API-Key, X-Admin-API-Key, X-Session-Token');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    return res.end();
  }

  // Route: GET /ping (no auth required)
  if (pathname === '/ping' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ pong: true, time: Date.now() }));
  }

  // Route: GET /health (no auth required)
  if (pathname === '/health' && req.method === 'GET') {
    const available = [...workers.values()].filter(w => !w.busy).length;
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({
      status: 'ok',
      workers: workers.size,
      available,
      generating: [...workers.values()].filter(w => w.busy).length,
      authEnabled: isAuthConfigured(),
      port: PORT
    }));
  }

  
  // Admin routes (require admin API key)
  if (pathname === '/admin/login' && req.method === 'POST') {
    return handleAdminLogin(req, res);
  }

  if (pathname === '/admin/logout' && req.method === 'POST') {
    return handleAdminLogout(req, res);
  }

  if (pathname === '/admin/config' && (req.method === 'GET' || req.method === 'PUT')) {
    return handleAdminConfig(req, res);
  }
  
  if (pathname === '/admin/keys' && (req.method === 'GET' || req.method === 'POST')) {
    return handleAdminKeys(req, res);
  }
  
  if (pathname.startsWith('/admin/keys/')) {
    const keyId = pathname.split('/')[3];
    return handleAdminKeyDetail(req, res, keyId);
  }
  
  if (pathname === '/admin/status' && req.method === 'GET') {
    return handleAdminStatus(req, res, workers);
  }
  
  if (pathname === '/admin/browser' && (req.method === 'GET' || req.method === 'POST')) {
    return handleAdminBrowser(req, res);
  }
  
  if (pathname === '/admin/workers' && (req.method === 'GET' || req.method === 'POST' || req.method === 'DELETE')) {
    return handleAdminWorkers(req, res, workers);
  }
  // All other routes require authentication
  const auth = validateApiKey(req);
  if (!auth.valid) {
    return sendUnauthorized(res, auth.error);
  }

  // Route: POST /internal/bridge/chat
  if (pathname === '/internal/bridge/chat' && req.method === 'POST') {
    return handleChat(req, res);
  }

  // Route: POST /internal/bridge/chat/stream
  if (pathname === '/internal/bridge/chat/stream' && req.method === 'POST') {
    return handleChatStream(req, res);
  }

  // Route: POST /internal/bridge/reset-temp-chat
  if (pathname === '/internal/bridge/reset-temp-chat' && req.method === 'POST') {
    return handleResetChat(req, res);
  }


  // 404
  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Not found' }));
});

// ============================================
// HANDLERS
// ============================================

async function handleChat(req, res) {
  let body = '';
  req.on('data', chunk => body += chunk);
  req.on('end', async () => {
    try {
      const { prompt, messages } = JSON.parse(body);
      const text = prompt || (messages && messages.map(m => m.content).join('\n'));

      if (!text) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ error: 'Thiếu prompt hoặc messages' }));
      }

      const workerId = getAvailableWorker();
      if (!workerId) {
        res.writeHead(503, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ error: 'Không có worker sẵn sàng' }));
      }

      setWorkerBusy(workerId, true);
      console.log(`[Master] Chat request từ worker ${workerId.slice(0, 8)}`);

      try {
        const response = await sendPromptAndWaitResponse(text);
        setWorkerBusy(workerId, false);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ response, workerId: workerId.slice(0, 8) }));
      } catch (err) {
        setWorkerBusy(workerId, false);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
    } catch (err) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Invalid JSON' }));
    }
  });
}

async function handleChatStream(req, res) {
  let body = '';
  req.on('data', chunk => body += chunk);
  req.on('end', async () => {
    try {
      const { prompt, messages, rules } = JSON.parse(body);
      let text = prompt || (messages && messages.map(m => m.content).join('\n'));

      if (!text) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ error: 'Thiếu prompt hoặc messages' }));
      }

      // Build prompt với rules nếu có
      if (rules && rules.length > 0) {
        text = buildPrompt(rules, text);
      }

      const workerId = getAvailableWorker();
      if (!workerId) {
        res.writeHead(503, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ error: 'Không có worker sẵn sàng' }));
      }

      setWorkerBusy(workerId, true);

      // SSE headers
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*'
      });

      console.log(`[Master] Stream request từ worker ${workerId.slice(0, 8)}`);

      try {
        const response = await sendPromptAndWaitResponse(text, (delta) => {
          if (delta) {
            res.write(`data: ${JSON.stringify({ delta })}\n\n`);
          }
        });
        res.write(`data: ${JSON.stringify({ done: true, response })}\n\n`);

        // Tăng counter sau khi response thành công
        chatCounter++;
        console.log(`[Master] Chat counter: ${chatCounter}/${CHAT_RESET_THRESHOLD}`);

        // Reset chat sau 20 lượt - kích hoạt ngay lập tức
        if (chatCounter >= CHAT_RESET_THRESHOLD) {
          console.log('[Master] Đạt ngưỡng 20 lượt, reset chat...');
          chatCounter = 0;
          startNewTemporaryChat().catch(e => console.warn('[Master] Reset error:', e.message));
        }
      } catch (err) {

        res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`);
      }

      setWorkerBusy(workerId, false);
      res.end();
    } catch (err) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Invalid JSON' }));
    }
  });
}

async function handleResetChat(req, res) {
  try {
    await startNewTemporaryChat();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true }));
  } catch (err) {
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: err.message }));
  }
}

// ============================================
// STARTUP
// ============================================

async function start() {
  try {
    await initWorkerPool();
    server.listen(PORT, HOST, () => {
      console.log(`[Master] be-bridge running at http://${HOST}:${PORT}`);
      console.log(`[Master] Endpoints: /ping, /health, /internal/bridge/chat, /internal/bridge/chat/stream, /internal/bridge/reset-temp-chat`);
      if (isAuthConfigured()) {
        console.log(`[Master] Authentication: ENABLED (${getAdminKeys().filter(k=>k.active).length} active keys)`);
      } else {
        console.log(`[Master] Authentication: DISABLED (no active keys — tao key trong Admin Dashboard)`);
      }
    });
  } catch (err) {
    console.error('[Master] Lỗi khởi động:', err);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n[Master] Đang đóng service...');
  await closeBrowser();
  server.close(() => {
    console.log('[Master] Service đã đóng');
    process.exit(0);
  });
});

start();



