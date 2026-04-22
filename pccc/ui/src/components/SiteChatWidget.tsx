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
                  <p className="site-chat-empty-title">Mini chat này dùng cùng engine với trang chủ.</p>
                  <p className="site-chat-empty-copy">
                    Hỏi nhanh về gói phù hợp, hồ sơ PCCC, thẩm duyệt, nghiệm thu hoặc bảo trì hệ thống.
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
          <FlameMark />
        </span>
      </button>
    </div>
  );
}
