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
  STREAM_NO_CHANGE_THRESHOLD,
  STREAM_FALLBACK_THRESHOLD,
  STREAM_MAX_TIMEOUT,
  STREAM_START_TIMEOUT,
  STREAM_CHECK_INTERVAL,
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


export async function showBrowserWindow() {
  if (!browser) return;
  try {
    const pages = await browser.pages();
    if (pages.length > 0) {
      const cdp = await pages[0].createCDPSession();
      await cdp.send('Browser.setWindowBounds', {
        windowId: 1,
        bounds: { windowState: 'normal', left: 100, top: 100, width: 1200, height: 800 }
      });
    }
  } catch (e) {
    console.error('[showBrowserWindow] Error:', e.message);
  }
}

export async function hideBrowserWindow() {
  if (!browser) return;
  try {
    const pages = await browser.pages();
    if (pages.length > 0) {
      const cdp = await pages[0].createCDPSession();
      await cdp.send('Browser.setWindowBounds', {
        windowId: 1,
        bounds: { windowState: 'minimized' }
      });
    }
  } catch (e) {
    console.error('[hideBrowserWindow] Error:', e.message);
  }
}

export function isBrowserRunning() {
  return browser !== null;
}
export async function findInput() {
  if (!page) return null;
  try {
    // Thử nhiều selector khác nhau cho ChatGPT
    const selectors = [
      'textarea#prompt-textarea',
      'textarea[placeholder*="Message"]',
      'textarea[placeholder*="Send a message"]',
      'textarea[data-id="root"]',
      'div[contenteditable="true"]#prompt-textarea',
      'div[contenteditable="true"][data-id="root"]',
      'textarea',
      'div[contenteditable="true"]'
    ];

    for (const selector of selectors) {
      const element = await page.$(selector);
      if (element) {
        console.log(`[Worker] Tìm thấy input với selector: ${selector}`);
        return element;
      }
    }

    console.warn('[Worker] Không tìm thấy input với bất kỳ selector nào');
    return null;
  } catch (err) {
    console.error('[Worker] Lỗi khi tìm input:', err.message);
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
    // Thử nhiều cách phát hiện đang generate
    const result = await page.evaluate(() => {
      // Cách 1: Tìm stop button (visible)
      const stopBtn = document.querySelector('[data-testid="stop-generating"], button[aria-label="Stop generating"], button[aria-label*="Stop"]');
      if (stopBtn && stopBtn.offsetParent !== null && window.getComputedStyle(stopBtn).display !== 'none') {
        return true;
      }
      
      // Cách 2: Kiểm tra streaming indicator
      const streamingIndicator = document.querySelector('[data-testid="streaming-indicator"]');
      if (streamingIndicator && streamingIndicator.offsetParent !== null) {
        return true;
      }
      
      // Cách 3: Kiểm tra cursor blinking trong response cuối
      const responses = document.querySelectorAll('[data-message-author-role="assistant"]');
      if (responses.length > 0) {
        const lastResponse = responses[responses.length - 1];
        const cursor = lastResponse.querySelector('.result-streaming, [class*="cursor"], [class*="blink"]');
        if (cursor && cursor.offsetParent !== null) {
          return true;
        }
      }
      
      // Cách 4: Kiểm tra button send bị disable (đang generate)
      const sendBtn = document.querySelector('button[data-testid="send-button"], button[aria-label="Send message"]');
      if (sendBtn && sendBtn.disabled) {
        return true;
      }
      
      // Không tìm thấy dấu hiệu nào → không đang generate
      return false;
    });
    
    return result;
  } catch (err) {
    console.warn('[Worker] Lỗi kiểm tra isGenerating:', err.message);
    // Nếu lỗi, coi như không đang generate (để không bị treo)
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

  const input = await findInput();
  if (!input) {
    throw new Error('Không tìm thấy input textarea hoặc contenteditable');
  }

  // Kiểm tra loại input
  const tagName = await input.evaluate(el => el.tagName.toLowerCase());
  const isContentEditable = await input.evaluate(el => el.contentEditable === 'true');

  console.log(`[Worker] Input type: ${tagName}, contentEditable: ${isContentEditable}`);

  // Clear và type
  await input.click({ clickCount: 3 });
  
  if (isContentEditable) {
    // Với contenteditable div
    await input.evaluate((el, text) => {
      el.textContent = text;
      // Trigger input event
      el.dispatchEvent(new Event('input', { bubbles: true }));
    }, prompt);
  } else {
    // Với textarea
    await page.keyboard.type(prompt, { delay: 30 });
  }

  // Đợi một chút để UI update
  await new Promise(r => setTimeout(r, 500));

  // Gửi - thử nhiều cách
  try {
    // Cách 1: Enter key
    await page.keyboard.press('Enter');
  } catch (err) {
    console.warn('[Worker] Không thể gửi bằng Enter, thử click button');
    // Cách 2: Click send button
    const sendBtn = await page.$('button[data-testid="send-button"], button[aria-label="Send message"]');
    if (sendBtn) {
      await sendBtn.click();
    } else {
      throw new Error('Không thể gửi message');
    }
  }

  // Đợi response bắt đầu (tối đa từ config)
  const startWaitTime = Date.now();
  let responseStarted = false;
  
  while (Date.now() - startWaitTime < STREAM_START_TIMEOUT) {
    const hasResponse = await page.evaluate(() => {
      const responses = document.querySelectorAll('[data-message-author-role="assistant"]');
      return responses.length > 0 && responses[responses.length - 1].innerText.trim().length > 0;
    });
    
    if (hasResponse) {
      responseStarted = true;
      break;
    }
    
    await new Promise(r => setTimeout(r, STREAM_CHECK_INTERVAL));
  }

  if (!responseStarted) {
    throw new Error(`Timeout: ChatGPT không phản hồi sau ${STREAM_START_TIMEOUT}ms`);
  }

  // Stream response với no-change detection
  const streamStartTime = Date.now();
  let lastText = '';
  let noChangeCount = 0;

  while (Date.now() - streamStartTime < STREAM_MAX_TIMEOUT) {
    const currentText = await readLatestAssistant();
    const generating = await isGenerating();

    // Kiểm tra text có thay đổi không
    if (currentText && currentText !== lastText) {
      // Text thay đổi - reset counter và gửi delta
      noChangeCount = 0;
      const delta = currentText.slice(lastText.length);
      if (delta && onDelta) {
        onDelta(delta);
      }
      lastText = currentText;
    } else if (currentText) {
      // Text không đổi - tăng counter
      noChangeCount++;
    }

    // Debug log mỗi 5 lần check
    if (noChangeCount % 5 === 0 && noChangeCount > 0) {
      console.log(`[Worker] Đang đợi: generating=${generating}, noChangeCount=${noChangeCount}, textLength=${lastText?.length || 0}`);
    }

    // Điều kiện dừng:
    // 1. Không đang generate VÀ text ổn định (theo config) VÀ có text
    // 2. HOẶC text ổn định quá lâu (fallback threshold) dù generating=true
    if ((!generating && noChangeCount >= STREAM_NO_CHANGE_THRESHOLD && lastText) || 
        (noChangeCount >= STREAM_FALLBACK_THRESHOLD && lastText)) {
      if (noChangeCount >= STREAM_FALLBACK_THRESHOLD) {
        const fallbackSeconds = (STREAM_FALLBACK_THRESHOLD * STREAM_CHECK_INTERVAL / 1000).toFixed(1);
        console.log(`[Worker] Stream hoàn tất: text ổn định quá lâu (${fallbackSeconds}s), bỏ qua generating flag`);
      } else {
        console.log('[Worker] Stream hoàn tất: không còn generate và text ổn định');
      }
      break;
    }

    await new Promise(r => setTimeout(r, STREAM_CHECK_INTERVAL));
  }

  return lastText || await readLatestAssistant();
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

