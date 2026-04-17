import puppeteer from 'puppeteer';
import puppeteerExtra from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import {
  PREFERRED_BROWSER,
  CHAT_URL,
  HIDE_WINDOW,
  LAUNCH_MINIMIZED,
  LAUNCH_OFFSCREEN,
  HIDDEN_X,
  HIDDEN_Y,
  PROFILE_DIR,
  getExecutable
} from './config.mjs';

puppeteerExtra.use(StealthPlugin());

// ============================================
// PHẦN 3a: CORE FUNCTIONS
// ============================================

let browser = null;
let page = null;

export async function launchBrowser() {
  const executablePath = getExecutable();
  if (!executablePath) {
    throw new Error('Không tìm thấy Chrome/Edge executable');
  }

  const args = [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-dev-shm-usage',
    '--disable-accelerated-2d-canvas',
    '--no-first-run',
    '--no-zygote',
    '--disable-gpu',
    `--user-data-dir=${PROFILE_DIR}`,
  ];

  if (LAUNCH_OFFSCREEN) {
    args.push(`--window-position=${HIDDEN_X},${HIDDEN_Y}`);
  }

  browser = await puppeteerExtra.launch({
    headless: false,
    executablePath,
    args,
    defaultViewport: null,
    ignoreDefaultArgs: ['--enable-automation'],
  });

  const pages = await browser.pages();
  page = pages[0] || await browser.newPage();

  await page.goto(CHAT_URL, { waitUntil: 'networkidle2', timeout: 60000 });

  if (HIDE_WINDOW) {
    await forceHideBrowserWindow();
  }

  return { browser, page };
}

export async function forceHideBrowserWindow() {
  if (!browser) return;
  try {
    const browserWindow = await browser.waitForTarget(t => t.type() === 'page');
    const cdp = await browserWindow.createCDPSession();
    await cdp.send('Browser.setWindowBounds', {
      windowId: 1,
      bounds: { windowState: LAUNCH_MINIMIZED ? 'minimized' : 'normal' }
    });
  } catch (e) {
    // Ignore if not supported
  }
}

export async function closeBrowser() {
  if (browser) {
    await browser.close();
    browser = null;
    page = null;
  }
}

export async function findInput() {
  if (!page) return null;
  try {
    const textarea = await page.$('textarea#prompt-textarea, textarea[placeholder*="Message"]');
    return textarea;
  } catch {
    return null;
  }
}

export async function waitForGenerationDone(timeout = 120000) {
  if (!page) return false;
  try {
    // Đợi nút stop biến mất (đang generate)
    await page.waitForFunction(() => {
      const stopBtn = document.querySelector('[data-testid="stop-generating"], button[aria-label="Stop generating"]');
      return !stopBtn || stopBtn.style.display === 'none';
    }, { timeout });
    return true;
  } catch {
    return false;
  }
}

export async function stopActiveGeneration() {
  if (!page) return;
  try {
    const stopBtn = await page.$('[data-testid="stop-generating"], button[aria-label="Stop generating"]');
    if (stopBtn) {
      await stopBtn.click();
    }
  } catch {
    // Ignore
  }
}

export async function readLatestAssistant() {
  if (!page) return null;
  try {
    return await page.evaluate(() => {
      const responses = document.querySelectorAll('[data-message-author-role="assistant"]');
      if (responses.length > 0) {
        return responses[responses.length - 1].innerText;
      }
      return null;
    });
  } catch {
    return null;
  }
}

export async function isGenerating() {
  if (!page) return false;
  try {
    const stopBtn = await page.$('[data-testid="stop-generating"], button[aria-label="Stop generating"]');
    return !!stopBtn;
  } catch {
    return false;
  }
}

// ============================================
// PHẦN 3b: IPC HANDLER + SEND PROMPT
// ============================================

export async function sendPromptAndWaitResponse(prompt, onDelta = null) {
  if (!page) {
    throw new Error('Browser chưa được khởi tạo');
  }

  const textarea = await findInput();
  if (!textarea) {
    throw new Error('Không tìm thấy input textarea');
  }

  // Clear và type
  await textarea.click({ clickCount: 3 });
  await page.keyboard.type(prompt, { delay: 30 });

  // Gửi
  await page.keyboard.press('Enter');

  // Đợi response
  const startTime = Date.now();
  let lastText = '';

  while (Date.now() - startTime < 120000) {
    const generating = await isGenerating();

    if (onDelta) {
      const currentText = await readLatestAssistant();
      if (currentText && currentText !== lastText) {
        const delta = currentText.slice(lastText.length);
        onDelta(delta);
        lastText = currentText;
      }
    }

    if (!generating) {
      break;
    }

    await new Promise(r => setTimeout(r, 200));
  }

  return await readLatestAssistant();
}

export function buildPromptFromMessages(messages) {
  if (!Array.isArray(messages) || messages.length === 0) {
    return '';
  }

  return messages
    .filter(m => m.role === 'user')
    .map(m => m.content)
    .join('\n\n');
}

export function computeDeltaText(prevText, newText) {
  if (!prevText) return newText || '';
  if (!newText) return '';
  return newText.slice(prevText.length);
}

export function normalizeMessageContent(content) {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content.map(c => typeof c === 'string' ? c : c.text || '').join('');
  }
  return '';
}

export async function startNewTemporaryChat() {
  if (!page) return;
  try {
    await page.goto(CHAT_URL, { waitUntil: 'networkidle2', timeout: 30000 });
  } catch (e) {
    console.error('[Worker] Lỗi reset chat:', e.message);
  }
}

// ============================================
// PHẦN 3c: EXPORTS & INIT
// ============================================

export function getPage() { return page; }
export function getBrowser() { return browser; }

// Test runner
if (import.meta.url === `file://${process.argv[1].replace(/\\/g, '/')}`) {
  (async () => {
    console.log('[Worker] Test khởi động browser...');
    try {
      await launchBrowser();
      console.log('[Worker] Browser đã khởi động thành công');

      // Test gửi message
      const response = await sendPromptAndWaitResponse('Xin chào, bạn là ai?');
      console.log('[Worker] Response:', response?.slice(0, 200));

      await closeBrowser();
      console.log('[Worker] Test hoàn tất');
    } catch (err) {
      console.error('[Worker] Lỗi:', err);
      process.exit(1);
    }
  })();
}
