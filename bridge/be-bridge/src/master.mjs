import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: join(__dirname, '..', '.env') });

import http from 'node:http';
import { URL } from 'node:url';
import { HOST, PORT, NUM_WORKERS, getExecutable, PREFERRED_BROWSER } from './config.mjs';
import { WorkerInstance } from './worker.mjs';
import { buildPrompt } from './prompt-builder.mjs';
import { validateApiKey, sendUnauthorized, isAuthConfigured, registerKeyStore } from './auth.mjs';
import { 
  handleAdminConfig, 
  handleAdminKeys, 
  handleAdminKeyDetail, 
  handleAdminStatus, 
  handleAdminWorkers, 
  handleAdminBrowser,
  handleAdminLogin, 
  handleAdminLogout,
  getAdminKeys
} from './admin.mjs';

registerKeyStore(getAdminKeys);

// ============================================
// STATE
// ============================================

const workerPool = new Map();
const sessionHistory = new Map();
const sessionLastActive = new Map();
const requestQueue = [];
let isProcessing = false;

// ============================================
// WORKER POOL
// ============================================

async function initWorkerPool() {
  console.log(`[Master] Khởi tạo ${NUM_WORKERS} workers...`);

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
      workerPool.set(i.toString(), worker);
      successCount++;
      console.log(`[Master] Worker ${i + 1}/${NUM_WORKERS} sẵn sàng`);
    } catch (err) {
      console.error(`[Master] Lỗi worker ${i + 1}:`, err.message);
    }
  }
  
  if (successCount === 0) {
    throw new Error('Không thể khởi tạo worker nào.');
  }

  console.log(`[Master] Đã khởi tạo ${successCount}/${NUM_WORKERS} workers`);
}

function findWorker() {
  for (const w of workerPool.values()) {
    if (!w.busy) return w;
  }
  return null;
}

async function processQueue() {
  if (isProcessing || requestQueue.length === 0) return;
  isProcessing = true;

  while (requestQueue.length > 0) {
    const worker = findWorker();
    if (!worker) break;

    const req = requestQueue.shift();
    worker.busy = true;

    if (req.onDelta) req.onDelta('🔄 Đang xử lý...');

    try {
      const result = await worker.sendPromptAndWaitResponse(req.text, req.onDelta, req.imageDataUrl);
      req.resolve({ response: result, workerId: worker.id });
    } catch (err) {
      console.error(`[Worker ${worker.id}] Lỗi:`, err.message);
      await worker.restart();
      req.reject(err);
    } finally {
      worker.busy = false;
      worker.lastActive = Date.now();
    }
  }

  isProcessing = false;
  if (requestQueue.length > 0) setTimeout(() => processQueue(), 1000);
}

function dispatch(payload) {
  return new Promise((resolve, reject) => {
    const worker = findWorker();
    
    if (!worker) {
      if (payload.onDelta) payload.onDelta(null, '⏳ Đang chờ worker rảnh...');
      requestQueue.push({ ...payload, resolve, reject });
      setTimeout(() => processQueue(), 1000);
      return;
    }

    worker.busy = true;
    
    worker.sendPromptAndWaitResponse(payload.text, payload.onDelta, payload.imageDataUrl)
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
  });
}

// ============================================
// SESSION MANAGEMENT
// ============================================

function getSessionHistory(sessionId) {
  if (!sessionHistory.has(sessionId)) {
    sessionHistory.set(sessionId, []);
  }
  sessionLastActive.set(sessionId, Date.now());
  return sessionHistory.get(sessionId);
}

function buildPromptWithHistory(rules, history, userMessage, hasImage = false) {
  console.log(`[buildPrompt] History length: ${history.length}`);
  if (history.length > 0) {
    console.log(`[buildPrompt] Last history item:`, history[history.length - 1]);
  }
  console.log(`[buildPrompt] User message:`, userMessage.slice(0, 50));
  
  let text = '';

  // Với câu hỏi kèm ảnh, tránh nhồi full history/rules vào cùng 1 message
  // để ChatGPT tập trung vào phần vision + câu hỏi user.
  if (hasImage) {
    return userMessage;
  }
  
  // Rules (chỉ lần đầu)
  if (rules && rules.length > 0 && history.length === 0) {
    text += buildPrompt(rules, '');
    text += '\n\n';
  }
  
  // Instruction với example
  if (history.length > 0) {
    text += '⚠️ CUỘC TRÒ CHUYỆN LIÊN TỤC - Đọc lịch sử:\n\n';
    
    // Lịch sử
    for (const msg of history) {
      text += `${msg.role === 'user' ? 'User' : 'Assistant'}: ${msg.content}\n\n`;
    }
    
    text += '---\n';
    text += 'Quy tắc: Trả lời dựa vào lịch sử trên. VD: Nếu user đã nói tên là "A" ở trên, khi hỏi "tôi tên gì", trả lời "A", KHÔNG phải tên khác trong câu hỏi.\n\n';
  }
  
  text += `User: ${userMessage}\n\nAssistant:`;
  
  console.log(`[buildPrompt] Final prompt length: ${text.length}`);
  return text;
}

function buildFocusedPromptWithHistory(rules, history, userMessage, hasImage = false) {
  console.log(`[buildFocusedPrompt] History length: ${history.length}`);
  if (history.length > 0) {
    console.log(`[buildFocusedPrompt] Last history item:`, history[history.length - 1]);
  }
  console.log(`[buildFocusedPrompt] User message:`, userMessage.slice(0, 50));

  if (hasImage) {
    return userMessage;
  }

  let text = '';
  const recentHistory = history.slice(-6);

  if (rules && rules.length > 0) {
    text += buildPrompt(rules, '');
    text += '\n\n';
  }

  text += '=== NGUYEN TAC HOI THOAI ===\n';
  text += 'Chi dung lich su de giu mach trao doi trong pham vi PCCC.\n';
  text += 'Neu lich su hoac cau hoi lech sang chu de ngoai PCCC, tu choi ngan gon va dua hoi thoai quay lai PCCC.\n';
  text += 'Neu nguoi dung noi ve tinh huong chay no, nguy hiem, de doa, uu tien huong dan an toan, so tan va goi 114.\n\n';

  if (recentHistory.length > 0) {
    text += '=== LICH SU GAN DAY ===\n';
    for (const msg of recentHistory) {
      text += `${msg.role === 'user' ? 'User' : 'Assistant'}: ${msg.content}\n\n`;
    }
  }

  text += '=== YEU CAU HIEN TAI ===\n';
  text += `User: ${userMessage}\n\nAssistant:`;

  console.log(`[buildFocusedPrompt] Final prompt length: ${text.length}`);
  return text;
}

function saveToHistory(history, userMessage, assistantResponse) {
  history.push({ role: 'user', content: userMessage });
  history.push({ role: 'assistant', content: assistantResponse });
  
  // Giới hạn 20 messages gần nhất
  if (history.length > 20) {
    history.splice(0, history.length - 20);
  }
}

// Cleanup sessions cũ mỗi 30 phút
setInterval(() => {
  const now = Date.now();
  const timeout = 2 * 60 * 60 * 1000; // 2 hours
  
  for (const [sessionId, lastActive] of sessionLastActive.entries()) {
    if ((now - lastActive) > timeout) {
      console.log(`[Master] Xóa session timeout: ${sessionId.slice(0, 8)}`);
      sessionHistory.delete(sessionId);
      sessionLastActive.delete(sessionId);
    }
  }
}, 30 * 60 * 1000);

// ============================================
// HTTP HANDLERS
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

      const result = await dispatch({ text });
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(result));
    } catch (err) {
      res.writeHead(503, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: err.message }));
    }
  });
}

async function handleChatStream(req, res) {
  let body = '';
  req.on('data', chunk => body += chunk);
  req.on('end', async () => {
    try {
      const { prompt, messages, rules, sessionId, image } = JSON.parse(body);
      
      const history = getSessionHistory(sessionId);
      const userMessage = prompt || (messages && messages[messages.length - 1]?.content);
      
      console.log(`[Session ${sessionId?.slice(0, 8)}] History length: ${history.length}, User: ${userMessage?.slice(0, 50)}${image ? ' [with image]' : ''}`);
      
      if (!userMessage) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ error: 'Thiếu prompt hoặc messages' }));
      }
      
      const text = buildFocusedPromptWithHistory(rules, history, userMessage, Boolean(image));

      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*'
      });

      try {
        const result = await dispatch({
          text,
          imageDataUrl: image,
          onDelta: (delta, status) => {
            if (status) {
              res.write(`data: ${JSON.stringify({ status })}\n\n`);
            } else if (delta) {
              res.write(`data: ${JSON.stringify({ delta })}\n\n`);
            }
          }
        });

        saveToHistory(history, userMessage, result.response);
        console.log(`[Session ${sessionId?.slice(0, 8)}] Saved to history. New length: ${history.length}`);
        
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
      
      if (sessionId) {
        sessionHistory.delete(sessionId);
        sessionLastActive.delete(sessionId);
      } else {
        sessionHistory.clear();
        sessionLastActive.clear();
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
      generating: workerPool.size - available,
      authEnabled: isAuthConfigured(),
      port: PORT
    }));
  }

  // Admin endpoints
  if (pathname === '/admin/login' && req.method === 'POST') return handleAdminLogin(req, res);
  if (pathname === '/admin/logout' && req.method === 'POST') return handleAdminLogout(req, res);
  if (pathname === '/admin/config' && (req.method === 'GET' || req.method === 'PUT')) return handleAdminConfig(req, res);
  if (pathname === '/admin/keys' && (req.method === 'GET' || req.method === 'POST')) return handleAdminKeys(req, res);
  if (pathname.startsWith('/admin/keys/')) return handleAdminKeyDetail(req, res, pathname.split('/')[3]);
  if (pathname === '/admin/status' && req.method === 'GET') return handleAdminStatus(req, res, workerPool);
  if (pathname === '/admin/browser' && (req.method === 'GET' || req.method === 'POST')) return handleAdminBrowser(req, res);
  if (pathname === '/admin/workers' && (req.method === 'GET' || req.method === 'POST' || req.method === 'DELETE')) return handleAdminWorkers(req, res, workerPool);

  // API endpoints (require auth)
  const auth = validateApiKey(req);
  if (!auth.valid) return sendUnauthorized(res, auth.error);

  if (pathname === '/internal/bridge/chat' && req.method === 'POST') return handleChat(req, res);
  if (pathname === '/internal/bridge/chat/stream' && req.method === 'POST') return handleChatStream(req, res);
  if (pathname === '/internal/bridge/reset-temp-chat' && req.method === 'POST') return handleResetChat(req, res);

  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Not found' }));
});

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
