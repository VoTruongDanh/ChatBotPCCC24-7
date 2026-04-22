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
      title: 'Trang goi dich vu PCCC',
      intent: 'Nguoi dung dang xem cac goi dich vu va co the can tu van chon goi'
    };
  }

  if (pathname === '/') {
    return {
      title: 'Trang chu chat PCCC',
      intent: 'Nguoi dung dang o trang chat chinh cua website PCCC'
    };
  }

  return {
    title: 'Trang noi dung PCCC',
    intent: 'Nguoi dung dang duyet website PCCC va co the can duoc tu van'
  };
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
          {currentHint}
        </div>
      )}

      {open && (
        <div className="site-chat-panel">
          <div className="site-chat-panel-header">
            <div>
              <p className="site-chat-panel-title">Tư vấn PCCC</p>
              <p className="site-chat-panel-sub">
                {connectionStatus === 'connected' ? 'Sẵn sàng tư vấn gói dịch vụ và hồ sơ PCCC' : 'Đang kiểm tra kết nối'}
              </p>
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
                <p className="site-chat-empty-title">Chào bạn, mình có thể tư vấn:</p>
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
                  <div key={message.id} className={`site-chat-message ${message.role === 'user' ? 'is-user' : 'is-ai'} ${message.status === 'error' ? 'is-error' : ''}`}>
                    <span>{message.content || (message.status === 'streaming' ? '...' : '')}</span>
                  </div>
                ))}
                {waitingStatus && (
                  <div className="site-chat-message is-ai">
                    <span>{waitingStatus}</span>
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
            <input
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder="Nhập câu hỏi về gói dịch vụ, báo giá, hồ sơ..."
              disabled={loading || connectionStatus !== 'connected'}
              className="site-chat-input"
            />
            <button type="submit" className="site-chat-send" disabled={!input.trim() || loading || connectionStatus !== 'connected'}>
              {loading ? '...' : 'Gửi'}
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
        <span className="site-chat-launcher-icon">💬</span>
      </button>
    </div>
  );
}
