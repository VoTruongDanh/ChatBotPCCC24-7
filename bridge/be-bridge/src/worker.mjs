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
// PHáº¦N 3a: CORE FUNCTIONS
// ============================================

let browser = null;
let page = null;

export async function launchBrowser() {
  const executablePath = getExecutable();
  if (!executablePath) {
    throw new Error('KhÃ´ng tÃ¬m tháº¥y Chrome/Edge executable');
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
    // Thá»­ nhiá»u selector khÃ¡c nhau cho ChatGPT
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
        console.log(`[Worker] TÃ¬m tháº¥y input vá»›i selector: ${selector}`);
        return element;
      }
    }

    console.warn('[Worker] KhÃ´ng tÃ¬m tháº¥y input vá»›i báº¥t ká»³ selector nÃ o');
    return null;
  } catch (err) {
    console.error('[Worker] Lá»—i khi tÃ¬m input:', err.message);
    return null;
  }
}

export async function waitForGenerationDone(timeout = 120000) {
  if (!page) return false;
  try {
    // Äá»£i nÃºt stop biáº¿n máº¥t (Ä‘ang generate)
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
    // Thá»­ nhiá»u cÃ¡ch phÃ¡t hiá»‡n Ä‘ang generate
    const result = await page.evaluate(() => {
      // CÃ¡ch 1: TÃ¬m stop button (visible)
      const stopBtn = document.querySelector('[data-testid="stop-generating"], button[aria-label="Stop generating"], button[aria-label*="Stop"]');
      if (stopBtn && stopBtn.offsetParent !== null && window.getComputedStyle(stopBtn).display !== 'none') {
        return true;
      }
      
      // CÃ¡ch 2: Kiá»ƒm tra streaming indicator
      const streamingIndicator = document.querySelector('[data-testid="streaming-indicator"]');
      if (streamingIndicator && streamingIndicator.offsetParent !== null) {
        return true;
      }
      
      // CÃ¡ch 3: Kiá»ƒm tra cursor blinking trong response cuá»‘i
      const responses = document.querySelectorAll('[data-message-author-role="assistant"]');
      if (responses.length > 0) {
        const lastResponse = responses[responses.length - 1];
        const cursor = lastResponse.querySelector('.result-streaming, [class*="cursor"], [class*="blink"]');
        if (cursor && cursor.offsetParent !== null) {
          return true;
        }
      }
      
      // CÃ¡ch 4: Kiá»ƒm tra button send bá»‹ disable (Ä‘ang generate)
      const sendBtn = document.querySelector('button[data-testid="send-button"], button[aria-label="Send message"]');
      if (sendBtn && sendBtn.disabled) {
        return true;
      }
      
      // KhÃ´ng tÃ¬m tháº¥y dáº¥u hiá»‡u nÃ o â†’ khÃ´ng Ä‘ang generate
      return false;
    });
    
    return result;
  } catch (err) {
    console.warn('[Worker] Lá»—i kiá»ƒm tra isGenerating:', err.message);
    // Náº¿u lá»—i, coi nhÆ° khÃ´ng Ä‘ang generate (Ä‘á»ƒ khÃ´ng bá»‹ treo)
    return false;
  }
}

// ============================================
// PHáº¦N 3b: IPC HANDLER + SEND PROMPT
// ============================================

export async function sendPromptAndWaitResponse(prompt, onDelta = null) {
  if (!page) {
    throw new Error('Browser chÆ°a Ä‘Æ°á»£c khá»Ÿi táº¡o');
  }

  const input = await findInput();
  if (!input) {
    throw new Error('KhÃ´ng tÃ¬m tháº¥y input textarea hoáº·c contenteditable');
  }

  // Kiá»ƒm tra loáº¡i input
  const tagName = await input.evaluate(el => el.tagName.toLowerCase());
  const isContentEditable = await input.evaluate(el => el.contentEditable === 'true');

  console.log(`[Worker] Input type: ${tagName}, contentEditable: ${isContentEditable}`);

  // Clear vÃ  type
  await input.click({ clickCount: 3 });
  
  if (isContentEditable) {
    // Vá»›i contenteditable div
    await input.evaluate((el, text) => {
      el.textContent = text;
      // Trigger input event
      el.dispatchEvent(new Event('input', { bubbles: true }));
    }, prompt);
  } else {
    // Vá»›i textarea
    await page.keyboard.type(prompt, { delay: 30 });
  }

  // Äá»£i má»™t chÃºt Ä‘á»ƒ UI update
  await new Promise(r => setTimeout(r, 500));

  // Gá»­i - thá»­ nhiá»u cÃ¡ch
  try {
    // CÃ¡ch 1: Enter key
    await page.keyboard.press('Enter');
  } catch (err) {
    console.warn('[Worker] KhÃ´ng thá»ƒ gá»­i báº±ng Enter, thá»­ click button');
    // CÃ¡ch 2: Click send button
    const sendBtn = await page.$('button[data-testid="send-button"], button[aria-label="Send message"]');
    if (sendBtn) {
      await sendBtn.click();
    } else {
      throw new Error('KhÃ´ng thá»ƒ gá»­i message');
    }
  }

  // Äá»£i response báº¯t Ä‘áº§u (tá»‘i Ä‘a tá»« config)
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
    throw new Error(`Timeout: ChatGPT khÃ´ng pháº£n há»“i sau ${STREAM_START_TIMEOUT}ms`);
  }

  // Stream response vá»›i no-change detection
  const streamStartTime = Date.now();
  let lastText = '';
  let noChangeCount = 0;

  while (Date.now() - streamStartTime < STREAM_MAX_TIMEOUT) {
    const currentText = await readLatestAssistant();
    const generating = await isGenerating();

    // Kiá»ƒm tra text cÃ³ thay Ä‘á»•i khÃ´ng
    if (currentText && currentText !== lastText) {
      // Text thay Ä‘á»•i - reset counter vÃ  gá»­i delta
      noChangeCount = 0;
      const delta = currentText.slice(lastText.length);
      if (delta && onDelta) {
        onDelta(delta);
      }
      lastText = currentText;
    } else if (currentText) {
      // Text khÃ´ng Ä‘á»•i - tÄƒng counter
      noChangeCount++;
    }

    // Debug log má»—i 5 láº§n check
    if (noChangeCount % 5 === 0 && noChangeCount > 0) {
      console.log(`[Worker] Äang Ä‘á»£i: generating=${generating}, noChangeCount=${noChangeCount}, textLength=${lastText?.length || 0}`);
    }

    // Äiá»u kiá»‡n dá»«ng:
    // 1. KhÃ´ng Ä‘ang generate VÃ€ text á»•n Ä‘á»‹nh (theo config) VÃ€ cÃ³ text
    // 2. HOáº¶C text á»•n Ä‘á»‹nh quÃ¡ lÃ¢u (fallback threshold) dÃ¹ generating=true
    if ((!generating && noChangeCount >= STREAM_NO_CHANGE_THRESHOLD && lastText) || 
        (noChangeCount >= STREAM_FALLBACK_THRESHOLD && lastText)) {
      if (noChangeCount >= STREAM_FALLBACK_THRESHOLD) {
        const fallbackSeconds = (STREAM_FALLBACK_THRESHOLD * STREAM_CHECK_INTERVAL / 1000).toFixed(1);
        console.log(`[Worker] Stream hoÃ n táº¥t: text á»•n Ä‘á»‹nh quÃ¡ lÃ¢u (${fallbackSeconds}s), bá» qua generating flag`);
      } else {
        console.log('[Worker] Stream hoÃ n táº¥t: khÃ´ng cÃ²n generate vÃ  text á»•n Ä‘á»‹nh');
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
    console.error('[Worker] Lá»—i reset chat:', e.message);
  }
}

// ============================================
// PHáº¦N 3c: EXPORTS & INIT
// ============================================

export function getPage() { return page; }
export function getBrowser() { return browser; }

// Test runner
if (import.meta.url === `file://${process.argv[1].replace(/\\/g, '/')}`) {
  (async () => {
    console.log('[Worker] Test khá»Ÿi Ä‘á»™ng browser...');
    try {
      await launchBrowser();
      console.log('[Worker] Browser Ä‘Ã£ khá»Ÿi Ä‘á»™ng thÃ nh cÃ´ng');

      // Test gá»­i message
      const response = await sendPromptAndWaitResponse('Xin chÃ o, báº¡n lÃ  ai?');
      console.log('[Worker] Response:', response?.slice(0, 200));

      await closeBrowser();
      console.log('[Worker] Test hoÃ n táº¥t');
    } catch (err) {
      console.error('[Worker] Lá»—i:', err);
      process.exit(1);
    }
  })();
}

