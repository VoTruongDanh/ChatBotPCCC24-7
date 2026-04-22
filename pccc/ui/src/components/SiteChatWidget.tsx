'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { API_URL, EMPTY_SERVICE_DATA, ServicePackagesResponse } from '@/lib/service-packages';

interface WidgetMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  status?: 'streaming' | 'done' | 'error';
}

const FALLBACK_HINTS = [
  'Tư vấn gói PCCC phù hợp công trình của bạn',
  'Xem nhanh gói recommend đang được đề xuất',
  'Hỏi chi phí, hồ sơ, nghiệm thu hoặc bảo trì hệ thống'
];

function makeId() {
  return self.crypto?.randomUUID?.() || Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function getPageIntent(pathname: string) {
  if (pathname === '/dich-vu') {
    return {
      title: 'Trang gói dịch vụ PCCC',
      intent: 'Người dùng đang xem các gói dịch vụ và có thể cần tư vấn chọn gói'
    };
  }

  if (pathname === '/') {
    return {
      title: 'Trang chủ chat PCCC',
      intent: 'Người dùng đang ở trang chat chính của website PCCC'
    };
  }

  return {
    title: 'Trang nội dung PCCC',
    intent: 'Người dùng đang duyệt website PCCC và có thể cần được tư vấn'
  };
}

function FlameMark() {
  return (
    <svg width="20" height="20" viewBox="0 0 28 28" fill="none" aria-hidden="true">
      <path d="M14 2C14 2 8 8 8 14C8 17.3 10.7 20 14 20C17.3 20 20 17.3 20 14C20 11 18 9 18 9C18 9 17 12 15 13C15 13 16 10 14 7C14 7 13 10 11 11C11 11 12 7 14 2Z" fill="url(#widget-flame-1)" />
      <path d="M14 23C11.2 23 9 20.8 9 18C9 16.4 9.8 15 11 14.2C11.2 15.1 11.8 15.9 12.6 16.3C12.3 15.7 12 15 12 14.2C12 12.4 13.3 11 14 9.5C14.7 11 16 12.4 16 14.2C16 15 15.7 15.7 15.4 16.3C16.2 15.9 16.8 15.1 17 14.2C18.2 15 19 16.4 19 18C19 20.8 16.8 23 14 23Z" fill="url(#widget-flame-2)" />
      <defs>
        <linearGradient id="widget-flame-1" x1="14" y1="2" x2="14" y2="20" gradientUnits="userSpaceOnUse">
          <stop stopColor="#FF6B35" />
          <stop offset="1" stopColor="#DC2626" />
        </linearGradient>
        <linearGradient id="widget-flame-2" x1="14" y1="9.5" x2="14" y2="23" gradientUnits="userSpaceOnUse">
          <stop stopColor="#FBBF24" />
          <stop offset="1" stopColor="#EF4444" />
        </linearGradient>
      </defs>
    </svg>
  );
}

function ChatLauncherMark() {
  return (
    <svg width="92" height="92" viewBox="0 0 92 92" fill="none" aria-hidden="true">
      <defs>
        <linearGradient id="launcherShell" x1="14" y1="28" x2="78" y2="78" gradientUnits="userSpaceOnUse">
          <stop stopColor="#123E73" />
          <stop offset="1" stopColor="#0B2445" />
        </linearGradient>
        <linearGradient id="launcherFlameOuter" x1="46" y1="10" x2="46" y2="62" gradientUnits="userSpaceOnUse">
          <stop stopColor="#FF7A1A" />
          <stop offset="0.55" stopColor="#FF4D1A" />
          <stop offset="1" stopColor="#D11212" />
        </linearGradient>
        <linearGradient id="launcherFlameInner" x1="46" y1="28" x2="46" y2="64" gradientUnits="userSpaceOnUse">
          <stop stopColor="#FF6A00" />
          <stop offset="1" stopColor="#C40016" />
        </linearGradient>
        <linearGradient id="launcherShield" x1="46" y1="34" x2="46" y2="61" gradientUnits="userSpaceOnUse">
          <stop stopColor="#F8FAFC" />
          <stop offset="1" stopColor="#D9E2EC" />
        </linearGradient>
        <filter id="launcherGlow" x="0" y="0" width="92" height="92" filterUnits="userSpaceOnUse" colorInterpolationFilters="sRGB">
          <feGaussianBlur stdDeviation="8" result="blur" />
          <feColorMatrix in="blur" type="matrix" values="1 0 0 0 0.93 0 1 0 0 0.32 0 0 1 0 0.18 0 0 0 0.32 0" />
        </filter>
      </defs>

      <ellipse cx="46" cy="48" rx="28" ry="20" fill="#FF8A00" opacity="0.18" filter="url(#launcherGlow)" />
      <path d="M15 37C15 27.6 22.6 20 32 20H60C69.4 20 77 27.6 77 37V56C77 65.4 69.4 73 60 73H40L30 81V73H32C22.6 73 15 65.4 15 56V37Z" fill="url(#launcherShell)" />
      <path d="M17 39C17 30.7 23.7 24 32 24H60C68.3 24 75 30.7 75 39V54C75 62.3 68.3 69 60 69H38.6L31.5 74.6V69H32C23.7 69 17 62.3 17 54V39Z" stroke="rgba(255,255,255,0.12)" />
      <path d="M46 10C46 10 42.8 22.1 33.4 31.8C28.2 37.2 25.5 43.5 25.5 49.5C25.5 62.5 34.8 70.8 46 70.8C57.2 70.8 66.5 62.8 66.5 49.7C66.5 40.7 61.2 33.4 56.5 29.5C56.5 29.5 56 35.1 51.2 39.4C51.2 39.4 52.8 29.8 46 10Z" fill="url(#launcherFlameOuter)" />
      <path d="M46 28C46 28 43.8 35.4 39 40.8C35.2 45.1 33.7 49 33.7 53.3C33.7 60.9 39.1 66.2 46 66.2C52.9 66.2 58.3 61.1 58.3 53.4C58.3 48.3 55.5 44.1 52.8 41.8C52.8 41.8 52.6 45.1 49.8 47.7C49.8 47.7 50.5 41.9 46 28Z" fill="url(#launcherFlameInner)" />
      <path d="M46 32.5L57.2 39V50.8C57.2 58.1 52.6 64.5 46 67C39.4 64.5 34.8 58.1 34.8 50.8V39L46 32.5Z" fill="url(#launcherShield)" />
      <path d="M46 36.5L53.7 41V50.1C53.7 55.2 50.7 59.7 46 61.8C41.3 59.7 38.3 55.2 38.3 50.1V41L46 36.5Z" fill="#DC2626" />
      <path d="M46 42.2C44.7 42.2 43.6 43.3 43.6 44.6H48.4C48.4 43.3 47.3 42.2 46 42.2Z" fill="white" />
      <path d="M42.6 45.1H49.4C50 45.1 50.5 45.6 50.5 46.2V47.4H41.5V46.2C41.5 45.6 42 45.1 42.6 45.1Z" fill="white" />
      <path d="M41.9 48.4H50.1V49.9C50.1 50.5 49.6 51 49 51H43C42.4 51 41.9 50.5 41.9 49.9V48.4Z" fill="white" />
      <path d="M42.6 53.6H49.4" stroke="white" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M42.6 56.8H49.4" stroke="white" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M63.5 40.5C67.2 44.1 69.2 48.9 69.2 54.1C69.2 56.8 68.7 59.4 67.7 61.8" stroke="white" strokeWidth="2" strokeLinecap="round" opacity="0.85" />
      <circle cx="67.7" cy="62.3" r="2.2" fill="white" opacity="0.9" />
      <path d="M20.8 42.5L15.7 47.2V57.5L20.8 60.9" fill="#FBBF24" opacity="0.95" />
      <path d="M71.2 42.5L76.3 47.2V57.5L71.2 60.9" fill="#FBBF24" opacity="0.95" />
    </svg>
  );
}

function TypingDots() {
  return (
    <span className="site-chat-typing" aria-hidden="true">
      <span className="site-chat-dot" />
      <span className="site-chat-dot" />
      <span className="site-chat-dot" />
    </span>
  );
}

function isShortLine(line: string) {
  return line.length <= 68 && !/[.!?]$/.test(line);
}

function renderFormattedMessage(content: string) {
  const normalized = content.replace(/\r/g, '').trim();
  if (!normalized) return null;

  const blocks = normalized.split(/\n\s*\n+/).map((block) => block.trim()).filter(Boolean);
  const nodes: React.ReactNode[] = [];

  for (let i = 0; i < blocks.length; i += 1) {
    const block = blocks[i];
    const lines = block.split('\n').map((line) => line.trim()).filter(Boolean);
    const singleLine = lines.join(' ');
    const isHeading = lines.length === 1 && singleLine.length <= 90 && singleLine.endsWith(':');
    const isExplicitList = lines.length > 1 && lines.every((line) => /^([-•*]|\d+\.)\s+/.test(line));
    const isCallout = /^(👉|Gợi ý nhanh|Lưu ý|Nên chọn|Chỉ nên)/i.test(singleLine);

    if (isHeading) {
      const listItems: string[] = [];
      let nextIndex = i + 1;

      while (nextIndex < blocks.length) {
        const nextBlock = blocks[nextIndex].trim();
        const nextLines = nextBlock.split('\n').map((line) => line.trim()).filter(Boolean);
        if (
          nextLines.length !== 1 ||
          nextBlock.endsWith(':') ||
          nextBlock.length > 90 ||
          /^(👉|Gợi ý nhanh|Lưu ý|Nên chọn|Chỉ nên)/i.test(nextBlock) ||
          !isShortLine(nextBlock)
        ) {
          break;
        }
        listItems.push(nextBlock);
        nextIndex += 1;
      }

      nodes.push(
        <div key={`heading-${i}`} className="site-chat-block">
          <p className="site-chat-rich-heading">{singleLine}</p>
          {listItems.length > 0 && (
            <ul className="site-chat-rich-list">
              {listItems.map((item, index) => (
                <li key={`li-${i}-${index}`}>{item}</li>
              ))}
            </ul>
          )}
        </div>
      );

      if (listItems.length > 0) {
        i = nextIndex - 1;
      }
      continue;
    }

    if (isExplicitList) {
      nodes.push(
        <ul key={`list-${i}`} className="site-chat-rich-list">
          {lines.map((line, index) => (
            <li key={`explicit-${i}-${index}`}>{line.replace(/^([-•*]|\d+\.)\s+/, '')}</li>
          ))}
        </ul>
      );
      continue;
    }

    if (isCallout) {
      nodes.push(
        <div key={`callout-${i}`} className="site-chat-rich-callout">
          {singleLine}
        </div>
      );
      continue;
    }

    nodes.push(
      <p key={`paragraph-${i}`} className="site-chat-rich-paragraph">
        {lines.join(' ')}
      </p>
    );
  }

  return <div className="site-chat-rich">{nodes}</div>;
}

export default function SiteChatWidget() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<WidgetMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [sessionId, setSessionId] = useState('');
  const [serviceData, setServiceData] = useState<ServicePackagesResponse>(EMPTY_SERVICE_DATA);
  const [connectionStatus, setConnectionStatus] = useState<'checking' | 'connected' | 'disconnected'>('checking');
  const [waitingStatus, setWaitingStatus] = useState<string | null>(null);
  const [hintIndex, setHintIndex] = useState(0);
  const [showHint, setShowHint] = useState(false);
  const panelBodyRef = useRef<HTMLDivElement>(null);

  const hidden = pathname === '/' || pathname?.startsWith('/admin');

  useEffect(() => {
    setSessionId(makeId());
  }, []);

  useEffect(() => {
    if (hidden) return;

    const loadServiceData = async () => {
      try {
        const response = await fetch(`${API_URL}/api/service-packages`);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json() as ServicePackagesResponse;
        setServiceData({
          packages: Array.isArray(data.packages) ? data.packages : [],
          additionalServices: Array.isArray(data.additionalServices) ? data.additionalServices : []
        });
      } catch {
        setServiceData(EMPTY_SERVICE_DATA);
      }
    };

    void loadServiceData();
  }, [hidden]);

  useEffect(() => {
    if (hidden) return;

    const check = async () => {
      try {
        const response = await fetch(`${API_URL}/health`);
        setConnectionStatus(response.ok ? 'connected' : 'disconnected');
      } catch {
        setConnectionStatus('disconnected');
      }
    };

    void check();
    const timer = setInterval(check, 10000);
    return () => clearInterval(timer);
  }, [hidden]);

  useEffect(() => {
    if (!panelBodyRef.current) return;
    panelBodyRef.current.scrollTop = panelBodyRef.current.scrollHeight;
  }, [messages, open, waitingStatus]);

  const rotatingHints = useMemo(() => {
    const recommendedPackage = serviceData.packages.find((pkg) => pkg.recommended);
    const packageHint = recommendedPackage
      ? `Gợi ý nhanh: ${recommendedPackage.name} đang là gói recommend`
      : null;
    const serviceHint = serviceData.additionalServices[0]
      ? `Có thể hỏi thêm về ${serviceData.additionalServices[0].title.toLowerCase()}`
      : null;

    return [packageHint, serviceHint, ...FALLBACK_HINTS].filter(Boolean) as string[];
  }, [serviceData]);

  useEffect(() => {
    if (hidden || open || rotatingHints.length === 0) return;

    setShowHint(true);
    const rotate = window.setInterval(() => {
      setShowHint(false);
      window.setTimeout(() => {
        setHintIndex((prev) => (prev + 1) % rotatingHints.length);
        setShowHint(true);
      }, 450);
    }, 7000);

    return () => window.clearInterval(rotate);
  }, [hidden, open, rotatingHints.length]);

  const quickActions = useMemo(() => {
    const recommendedPackage = serviceData.packages.find((pkg) => pkg.recommended);
    const actions = [
      recommendedPackage ? `Gói ${recommendedPackage.name} phù hợp cho ai?` : '',
      serviceData.packages[0] ? `Báo giá ${serviceData.packages[0].name}` : '',
      'Tư vấn gói phù hợp cho công trình của tôi'
    ];
    return actions.filter(Boolean);
  }, [serviceData]);

  const resetChat = useCallback(async () => {
    try {
      await fetch(`${API_URL}/api/reset`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId })
      });
    } catch {
      // Ignore reset failure for widget UX.
    }

    setMessages([]);
    setInput('');
    setWaitingStatus(null);
    setSessionId(makeId());
  }, [sessionId]);

  const sendPrompt = useCallback(async (prompt: string) => {
    const trimmedPrompt = prompt.trim();
    if (!trimmedPrompt || loading || connectionStatus !== 'connected') return;

    const userId = makeId();
    const assistantId = makeId();

    setMessages((prev) => [
      ...prev,
      { id: userId, role: 'user', content: trimmedPrompt, status: 'done' },
      { id: assistantId, role: 'assistant', content: '', status: 'streaming' }
    ]);
    setInput('');
    setLoading(true);
    setWaitingStatus(null);

    try {
      const response = await fetch(`${API_URL}/api/chat/stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: trimmedPrompt,
          sessionId,
          pageContext: {
            path: pathname || '/',
            source: 'site-chat-widget',
            ...getPageIntent(pathname || '/')
          }
        })
      });

      if (!response.ok) throw new Error(`Server error: ${response.status}`);
      if (!response.body) throw new Error('No response body');

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let accumulated = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith('data: ')) continue;

          try {
            const data = JSON.parse(trimmed.slice(6)) as {
              error?: string;
              status?: { message?: string };
              delta?: string;
              done?: boolean;
              response?: string;
            };

            if (data.error) throw new Error(data.error);

            if (data.status?.message) {
              setWaitingStatus(data.status.message);
            }

            if (data.delta) {
              setWaitingStatus(null);
              accumulated += data.delta;
              const currentContent = accumulated;
              setMessages((prev) => prev.map((msg) => (
                msg.id === assistantId ? { ...msg, content: currentContent } : msg
              )));
            }

            if (data.done && data.response) {
              const responseText = data.response || accumulated;
              setMessages((prev) => prev.map((msg) => (
                msg.id === assistantId ? { ...msg, content: responseText, status: 'done' } : msg
              )));
              return;
            }
          } catch (error) {
            if (error instanceof SyntaxError) continue;
            throw error;
          }
        }
      }

      setMessages((prev) => prev.map((msg) => (
        msg.id === assistantId
          ? accumulated.trim()
            ? { ...msg, content: accumulated, status: 'done' }
            : { ...msg, content: '⚠ Không nhận được phản hồi. Vui lòng thử lại.', status: 'error' }
          : msg
      )));
    } catch (error) {
      const message = error instanceof Error ? `❌ Lỗi: ${error.message}` : '❌ Không thể kết nối server.';
      setMessages((prev) => prev.map((msg) => (
        msg.id === assistantId ? { ...msg, content: message, status: 'error' } : msg
      )));
    } finally {
      setLoading(false);
      setWaitingStatus(null);
    }
  }, [connectionStatus, loading, pathname, sessionId]);

  const currentHint = rotatingHints[hintIndex] || FALLBACK_HINTS[0];

  if (hidden) {
    return null;
  }

  return (
    <div className="site-chat-widget">
      {!open && (
        <div className={`site-chat-hint ${showHint ? 'is-visible' : ''}`}>
          <div className="site-chat-hint-mark">
            <FlameMark />
          </div>
          <div className="site-chat-hint-content">
            <span className="site-chat-hint-label">PCCC Consult</span>
            <span>{currentHint}</span>
          </div>
        </div>
      )}

      {open && (
        <div className="site-chat-panel">
          <div className="site-chat-panel-topglow" />
          <div className="site-chat-panel-header">
            <div className="site-chat-panel-brand">
              <div className="site-chat-brand-icon">
                <FlameMark />
              </div>
              <div>
                <p className="site-chat-panel-title">Tư vấn PCCC</p>
                <div className="site-chat-panel-subrow">
                  <span className={`site-chat-status site-chat-status-${connectionStatus}`}>
                    <span className="site-chat-status-dot" />
                    {connectionStatus === 'connected' ? 'Sẵn sàng' : connectionStatus === 'checking' ? 'Đang kết nối' : 'Mất kết nối'}
                  </span>
                  <span className="site-chat-panel-subtext">Gói dịch vụ, hồ sơ, nghiệm thu</span>
                </div>
              </div>
            </div>
            <div className="site-chat-panel-actions">
              {messages.length > 0 && (
                <button className="site-chat-icon-btn" onClick={() => void resetChat()} title="Cuộc trò chuyện mới">
                  ↻
                </button>
              )}
              <button className="site-chat-icon-btn" onClick={() => setOpen(false)} title="Thu gọn">
                ×
              </button>
            </div>
          </div>

          <div className="site-chat-panel-body" ref={panelBodyRef}>
            {messages.length === 0 ? (
              <div className="site-chat-empty">
                <div className="site-chat-empty-card">
                  <p className="site-chat-empty-title">Tư vấn nhanh gói dịch vụ PCCC</p>
                  <p className="site-chat-empty-copy">
                    Hỏi về gói phù hợp, chi phí dự kiến, hồ sơ cần chuẩn bị hoặc các hạng mục nghiệm thu cho công trình của bạn.
                  </p>
                </div>
                <div className="site-chat-quick-list">
                  {quickActions.map((action) => (
                    <button key={action} className="site-chat-chip" onClick={() => void sendPrompt(action)}>
                      {action}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="site-chat-messages">
                {messages.map((message) => (
                  <div key={message.id} className={`site-chat-row ${message.role === 'user' ? 'is-user' : 'is-ai'}`}>
                    {message.role === 'assistant' && (
                      <div className={`site-chat-avatar ${message.status === 'error' ? 'is-error' : ''}`}>
                        <FlameMark />
                      </div>
                    )}
                    <div className={`site-chat-bubble ${message.role === 'user' ? 'is-user' : 'is-ai'} ${message.status === 'error' ? 'is-error' : ''}`}>
                      <div className="site-chat-bubble-meta">
                        <span className="site-chat-sender">{message.role === 'user' ? 'Bạn' : message.status === 'error' ? 'Lỗi' : 'Trợ lý PCCC'}</span>
                        {message.status === 'streaming' && (
                          <span className="site-chat-badge">
                            <TypingDots />
                            <span>Đang soạn</span>
                          </span>
                        )}
                      </div>
                      <div className="site-chat-message-text">
                        {renderFormattedMessage(message.content || (message.status === 'streaming' ? '...' : ''))}
                      </div>
                    </div>
                  </div>
                ))}
                {waitingStatus && (
                  <div className="site-chat-row is-ai">
                    <div className="site-chat-avatar">
                      <FlameMark />
                    </div>
                    <div className="site-chat-bubble is-ai is-waiting">
                      <div className="site-chat-bubble-meta">
                        <span className="site-chat-sender">Trợ lý PCCC</span>
                        <span className="site-chat-badge">
                          <TypingDots />
                          <span>Đang xử lý</span>
                        </span>
                      </div>
                      <div className="site-chat-message-text">{renderFormattedMessage(waitingStatus)}</div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          <form
            className="site-chat-panel-footer"
            onSubmit={(event) => {
              event.preventDefault();
              void sendPrompt(input);
            }}
          >
            <div className="site-chat-input-shell">
              <input
                value={input}
                onChange={(event) => setInput(event.target.value)}
                placeholder="Nhập câu hỏi về gói dịch vụ, báo giá, hồ sơ..."
                disabled={loading || connectionStatus !== 'connected'}
                className="site-chat-input"
              />
            </div>
            <button type="submit" className="site-chat-send" disabled={!input.trim() || loading || connectionStatus !== 'connected'}>
              {loading ? '...' : '➜'}
            </button>
          </form>
        </div>
      )}

      <button
        className={`site-chat-launcher ${open ? 'is-open' : ''}`}
        onClick={() => setOpen((prev) => !prev)}
        aria-label="Mở tư vấn PCCC"
      >
        <span className="site-chat-launcher-ping" />
        <span className="site-chat-launcher-core">
          <ChatLauncherMark />
        </span>
      </button>
    </div>
  );
}
