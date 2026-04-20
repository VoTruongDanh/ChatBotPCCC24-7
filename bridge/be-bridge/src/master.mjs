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
// WORKER POOL
// ============================================

const workerPool = new Map();
const sessionMap = new Map();

async function initWorkerPool() {
  console.log(`[Master] Khởi tạo ${NUM_WORKERS} workers với browser riêng...`);

  const executable = getExecutable();
  if (!executable) {
    throw new Error(`Không tìm thấy ${PREFERRED_BROWSER === 'chrome' ? 'Chrome' : 'Edge'}.`);
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
    throw new Error('Không thể khởi tạo worker nào.');
  }

  console.log(`[Master] Đã khởi tạo ${successCount}/${NUM_WORKERS} workers`);
}

function findWorker(sessionId) {
  if (sessionId && sessionMap.has(sessionId)) {
    const wId = sessionMap.get(sessionId);
    const w = workerPool.get(wId);
    if (w && !w.busy) return w;
  }
  for (const w of workerPool.values()) {
    if (!w.busy) return w;
  }
  return null;
}

// Queue và retry
const requestQueue = [];
let isProcessing = false;

async function processQueue() {
  if (isProcessing || requestQueue.length === 0) return;
  isProcessing = true;

  while (requestQueue.length > 0) {
    const worker = findWorker(null);
    if (!worker) break;

    const req = requestQueue.shift();
    worker.busy = true;
    if (req.sessionId) sessionMap.set(req.sessionId, worker.id);

    // Gửi thông báo đang xử lý
    if (req.onDelta) {
      req.onDelta('🔄 Đang xử lý...');
    }

    try {
      const result = await worker.sendPromptAndWaitResponse(req.text, req.onDelta);
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

  isProcessing = false;
}

function dispatch(payload, sessionId) {
  return new Promise((resolve, reject) => {
    // Thử lấy worker ngay
    const worker = findWorker(sessionId);
    if (worker) {
      worker.busy = true;
      if (sessionId) sessionMap.set(sessionId, worker.id);

      worker.sendPromptAndWaitResponse(payload.text, payload.onDelta)
        .then(result => resolve({ response: result, workerId: worker.id }))
        .catch(async err => {
          console.error(`[Worker ${worker.id}] Lỗi:`, err.message);
          await worker.restart();
          reject(err);
        })
        .finally(() => {
          worker.busy = false;
          worker.lastActive = Date.now();
          processQueue();
        });
      return;
    }

    // Không có worker rảnh - vào queue và thông báo
    if (payload.onDelta) {
      payload.onDelta(`⏳ Đang chờ... (${requestQueue.length + 1} người trong hàng đợi)`);
    }
    
    requestQueue.push({ 
      text: payload.text, 
      onDelta: payload.onDelta, 
      sessionId, 
      resolve, 
      reject 
    });
    
    // Thử process sau 2 giây
    setTimeout(() => processQueue(), 2000);
  });
}

// ============================================
// HTTP SERVER
// ============================================

const server = http.createServer(async (req, res) => {
  const parsedUrl = new URL(req.url, `http://${req.headers.host}`);
  const pathname = parsedUrl.pathname;

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Bridge-API-Key, X-Admin-API-Key, X-Session-Token, X-Session-Id');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    return res.end();
  }

  if (pathname === '/ping' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ pong: true, time: Date.now() }));
  }

  if (pathname === '/health' && req.method === 'GET') {
    const available = [...workerPool.values()].filter(w => !w.busy).length;
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({
      status: 'ok',
      workers: workerPool.size,
      available,
      generating: [...workerPool.values()].filter(w => w.busy).length,
      authEnabled: isAuthConfigured(),
      port: PORT
    }));
  }

  if (pathname === '/admin/login' && req.method === 'POST') return handleAdminLogin(req, res);
  if (pathname === '/admin/logout' && req.method === 'POST') return handleAdminLogout(req, res);
  if (pathname === '/admin/config' && (req.method === 'GET' || req.method === 'PUT')) return handleAdminConfig(req, res);
  if (pathname === '/admin/keys' && (req.method === 'GET' || req.method === 'POST')) return handleAdminKeys(req, res);
  if (pathname.startsWith('/admin/keys/')) return handleAdminKeyDetail(req, res, pathname.split('/')[3]);
  if (pathname === '/admin/status' && req.method === 'GET') return handleAdminStatus(req, res, workerPool);
  if (pathname === '/admin/browser' && (req.method === 'GET' || req.method === 'POST')) return handleAdminBrowser(req, res);
  if (pathname === '/admin/workers' && (req.method === 'GET' || req.method === 'POST' || req.method === 'DELETE')) return handleAdminWorkers(req, res, workerPool);

  const auth = validateApiKey(req);
  if (!auth.valid) return sendUnauthorized(res, auth.error);

  if (pathname === '/internal/bridge/chat' && req.method === 'POST') return handleChat(req, res);
  if (pathname === '/internal/bridge/chat/stream' && req.method === 'POST') return handleChatStream(req, res);
  if (pathname === '/internal/bridge/reset-temp-chat' && req.method === 'POST') return handleResetChat(req, res);

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

      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*'
      });

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
      
      if (sessionId && sessionMap.has(sessionId)) {
        const workerId = sessionMap.get(sessionId);
        const worker = workerPool.get(workerId);
        if (worker) await worker.startNewTemporaryChat();
      } else {
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
    server.listen(PORT, HOST, () => {
      console.log(`[Master] be-bridge running at http://${HOST}:${PORT}`);
      if (isAuthConfigured()) {
        console.log(`[Master] Authentication: ENABLED (${getAdminKeys().filter(k=>k.active).length} keys)`);
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
  for (const worker of workerPool.values()) {
    await worker.destroy();
  }
  server.close(() => {
    console.log('[Master] Service đã đóng');
    process.exit(0);
  });
});

start();