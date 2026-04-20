// Health Monitor - Tự động restart per-worker
// Monitor idle timeout và chat count per worker

const IDLE_TIMEOUT_MS = 5 * 60_000; // 5 phút idle
const CHAT_RESET_THRESHOLD = 20;
const CHECK_INTERVAL_MS = 60_000; // kiểm tra mỗi 1 phút

let monitorInterval = null;

export function startHealthMonitor(workerPool) {
  if (monitorInterval) {
    console.log('[Monitor] Đã chạy rồi');
    return;
  }

  console.log(`[Monitor] Bắt đầu health monitor (idle: ${IDLE_TIMEOUT_MS/1000}s, reset sau ${CHAT_RESET_THRESHOLD} chats)`);
  
  monitorInterval = setInterval(async () => {
    for (const [id, worker] of workerPool) {
      try {
        // Reset sau N lượt chat (per-worker)
        if (worker.chatCount >= CHAT_RESET_THRESHOLD) {
          console.log(`[Monitor] Worker ${id}: reset after ${worker.chatCount} chats`);
          await worker.restart();
          continue;
        }

        // Restart worker bị idle quá lâu
        if (!worker.busy && Date.now() - worker.lastActive > IDLE_TIMEOUT_MS) {
          console.log(`[Monitor] Worker ${id}: idle restart (${Math.round((Date.now() - worker.lastActive)/1000)}s)`);
          await worker.restart();
        }
      } catch (err) {
        console.error(`[Monitor] Worker ${id} error:`, err.message);
      }
    }
  }, CHECK_INTERVAL_MS);
}

export function stopHealthMonitor() {
  if (monitorInterval) {
    clearInterval(monitorInterval);
    monitorInterval = null;
    console.log('[Monitor] Đã dừng');
  }
}

export function getMonitorStatus() {
  return {
    running: monitorInterval !== null,
    idleTimeout: IDLE_TIMEOUT_MS,
    chatThreshold: CHAT_RESET_THRESHOLD,
    checkInterval: CHECK_INTERVAL_MS
  };
}