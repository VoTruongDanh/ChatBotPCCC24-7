import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: join(__dirname, '..', '.env') });

import http from 'node:http';
import { URL } from 'node:url';
import { HOST, PORT, NUM_WORKERS, getExecutable, PREFERRED_BROWSER } from './config.mjs';
import { WorkerInstance, closeBrowser } from './worker.mjs';
import { buildPrompt } from './prompt-builder.mjs';
import { startHealthMonitor, stopHealthMonitor } from './health-monitor.mjs';
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

registerKeyStore(getAdminKeys);

// ============================================
// SMART QUEUE + SESSION AFFINITY
// ============================================

const workerPool = new Map(); // workerId -> WorkerInstance
const sessionMap = new Map(); // sessionId -> workerId (affinity)
const requestQueue = []; // { resolve, reject, payload, sessionId, timer }

const MAX_QUEUE_SIZE = 50;
const REQUEST_TIMEOUT_MS = 30_000;
const CHAT_RESET_THRESHOLD = 20;

// ============================================
// WORKER POOL MANAGEMENT
// ============================================

async function initWorkerPool() {
  console.log(`[Master] Khởi tạo ${NUM_WORKERS} workers với browser riêng...`);

  const executable = getExecutable();
  if (!executable) {
    throw new Error(
      `Không tìm thấy ${PREFERRED_BROWSER === 'chrome' ? 'Chrome' : 'Edge'}. Vui lòng cài đặt trình duyệt.`
    );
  }
  console.log(`[Master] Sử dụng browser: ${executable}`);
  
  let successCount = 0;
  for (let i = 0; i < NUM_WORKERS; i++) {
    try {
      const worker = new WorkerInstance(i);
      await worker.launch();
      workerPool.set(i, worker);
      successCount++;
      console.log(`[Master] Worker ${i + 1}/${NUM_WORKERS} sẵn sàng: worker-${i}`);
    } catch (err) {
      console.error(`[Master] Lỗi worker ${i + 1}:`, err.message);
    }
  }
  
  if (successCount === 0) {
    throw new Error(
      'Không thể khởi tạo bất kỳ worker nào. Kiểm tra Chrome/Edge và quyền truy cập.'
    );
  }

  console.log(`[Master] Đã khởi tạo ${successCount}/${NUM_WORKERS} workers thành công`);
}

// Tìm worker: ưu tiên session affinity, sau đó worker rảnh bất kỳ
function findWorker(sessionId) {
  // 1. Session affinity: dùng lại worker cũ nếu còn rảnh
  if (sessionId && sessionMap.has(sessionId)) {
    const wId = sessionMap.get(sessionId);
    const w = workerPool.get(wId);
    if (w && !w.busy) return w;
  }
  // 2. Lấy worker rảnh bất kỳ
  for (const w of workerPool.values()) {
    if (!w.busy) return w;
  }
  return null;
}

// Dispatch request vào queue
function dispatch(payload, sessionId) {
  return new Promise((resolve, reject) => {
    if (requestQueue.length >= MAX_QUEUE_SIZE) {
      return reject(new Error('Queue full – hệ thống đang tải cao'));
    }

    const timer = setTimeout(() => {
      const idx = requestQueue.findIndex(r => r.resolve === resolve);
      if (idx !== -1) requestQueue.splice(idx, 1);
      reject(new Error('Request timeout'));
    }, REQUEST_TIMEOUT_MS);

    requestQueue.push({ resolve, reject, payload, sessionId, timer });
    processQueue();
  });
}

// Xử lý queue
async function processQueue() {
  if (requestQueue.length === 0) return;

  const req = requestQueue[0];
  const worker = findWorker(req.sessionId);
  
  if (!worker) {
    // Không có worker rảnh - thông báo cho client đang chờ
    const waitMsg = { waiting: true, queueLength: requestQueue.length, message: 'Đang chờ worker rảnh...' };
    if (req.payload.onDelta) {
      req.payload.onDelta(`[Hệ thống đang bận, bạn đứng thứ ${requestQueue.length} trong hàng đợi...]`);
    }
    console.log(`[Queue] Request chờ - queue length: ${requestQueue.length}`);
    // Tiếp tục loop để check lại sau
    setTimeout(() => processQueue(), 1000);
    return;
  }

  requestQueue.shift();
  clearTimeout(req.timer);

  worker.busy = true;
  if (req.sessionId) sessionMap.set(req.sessionId, worker.id);

  try {
    const result = await worker.sendPromptAndWaitResponse(req.payload.text, req.payload.onDelta);
    req.resolve({ response: result, workerId: worker.id });
  } catch (err) {
    console.error(`[Worker ${worker.id}] Lỗi:`, err.message);
    await worker.restart();
    req.reject(err);
  } finally {
    worker.busy = false;
    worker.lastActive = Date.now();
    processQueue();
  }
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
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Bridge-API-Key, X-Admin-API-Key, X-Session-Token, X-Session-Id');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    return res.end();
  }

  // Route: GET /ping
  if (pathname === '/ping' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ pong: true, time: Date.now() }));
  }

  // Route: GET /health
  if (pathname === '/health' && req.method === 'GET') {
    const available = [...workerPool.values()].filter(w => !w.busy).length;
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({
      status: 'ok',
      workers: workerPool.size,
      available,
      generating: [...workerPool.values()].filter(w => w.busy).length,
      queueLength: requestQueue.length,
      authEnabled: isAuthConfigured(),
      port: PORT
    }));
  }

  // Admin routes
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
    return handleAdminStatus(req, res, workerPool);
  }
  if (pathname === '/admin/browser' && (req.method === 'GET' || req.method === 'POST')) {
    return handleAdminBrowser(req, res);
  }
  if (pathname === '/admin/workers' && (req.method === 'GET' || req.method === 'POST' || req.method === 'DELETE')) {
    return handleAdminWorkers(req, res, workerPool);
  }

  // Auth required
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
      const { prompt, messages, sessionId } = JSON.parse(body);
      const text = prompt || (messages && messages.map(m => m.content).join('\n'));

      if (!text) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ error: 'Thiếu prompt hoặc messages' }));
      }

      try {
        const result = await dispatch({ text }, sessionId);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(result));
      } catch (err) {
        res.writeHead(503, { 'Content-Type': 'application/json' });
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
      const { prompt, messages, rules, sessionId } = JSON.parse(body);
      let text = prompt || (messages && messages.map(m => m.content).join('\n'));

      if (!text) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ error: 'Thiếu prompt hoặc messages' }));
      }

      if (rules && rules.length > 0) {
        text = buildPrompt(rules, text);
      }

      // SSE headers
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*'
      });

      // Gửi thông báo đang chờ nếu chưa có worker rảnh
      const checkWorker = findWorker(sessionId);
      if (!checkWorker) {
        res.write(`data: ${JSON.stringify({ waiting: true, message: '⏳ Hệ thống đang bận, đang chờ worker rảnh...' })}\n\n`);
      }

      try {
        const result = await dispatch({
          text,
          onDelta: (delta) => {
            if (delta) res.write(`data: ${JSON.stringify({ delta })}\n\n`);
          }
        }, sessionId);

        res.write(`data: ${JSON.stringify({ done: true, response: result.response })}\n\n`);
      } catch (err) {
        res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`);
      }

      res.end();
    } catch (err) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Invalid JSON' }));
    }
  });
}

async function handleResetChat(req, res) {
  let body = '';
  req.on('data', chunk => body += chunk);
  req.on('end', async () => {
    try {
      const { sessionId } = JSON.parse(body);
      
      // Reset worker cụ thể nếu có session affinity
      if (sessionId && sessionMap.has(sessionId)) {
        const workerId = sessionMap.get(sessionId);
        const worker = workerPool.get(workerId);
        if (worker) {
          await worker.startNewTemporaryChat();
        }
      } else {
        // Reset tất cả workers
        for (const worker of workerPool.values()) {
          await worker.startNewTemporaryChat();
        }
      }
      
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true }));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: err.message }));
    }
  });
}

// ============================================
// STARTUP
// ============================================

async function start() {
  try {
    await initWorkerPool();
    startHealthMonitor(workerPool);
    server.listen(PORT, HOST, () => {
      console.log(`[Master] be-bridge running at http://${HOST}:${PORT}`);
      console.log(`[Master] Endpoints: /ping, /health, /internal/bridge/chat, /internal/bridge/chat/stream, /internal/bridge/reset-temp-chat`);
      console.log(`[Master] Smart Queue: MAX_QUEUE=${MAX_QUEUE_SIZE}, TIMEOUT=${REQUEST_TIMEOUT_MS}ms`);
      if (isAuthConfigured()) {
        console.log(`[Master] Authentication: ENABLED (${getAdminKeys().filter(k=>k.active).length} active keys)`);
      } else {
        console.log(`[Master] Authentication: DISABLED`);
      }
    });
  } catch (err) {
    console.error('[Master] Lỗi khởi động:', err);
    process.exit(1);
  }
}

process.on('SIGINT', async () => {
  console.log('\n[Master] Đang đóng service...');
  stopHealthMonitor();
  for (const worker of workerPool.values()) {
    await worker.destroy();
  }
  server.close(() => {
    console.log('[Master] Service đã đóng');
    process.exit(0);
  });
});

start();