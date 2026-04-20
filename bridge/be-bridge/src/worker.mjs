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
// WorkerInstance Class - Mỗi worker có browser riêng
// ============================================

export class WorkerInstance {
  constructor(id) {
    this.id = id;
    this.browser = null;
    this.page = null;
    this.busy = false;
    this.chatCount = 0;
    this.lastActive = Date.now();
  }

  async launch() {
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
      `--user-data-dir=${PROFILE_DIR}-${this.id}`,
    ];

    if (LAUNCH_OFFSCREEN) {
      args.push(`--window-position=${HIDDEN_X},${HIDDEN_Y}`);
    }

    this.browser = await puppeteerExtra.launch({
      headless: false,
      executablePath,
      args,
      defaultViewport: null,
      ignoreDefaultArgs: ['--enable-automation'],
    });

    const pages = await this.browser.pages();
    this.page = pages[0] || await this.browser.newPage();

    await this.page.goto(CHAT_URL, { waitUntil: 'networkidle2', timeout: 60000 });

    const currentUrl = this.page.url();
    if (currentUrl.includes('/auth/login') || currentUrl.includes('/login')) {
      console.error(`[Worker ${this.id}] ChatGPT chua dang nhap! URL:`, currentUrl);
      throw new Error('ChatGPT yeu cau dang nhap. Tat BRIDGE_HIDE_WINDOW=false, restart, dang nhap, bat lai.');
    }
    console.log(`[Worker ${this.id}] ChatGPT san sang:`, currentUrl);

    if (HIDE_WINDOW) {
      await this.forceHideBrowserWindow();
    }

    this.lastActive = Date.now();
    return this;
  }

  async forceHideBrowserWindow() {
    if (!this.browser) return;
    try {
      const browserWindow = await this.browser.waitForTarget(t => t.type() === 'page');
      const cdp = await browserWindow.createCDPSession();
      await cdp.send('Browser.setWindowBounds', {
        windowId: 1,
        bounds: { windowState: LAUNCH_MINIMIZED ? 'minimized' : 'normal' }
      });
    } catch (e) {
      // Ignore if not supported
    }
  }

  async destroy() {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
      this.page = null;
    }
  }

  async restart() {
    console.log(`[Worker ${this.id}] Restarting...`);
    await this.destroy();
    await this.launch();
    this.chatCount = 0;
    console.log(`[Worker ${this.id}] Restarted`);
  }

  async findInput() {
    if (!this.page) return null;
    try {
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
        const element = await this.page.$(selector);
        if (element) {
          return element;
        }
      }
      return null;
    } catch (err) {
      console.error(`[Worker ${this.id}] Lỗi tìm input:`, err.message);
      return null;
    }
  }

  async isGenerating() {
    if (!this.page) return false;
    try {
      return await this.page.evaluate(() => {
        const stopBtn = document.querySelector('[data-testid="stop-generating"], button[aria-label="Stop generating"], button[aria-label*="Stop"]');
        if (stopBtn && stopBtn.offsetParent !== null && window.getComputedStyle(stopBtn).display !== 'none') {
          return true;
        }
        const streamingIndicator = document.querySelector('[data-testid="streaming-indicator"]');
        if (streamingIndicator && streamingIndicator.offsetParent !== null) {
          return true;
        }
        const responses = document.querySelectorAll('[data-message-author-role="assistant"]');
        if (responses.length > 0) {
          const lastResponse = responses[responses.length - 1];
          const cursor = lastResponse.querySelector('.result-streaming, [class*="cursor"], [class*="blink"]');
          if (cursor && cursor.offsetParent !== null) {
            return true;
          }
        }
        const sendBtn = document.querySelector('button[data-testid="send-button"], button[aria-label="Send message"]');
        if (sendBtn && sendBtn.disabled) {
          return true;
        }
        return false;
      });
    } catch {
      return false;
    }
  }

  async readLatestAssistant() {
    if (!this.page) return null;
    try {
      return await this.page.evaluate(() => {
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

  async sendPromptAndWaitResponse(prompt, onDelta = null) {
    if (!this.page) {
      throw new Error('Browser chưa được khởi tạo');
    }

    const input = await this.findInput();
    if (!input) {
      throw new Error('Không tìm thấy input textarea hoặc contenteditable');
    }

    const tagName = await input.evaluate(el => el.tagName.toLowerCase());
    const isContentEditable = await input.evaluate(el => el.contentEditable === 'true');

    console.log(`[Worker ${this.id}] Input: ${tagName}, prompt: ${prompt.slice(0, 50)}...`);

    await input.click({ clickCount: 3 });
    
    if (isContentEditable) {
      await input.evaluate((el, text) => {
        el.textContent = text;
        el.dispatchEvent(new Event('input', { bubbles: true }));
      }, prompt);
    } else {
      await this.page.keyboard.type(prompt, { delay: 30 });
    }

    await new Promise(r => setTimeout(r, 500));

    try {
      await this.page.keyboard.press('Enter');
    } catch (err) {
      const sendBtn = await this.page.$('button[data-testid="send-button"], button[aria-label="Send message"]');
      if (sendBtn) {
        await sendBtn.click();
      } else {
        throw new Error('Không thể gửi message');
      }
    }

    const startWaitTime = Date.now();
    let responseStarted = false;
    
    while (Date.now() - startWaitTime < STREAM_START_TIMEOUT) {
      const hasResponse = await this.page.evaluate(() => {
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

    const streamStartTime = Date.now();
    let lastText = '';
    let noChangeCount = 0;

    while (Date.now() - streamStartTime < STREAM_MAX_TIMEOUT) {
      const currentText = await this.readLatestAssistant();
      const generating = await this.isGenerating();

      if (currentText && currentText !== lastText) {
        noChangeCount = 0;
        const delta = currentText.slice(lastText.length);
        if (delta && onDelta) {
          onDelta(delta);
        }
        lastText = currentText;
      } else if (currentText) {
        noChangeCount++;
      }

      if ((!generating && noChangeCount >= STREAM_NO_CHANGE_THRESHOLD && lastText) || 
          (noChangeCount >= STREAM_FALLBACK_THRESHOLD && lastText)) {
        break;
      }

      await new Promise(r => setTimeout(r, STREAM_CHECK_INTERVAL));
    }

    this.chatCount++;
    this.lastActive = Date.now();
    return lastText || await this.readLatestAssistant();
  }

  async startNewTemporaryChat() {
    if (!this.page) return;
    try {
      await this.page.goto(CHAT_URL, { waitUntil: 'networkidle2', timeout: 30000 });
    } catch (e) {
      console.error(`[Worker ${this.id}] Lỗi reset chat:`, e.message);
    }
  }
}

// ============================================
// Legacy exports cho backward compatibility
// ============================================

let browser = null;
let page = null;

export async function launchBrowser() {
  const w = new WorkerInstance('default');
  await w.launch();
  browser = w.browser;
  page = w.page;
  return { browser, page };
}

export async function closeBrowser() {
  if (browser) {
    await browser.close();
    browser = null;
    page = null;
  }
}

export async function showBrowserWindow() {
  if (!browser) throw new Error('Browser chua khoi dong');
  const pages = await browser.pages();
  if (!pages.length) throw new Error('Khong co trang nao dang mo');
  const cdp = await pages[0].createCDPSession();
  const { windowId } = await cdp.send('Browser.getWindowForTarget');
  await cdp.send('Browser.setWindowBounds', { windowId, bounds: { windowState: 'normal', left: 100, top: 100, width: 1200, height: 800 } });
  await cdp.detach();
}

export async function hideBrowserWindow() {
  if (!browser) throw new Error('Browser chua khoi dong');
  const pages = await browser.pages();
  if (!pages.length) throw new Error('Khong co trang nao dang mo');
  const cdp = await pages[0].createCDPSession();
  const { windowId } = await cdp.send('Browser.getWindowForTarget');
  await cdp.send('Browser.setWindowBounds', { windowId, bounds: { windowState: 'minimized' } });
  await cdp.detach();
}

export function isBrowserRunning() {
  return browser !== null;
}

export async function sendPromptAndWaitResponse(prompt, onDelta = null) {
  if (!page) {
    throw new Error('Browser chưa được khởi tạo');
  }

  const input = await page.$('textarea#prompt-textarea, textarea[placeholder*="Message"], div[contenteditable="true"]');
  if (!input) {
    throw new Error('Không tìm thấy input textarea hoặc contenteditable');
  }

  await input.click({ clickCount: 3 });
  await page.keyboard.type(prompt, { delay: 30 });
  await new Promise(r => setTimeout(r, 500));
  await page.keyboard.press('Enter');

  await new Promise(r => setTimeout(r, 3000));
  return await page.evaluate(() => {
    const responses = document.querySelectorAll('[data-message-author-role="assistant"]');
    return responses.length > 0 ? responses[responses.length - 1].innerText : null;
  });
}

export async function startNewTemporaryChat() {
  if (!page) return;
  try {
    await page.goto(CHAT_URL, { waitUntil: 'networkidle2', timeout: 30000 });
  } catch (e) {
    console.error('[Worker] Lỗi reset chat:', e.message);
  }
}

export function getPage() { return page; }
export function getBrowser() { return browser; }

// Exports cho admin.mjs
export async function isGenerating() {
  if (!page) return false;
  try {
    return await page.evaluate(() => {
      const stopBtn = document.querySelector('[data-testid="stop-generating"], button[aria-label="Stop generating"]');
      return stopBtn && stopBtn.offsetParent !== null;
    });
  } catch { return false; }
}