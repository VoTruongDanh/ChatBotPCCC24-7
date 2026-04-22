import puppeteerExtra from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import {
  CHAT_URL,
  HIDE_WINDOW,
  LAUNCH_MINIMIZED,
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

const IMAGE_MIME_EXT = {
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/bmp': 'bmp'
};

const IMAGE_UPLOAD_MAX_WAIT = 30000;
const IMAGE_UPLOAD_RETRY = 3;
const activeWorkers = new Map();

function parseImageDataUrl(dataUrl) {
  if (!dataUrl || typeof dataUrl !== 'string') return null;

  const match = dataUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/s);
  if (!match) {
    throw new Error('Anh khong dung dinh dang data URL base64');
  }

  const [, mimeType, base64Body] = match;
  const ext = IMAGE_MIME_EXT[mimeType.toLowerCase()] || 'png';
  const buffer = Buffer.from(base64Body, 'base64');
  if (!buffer.length) {
    throw new Error('Anh base64 rong');
  }

  return { ext, buffer };
}

function normalizeUploadError(message) {
  const text = String(message || '');
  const lower = text.toLowerCase();
  if (lower.includes('files.oaiusercontent.com') || lower.includes('failed upload to')) {
    return 'Upload anh that bai vi mang khong truy cap on dinh toi files.oaiusercontent.com. Hay mo domain nay tren firewall/proxy/DNS va thu lai.';
  }
  return text || 'Upload anh that bai';
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export class WorkerInstance {
  constructor(id) {
    this.id = id.toString();
    this.browser = null;
    this.page = null;
    this.busy = false;
    this.chatCount = 0;
    this.lastActive = Date.now();
    this.lastUploadNetworkError = null;
    this.currentUploadStartedAt = 0;
  }

  async launch() {
    const executablePath = getExecutable();
    if (!executablePath) {
      throw new Error('Khong tim thay Chrome/Edge executable');
    }

    this.browser = await puppeteerExtra.launch({
      headless: false,
      executablePath,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--disable-gpu',
        `--user-data-dir=${PROFILE_DIR}-${this.id}`,
        `--window-position=${HIDDEN_X},${HIDDEN_Y}`
      ],
      defaultViewport: null,
      ignoreDefaultArgs: ['--enable-automation']
    });

    const pages = await this.browser.pages();
    this.page = pages[0] || await this.browser.newPage();
    this.attachUploadNetworkWatchers();

    await this.page.goto(CHAT_URL, { waitUntil: 'networkidle2', timeout: 60000 });
    const currentUrl = this.page.url();
    if (currentUrl.includes('/auth/login') || currentUrl.includes('/login')) {
      throw new Error('ChatGPT yeu cau dang nhap. Tat BRIDGE_HIDE_WINDOW=false, restart, dang nhap, bat lai.');
    }

    await this.ensurePageInteractive();
    console.log(`[Worker ${this.id}] ChatGPT san sang:`, currentUrl);
    if (HIDE_WINDOW) {
      await this.forceHideBrowserWindow();
    }
    activeWorkers.set(this.id, this);
    this.lastActive = Date.now();
    return this;
  }

  attachUploadNetworkWatchers() {
    if (!this.page) return;

    const mark = (message) => {
      this.lastUploadNetworkError = {
        at: Date.now(),
        message: normalizeUploadError(message)
      };
    };

    this.page.on('requestfailed', (request) => {
      const url = request.url?.() || '';
      if (!url.includes('files.oaiusercontent.com')) return;
      const failure = request.failure?.();
      mark(failure?.errorText || 'Failed upload to files.oaiusercontent.com');
    });

    this.page.on('response', (response) => {
      const url = response.url?.() || '';
      if (!url.includes('files.oaiusercontent.com')) return;
      if (response.status() >= 400) {
        mark(`Failed upload to files.oaiusercontent.com (${response.status()})`);
      }
    });
  }

  async ensurePageInteractive() {
    if (!this.page) return;

    try {
      await this.page.bringToFront();
    } catch {
      // ignore
    }

    try {
      await this.page.evaluate(() => {
        window.focus?.();
        const input =
          document.querySelector('#prompt-textarea') ||
          document.querySelector('textarea#prompt-textarea') ||
          document.querySelector('textarea[placeholder*="Message"]') ||
          document.querySelector('textarea[placeholder*="Send a message"]') ||
          document.querySelector('div[contenteditable="true"]#prompt-textarea') ||
          document.querySelector('div[contenteditable="true"]');

        if (input instanceof HTMLElement) {
          input.focus();
        }
      });
    } catch {
      // ignore
    }

    await delay(180);
  }

  async forceHideBrowserWindow() {
    if (!this.browser) return;
    try {
      const pages = await this.browser.pages();
      if (!pages.length) return;
      const cdp = await pages[0].createCDPSession();
      const { windowId } = await cdp.send('Browser.getWindowForTarget');
      await cdp.send('Browser.setWindowBounds', {
        windowId,
        bounds: {
          windowState: 'normal',
          left: HIDDEN_X,
          top: HIDDEN_Y,
          width: 1280,
          height: 900
        }
      });
      await cdp.detach();
    } catch {
      // ignore
    }
  }

  async destroy() {
    activeWorkers.delete(this.id);
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

  resetUploadAttemptState() {
    this.currentUploadStartedAt = Date.now();
    this.lastUploadNetworkError = null;
  }

  getUploadNetworkError() {
    if (!this.lastUploadNetworkError) return null;
    if (this.lastUploadNetworkError.at < this.currentUploadStartedAt) return null;
    return this.lastUploadNetworkError.message;
  }

  async findInput() {
    if (!this.page) return null;
    const selectors = [
      'textarea#prompt-textarea',
      'textarea[placeholder*="Message"]',
      'textarea[placeholder*="Send a message"]',
      'div[contenteditable="true"]#prompt-textarea',
      'textarea',
      'div[contenteditable="true"]'
    ];
    for (const selector of selectors) {
      const element = await this.page.$(selector);
      if (element) return element;
    }
    return null;
  }

  async findImageFileInput() {
    if (!this.page) return null;
    for (const selector of [
      'input[type="file"][accept*="image"]',
      'input[type="file"][accept*="image/*"]',
      'input[type="file"]'
    ]) {
      const input = await this.page.$(selector);
      if (input) return input;
    }
    return null;
  }

  async getUploadErrorFromPage() {
    if (!this.page) return null;
    const networkError = this.getUploadNetworkError();
    if (networkError) return networkError;

    try {
      return await this.page.evaluate(() => {
        const text = (document.body?.innerText || '').toLowerCase();
        if (text.includes('failed upload to files.oaiusercontent.com')) {
          return 'Failed upload to files.oaiusercontent.com';
        }

        const alerts = document.querySelectorAll('[role="alert"], [aria-live="assertive"], [data-testid*="toast"]');
        for (const node of alerts) {
          const value = (node.textContent || '').toLowerCase();
          if (value.includes('failed upload to files.oaiusercontent.com')) return 'Failed upload to files.oaiusercontent.com';
          if (value.includes('failed upload')) return 'Failed upload';
          if (value.includes('upload failed')) return 'Upload failed';
        }
        return null;
      });
    } catch {
      return null;
    }
  }

  async clearFailedAttachments() {
    if (!this.page) return;
    try {
      await this.page.evaluate(() => {
        const selectors = [
          'button[aria-label*="Remove"]',
          'button[data-testid*="remove"]',
          'button[data-testid*="delete"]'
        ];
        for (const selector of selectors) {
          document.querySelectorAll(selector).forEach((btn) => btn.click());
        }
      });
    } catch {
      // ignore
    }
  }

  async getComposerState() {
    if (!this.page) {
      return { attachmentCount: 0, uploading: false, sendEnabled: false };
    }

    try {
      return await this.page.evaluate(() => {
        const input =
          document.querySelector('#prompt-textarea') ||
          document.querySelector('textarea#prompt-textarea') ||
          document.querySelector('textarea[placeholder*="Message"]') ||
          document.querySelector('textarea[placeholder*="Send a message"]') ||
          document.querySelector('div[contenteditable="true"]#prompt-textarea') ||
          document.querySelector('div[contenteditable="true"]');

        const composer =
          input?.closest('form') ||
          input?.closest('[data-testid*="composer"]') ||
          document;

        const attachmentSelectors = [
          '[data-testid*="composer-attachment"]',
          '[data-testid*="attachment"]',
          '[data-testid*="upload-preview"]',
          '[data-testid*="file-chip"]',
          'button[aria-label*="Remove file"]',
          'button[aria-label*="Remove image"]',
          'button[aria-label*="Remove attachment"]',
          'img[src^="blob:"]'
        ];

        const seen = new Set();
        for (const selector of attachmentSelectors) {
          composer.querySelectorAll(selector).forEach((node) => seen.add(node));
        }

        const sendBtn =
          composer.querySelector('button[data-testid="send-button"]') ||
          composer.querySelector('button[aria-label="Send message"]') ||
          composer.querySelector('button[aria-label*="Send"]') ||
          composer.querySelector('button[type="submit"]');

        return {
          attachmentCount: seen.size,
          uploading: !!composer.querySelector('[data-testid*="uploading"], [aria-label*="Uploading"], progress'),
          sendEnabled: !!sendBtn && !sendBtn.disabled && sendBtn.getAttribute('aria-disabled') !== 'true' && sendBtn.offsetParent !== null
        };
      });
    } catch {
      return { attachmentCount: 0, uploading: false, sendEnabled: false };
    }
  }

  async waitForUploadResult(beforeAttachmentCount = 0, timeoutMs = IMAGE_UPLOAD_MAX_WAIT) {
    const startedAt = Date.now();
    while (Date.now() - startedAt < timeoutMs) {
      const uploadError = await this.getUploadErrorFromPage();
      if (uploadError) throw new Error(uploadError);

      const composer = await this.getComposerState();
      if (composer.attachmentCount > beforeAttachmentCount && !composer.uploading) {
        return composer;
      }
      await delay(400);
    }
    throw new Error(`Timeout waiting for image upload after ${timeoutMs}ms`);
  }

  async uploadImageFromDataUrl(dataUrl) {
    if (!this.page || !dataUrl) return;
    const parsed = parseImageDataUrl(dataUrl);
    if (!parsed) return;

    const tmpFile = path.join(os.tmpdir(), `pccc-upload-${Date.now()}-${crypto.randomUUID()}.${parsed.ext}`);
    try {
      await fs.writeFile(tmpFile, parsed.buffer);

      let fileInput = await this.findImageFileInput();
      if (!fileInput) {
        const chooserPromise = this.page.waitForFileChooser({ timeout: 3000 }).catch(() => null);
        await this.page.evaluate(() => {
          const btn =
            document.querySelector('button[aria-label*="Attach"]') ||
            document.querySelector('button[aria-label*="Upload"]') ||
            document.querySelector('button[data-testid*="attach"]') ||
            document.querySelector('button[data-testid*="upload"]');
          btn?.click();
        }).catch(() => {});
        const chooser = await chooserPromise;
        if (chooser) {
          await chooser.accept([tmpFile]);
          await delay(1200);
          return;
        }
        fileInput = await this.findImageFileInput();
      }

      if (!fileInput) {
        throw new Error('Khong tim thay input upload anh tren ChatGPT');
      }

      await fileInput.uploadFile(tmpFile);
      await delay(1200);
    } finally {
      await fs.unlink(tmpFile).catch(() => {});
    }
  }

  async uploadImageWithRetry(dataUrl) {
    if (!dataUrl) return;

    for (let attempt = 1; attempt <= IMAGE_UPLOAD_RETRY; attempt++) {
      try {
        this.resetUploadAttemptState();
        const beforeAttachmentCount = (await this.getComposerState()).attachmentCount;
        await this.uploadImageFromDataUrl(dataUrl);
        const composer = await this.waitForUploadResult(beforeAttachmentCount);
        const uploadError = await this.getUploadErrorFromPage();
        if (uploadError) throw new Error(uploadError);
        if (composer.attachmentCount <= beforeAttachmentCount) {
          throw new Error('Upload failed: image was not attached to composer');
        }
        return composer;
      } catch (err) {
        const msg = normalizeUploadError(err?.message || err);
        console.error(`[Worker ${this.id}] Upload attempt ${attempt}/${IMAGE_UPLOAD_RETRY} failed: ${msg}`);
        await this.clearFailedAttachments();
        if (attempt >= IMAGE_UPLOAD_RETRY) {
          throw new Error(msg);
        }
        await delay(1200);
      }
    }
  }

  async isGenerating() {
    if (!this.page) return false;
    try {
      return await this.page.evaluate(() => {
        const stopBtn = document.querySelector('[data-testid="stop-generating"], button[aria-label="Stop generating"], button[aria-label*="Stop"]');
        if (stopBtn && stopBtn.offsetParent !== null && window.getComputedStyle(stopBtn).display !== 'none') return true;
        const streamingIndicator = document.querySelector('[data-testid="streaming-indicator"]');
        if (streamingIndicator && streamingIndicator.offsetParent !== null) return true;
        const sendBtn = document.querySelector('button[data-testid="send-button"], button[aria-label="Send message"]');
        return !!(sendBtn && sendBtn.disabled);
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
        return responses.length ? responses[responses.length - 1].innerText : null;
      });
    } catch {
      return null;
    }
  }

  async getAssistantCount() {
    if (!this.page) return 0;
    try {
      return await this.page.evaluate(() => document.querySelectorAll('[data-message-author-role="assistant"]').length);
    } catch {
      return 0;
    }
  }

  async clickSendButtonIfAvailable() {
    if (!this.page) return false;
    try {
      return await this.page.evaluate(() => {
        const input =
          document.querySelector('#prompt-textarea') ||
          document.querySelector('textarea#prompt-textarea') ||
          document.querySelector('textarea[placeholder*="Message"]') ||
          document.querySelector('textarea[placeholder*="Send a message"]') ||
          document.querySelector('div[contenteditable="true"]#prompt-textarea') ||
          document.querySelector('div[contenteditable="true"]');

        const composer =
          input?.closest('form') ||
          input?.closest('[data-testid*="composer"]') ||
          document;

        const btn =
          composer.querySelector('button[data-testid="send-button"]') ||
          composer.querySelector('button[aria-label="Send message"]') ||
          composer.querySelector('button[aria-label*="Send"]') ||
          composer.querySelector('button[type="submit"]');

        if (composer instanceof HTMLFormElement && btn && !btn.disabled && btn.getAttribute('aria-disabled') !== 'true') {
          if (typeof composer.requestSubmit === 'function') {
            composer.requestSubmit(btn);
            return true;
          }
          composer.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
          return true;
        }

        if (!btn) return false;
        if (btn.disabled || btn.getAttribute('aria-disabled') === 'true' || btn.offsetParent === null) return false;
        btn.click();
        return true;
      });
    } catch {
      return false;
    }
  }

  async clickSendButtonByMouse() {
    if (!this.page) return false;
    for (const selector of [
      'button[data-testid="send-button"]',
      'button[aria-label="Send message"]',
      'button[aria-label*="Send"]',
      'button[type="submit"]'
    ]) {
      try {
        const button = await this.page.$(selector);
        if (!button) continue;
        const box = await button.boundingBox();
        if (!box) continue;
        await this.page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
        return true;
      } catch {
        // try next
      }
    }
    return false;
  }

  async waitForDispatchStart(beforeAssistantCount, timeoutMs = 8000) {
    const startedAt = Date.now();
    while (Date.now() - startedAt < timeoutMs) {
      if (await this.isGenerating()) return true;
      if (await this.getAssistantCount() > beforeAssistantCount) return true;
      await delay(300);
    }
    return false;
  }

  async sendPromptAndWaitResponse(prompt, onDelta = null, imageDataUrl = null) {
    if (!this.page) {
      throw new Error('Browser chua duoc khoi tao');
    }

    await this.ensurePageInteractive();
    if (HIDE_WINDOW) {
      await this.forceHideBrowserWindow();
    }

    const input = await this.findInput();
    if (!input) {
      throw new Error('Khong tim thay input textarea hoac contenteditable');
    }

    const tagName = await input.evaluate((el) => el.tagName.toLowerCase());
    const isContentEditable = await input.evaluate((el) => el.contentEditable === 'true');
    console.log(`[Worker ${this.id}] Input: ${tagName}, prompt: ${prompt.slice(0, 50)}...${imageDataUrl ? ' [with image]' : ''}`);

    if (imageDataUrl) {
      await this.uploadImageWithRetry(imageDataUrl);
      const uploadError = await this.getUploadErrorFromPage();
      const composer = await this.getComposerState();
      if (uploadError || composer.attachmentCount < 1) {
        throw new Error(uploadError || 'Upload failed: image was not attached to composer');
      }
    }

    await input.click({ clickCount: 3 });
    if (isContentEditable) {
      await input.evaluate((el, text) => {
        el.textContent = text;
        el.dispatchEvent(new Event('input', { bubbles: true }));
      }, prompt);
    } else {
      await this.page.keyboard.type(prompt, { delay: 30 });
    }

    await delay(500);

    const beforeAssistantCount = await this.getAssistantCount();
    const beforeAssistantText = (await this.readLatestAssistant()) || '';

    let dispatched = await this.clickSendButtonIfAvailable();
    if (!dispatched) dispatched = await this.clickSendButtonByMouse();
    if (!dispatched) {
      await this.page.keyboard.press('Enter');
      dispatched = true;
    }

    let dispatchStarted = await this.waitForDispatchStart(beforeAssistantCount, 4000);
    if (!dispatchStarted) {
      const retried = await this.clickSendButtonIfAvailable() || await this.clickSendButtonByMouse();
      if (retried) {
        dispatchStarted = await this.waitForDispatchStart(beforeAssistantCount, 4000);
      }
    }

    const startWaitTime = Date.now();
    let responseStarted = false;
    let retriedDispatch = dispatchStarted;

    while (Date.now() - startWaitTime < STREAM_START_TIMEOUT) {
      const assistantCount = await this.getAssistantCount();
      const latestAssistant = (await this.readLatestAssistant()) || '';
      const generating = await this.isGenerating();
      const hasResponse =
        generating ||
        assistantCount > beforeAssistantCount ||
        (assistantCount === beforeAssistantCount && latestAssistant && latestAssistant !== beforeAssistantText);

      if (hasResponse) {
        responseStarted = true;
        break;
      }

      if (!retriedDispatch && Date.now() - startWaitTime > 3000) {
        const retried = await this.clickSendButtonIfAvailable() || await this.clickSendButtonByMouse();
        if (!retried) {
          await this.page.keyboard.press('Enter');
        }
        retriedDispatch = true;
      }

      await delay(STREAM_CHECK_INTERVAL);
    }

    if (!responseStarted) {
      throw new Error(`Timeout: ChatGPT khong phan hoi sau ${STREAM_START_TIMEOUT}ms`);
    }

    const streamStartTime = Date.now();
    let lastText = '';
    let noChangeCount = 0;

    while (Date.now() - streamStartTime < STREAM_MAX_TIMEOUT) {
      const assistantCount = await this.getAssistantCount();
      const latestAssistant = (await this.readLatestAssistant()) || '';
      const generating = await this.isGenerating();
      const isNewMessage = assistantCount > beforeAssistantCount;
      const isOverwritten = assistantCount === beforeAssistantCount && latestAssistant !== beforeAssistantText;
      const currentText = (isNewMessage || isOverwritten) ? latestAssistant : '';

      if (currentText && currentText !== lastText) {
        noChangeCount = 0;
        const delta = currentText.slice(lastText.length);
        if (delta && onDelta) onDelta(delta);
        lastText = currentText;
      } else if (currentText) {
        noChangeCount++;
      }

      if ((!generating && noChangeCount >= STREAM_NO_CHANGE_THRESHOLD && lastText) ||
          (noChangeCount >= STREAM_FALLBACK_THRESHOLD && lastText)) {
        break;
      }

      await delay(STREAM_CHECK_INTERVAL);
    }

    this.chatCount++;
    this.lastActive = Date.now();
    return lastText || await this.readLatestAssistant();
  }

  async startNewTemporaryChat() {
    if (!this.page) return;
    try {
      await this.page.goto(CHAT_URL, { waitUntil: 'networkidle2', timeout: 30000 });
      await this.ensurePageInteractive();
      if (HIDE_WINDOW) {
        await this.forceHideBrowserWindow();
      }
    } catch (e) {
      console.error(`[Worker ${this.id}] Loi reset chat:`, e.message);
    }
  }
}

let browser = null;
let page = null;

function getPrimaryWorker() {
  for (const worker of activeWorkers.values()) {
    if (worker.browser && worker.page) return worker;
  }
  return null;
}

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
  const worker = getPrimaryWorker();
  if (!worker?.browser) throw new Error('Browser chua khoi dong');
  const pages = await worker.browser.pages();
  if (!pages.length) throw new Error('Khong co trang nao dang mo');
  const cdp = await pages[0].createCDPSession();
  const { windowId } = await cdp.send('Browser.getWindowForTarget');
  await cdp.send('Browser.setWindowBounds', { windowId, bounds: { windowState: 'normal', left: 100, top: 100, width: 1200, height: 800 } });
  await cdp.detach();
}

export async function hideBrowserWindow() {
  const worker = getPrimaryWorker();
  if (!worker?.browser) throw new Error('Browser chua khoi dong');
  const pages = await worker.browser.pages();
  if (!pages.length) throw new Error('Khong co trang nao dang mo');
  const cdp = await pages[0].createCDPSession();
  const { windowId } = await cdp.send('Browser.getWindowForTarget');
  await cdp.send('Browser.setWindowBounds', {
    windowId,
    bounds: { windowState: 'normal', left: HIDDEN_X, top: HIDDEN_Y, width: 1280, height: 900 }
  });
  await cdp.detach();
}

export function isBrowserRunning() {
  return getPrimaryWorker() !== null;
}

export async function sendPromptAndWaitResponse(prompt, onDelta = null, _imageDataUrl = null) {
  const worker = getPrimaryWorker();
  if (!worker) {
    throw new Error('Browser chua duoc khoi tao');
  }
  return worker.sendPromptAndWaitResponse(prompt, onDelta, _imageDataUrl);
}

export async function startNewTemporaryChat() {
  const worker = getPrimaryWorker();
  if (!worker) return;
  await worker.startNewTemporaryChat();
}

export function getPage() { return getPrimaryWorker()?.page || null; }
export function getBrowser() { return getPrimaryWorker()?.browser || null; }

export async function isGenerating() {
  for (const worker of activeWorkers.values()) {
    if (await worker.isGenerating()) {
      return true;
    }
  }
  return false;
}
