'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  status?: 'streaming' | 'done' | 'error';
}

type ConnectionStatus = 'checking' | 'connected' | 'disconnected';

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [sessionId, setSessionId] = useState('');
  const [mounted, setMounted] = useState(false);
  const [charCount, setCharCount] = useState(0);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('checking');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setSessionId(crypto.randomUUID());
    setMounted(true);
  }, []);

  useEffect(() => {
    const checkConnection = async () => {
      try {
        const res = await fetch(`${API_URL}/health`, { method: 'GET' });
        setConnectionStatus(res.ok ? 'connected' : 'disconnected');
      } catch {
        setConnectionStatus('disconnected');
      }
    };
    checkConnection();
    const interval = setInterval(checkConnection, 10000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || loading || connectionStatus !== 'connected') return;

    const userMessage: Message = { role: 'user', content: input };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setCharCount(0);
    setLoading(true);

    // Thêm message placeholder
    setMessages(prev => [...prev, { role: 'assistant', content: '', status: 'streaming' }]);

    try {
      const response = await fetch(`${API_URL}/api/chat/stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: input,
          messages: [...messages, userMessage],
          sessionId
        })
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unknown error');
        throw new Error(`Server error: ${response.status} - ${errorText}`);
      }

      if (!response.body) {
        throw new Error('No response body');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let assistantContent = '';

      while (true) {
        const { done, value } = await reader.read();
        
        if (done) {
          break;
        }

        // Decode và thêm vào buffer
        buffer += decoder.decode(value, { stream: true });
        
        // Tách theo dòng, giữ lại phần chưa hoàn chỉnh
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;

          // Xử lý SSE format: "data: {...}"
          if (trimmed.startsWith('data: ')) {
            const jsonStr = trimmed.slice(6);
            try {
              const data = JSON.parse(jsonStr);
              
              if (data.error) {
                throw new Error(data.error);
              }
              
              if (data.delta) {
                assistantContent += data.delta;
                setMessages(prev => {
                  const updated = [...prev];
                  updated[updated.length - 1] = { 
                    role: 'assistant', 
                    content: assistantContent, 
                    status: 'streaming' 
                  };
                  return updated;
                });
              }
              
              if (data.done && data.response) {
                // Server gửi response hoàn chỉnh
                setMessages(prev => {
                  const updated = [...prev];
                  updated[updated.length - 1] = { 
                    role: 'assistant', 
                    content: data.response, 
                    status: 'done' 
                  };
                  return updated;
                });
                return; // Done, exit
              }
            } catch (parseErr) {
              // Nếu không phải JSON error, ignore
              if (parseErr instanceof SyntaxError) {
                console.warn('Parse error:', jsonStr);
                continue;
              }
              throw parseErr;
            }
          }
        }
      }

      // Xử lý buffer còn lại
      if (buffer.trim()) {
        if (buffer.startsWith('data: ')) {
          const jsonStr = buffer.slice(6);
          try {
            const data = JSON.parse(jsonStr);
            if (data.response) {
              assistantContent = data.response;
            }
          } catch {}
        }
      }

      // Final check
      setMessages(prev => {
        const updated = [...prev];
        const lastMsg = updated[updated.length - 1];
        
        if (lastMsg?.status === 'streaming') {
          if (assistantContent && assistantContent.trim()) {
            lastMsg.content = assistantContent;
            lastMsg.status = 'done';
          } else {
            updated[updated.length - 1] = { 
              role: 'assistant', 
              content: '⚠️ Không nhận được phản hồi từ AI. Vui lòng thử lại.', 
              status: 'error' 
            };
          }
        }
        return updated;
      });

    } catch (err) {
      const errorMessage = err instanceof Error 
        ? `❌ Lỗi: ${err.message}` 
        : '❌ Không thể kết nối đến server. Vui lòng thử lại sau.';
      
      setMessages(prev => {
        const updated = [...prev];
        // Xóa placeholder nếu có
        if (updated[updated.length - 1]?.status === 'streaming') {
          updated[updated.length - 1] = { 
            role: 'assistant', 
            content: errorMessage, 
            status: 'error' 
          };
        } else {
          updated.push({ 
            role: 'assistant', 
            content: errorMessage, 
            status: 'error' 
          });
        }
        return updated;
      });
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setInput(value);
    setCharCount(value.length);
  };

  const getStatusBadge = () => {
    switch (connectionStatus) {
      case 'checking':
        return (
          <span className="flex items-center gap-2 px-3 py-1.5 bg-gradient-to-r from-gray-100 to-gray-200 text-gray-600 text-xs rounded-full shadow-sm">
            <svg className="w-3.5 h-3.5 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <circle cx="12" cy="12" r="10" strokeOpacity="0.25" />
              <path d="M12 2a10 10 0 0 1 10 10" strokeLinecap="round" />
            </svg>
            <span className="font-medium">Đang kết nối...</span>
          </span>
        );
      case 'connected':
        return (
          <span className="flex items-center gap-2 px-3 py-1.5 bg-gradient-to-r from-green-50 to-emerald-100 text-green-700 text-xs rounded-full shadow-sm border border-green-200">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500"></span>
            </span>
            <span className="font-medium">Sẵn sàng</span>
          </span>
        );
      case 'disconnected':
        return (
          <span className="flex items-center gap-2 px-3 py-1.5 bg-gradient-to-r from-red-50 to-red-100 text-red-700 text-xs rounded-full shadow-sm border border-red-200 animate-pulse">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500"></span>
            </span>
            <span className="font-medium">Mất kết nối</span>
          </span>
        );
    }
  };

  if (!mounted) return null;

  return (
    <div className="relative min-h-screen overflow-hidden">
      {/* Background Gradient - Always visible as fallback */}
      <div
        className="absolute inset-0 w-full h-full bg-gradient-to-br from-red-50 via-orange-50 to-yellow-50"
        style={{ filter: 'blur(80px)', opacity: 0.7 }}
      />
      <div className="absolute inset-0 w-full h-full bg-gradient-to-tr from-red-100/30 via-transparent to-orange-100/30" />
      
      {/* Dark overlay for better text readability */}
      <div className="absolute inset-0 bg-black/5" />
      
      {/* Content Overlay */}
      <div className="relative z-10 min-h-screen flex flex-col">
        {/* Navigation */}
        <nav className="flex items-center justify-between px-6 md:px-[120px] py-4">
          <div className="flex items-center gap-8">
            <div className="flex items-center gap-2">
              <svg className="w-6 h-6 text-red-600" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-1-13h2v6h-2zm0 8h2v2h-2z"/>
              </svg>
              <span className="text-2xl font-bold tracking-[-1.44px] text-red-600" style={{ fontFamily: 'Schibsted Grotesk, sans-serif' }}>
                PCCC Consult
              </span>
            </div>
            <div className="hidden md:flex items-center gap-6">
              <Link href="/dich-vu" className="text-base font-medium tracking-[-0.2px] hover:opacity-70" style={{ fontFamily: 'Schibsted Grotesk, sans-serif' }}>
                Dịch vụ
              </Link>
              {['Quy định', 'Hồ sơ', 'Liên hệ'].map((item) => (
                <a key={item} href="#" className="text-base font-medium tracking-[-0.2px] hover:opacity-70" style={{ fontFamily: 'Schibsted Grotesk, sans-serif' }}>
                  {item}
                </a>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-3">
            {getStatusBadge()}
            <button className="hidden md:block px-4 py-2 text-sm font-medium">Đăng ký</button>
            <button className="px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700">Đăng nhập</button>
          </div>
        </nav>

        {/* Hero Content */}
        <div className="flex-1 flex flex-col items-center justify-center -mt-[50px] px-6 md:px-[120px]">
          {/* Badge */}
          <div className="flex items-center gap-2 mb-6">
            <span className="inline-flex items-center gap-1 px-3 py-1 bg-red-600 text-white text-xs rounded-full font-medium">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
              </svg>
              Mới
            </span>
            <span className="px-3 py-1 bg-white/90 text-sm rounded-full shadow-sm font-medium" style={{ fontFamily: 'Inter, sans-serif' }}>
              Tư vấn AI thông minh
            </span>
          </div>

          {/* Headline */}
          <h1 className="text-4xl md:text-[80px] font-bold tracking-[-4.8px] text-center text-gray-900 mb-4" style={{ fontFamily: 'Fustat, sans-serif', lineHeight: 1 }}>
            Tư Vấn PCCC Nhanh Chóng
          </h1>

          {/* Subtitle */}
          <p className="text-lg md:text-xl font-medium tracking-[-0.4px] text-gray-700 text-center max-w-[600px] mb-11" style={{ fontFamily: 'Fustat, sans-serif' }}>
            Hỏi đáp về quy định phòng cháy chữa cháy, hồ sơ thiết kế, nghiệm thu và các vấn đề liên quan. Được hỗ trợ bởi AI thông minh.
          </p>

          {/* Search Input Box */}
          <div className={`w-full max-w-[728px] p-4 rounded-[18px] transition-all duration-500 ${
            connectionStatus === 'connected' 
              ? 'shadow-xl shadow-red-500/10' 
              : connectionStatus === 'disconnected'
                ? 'shadow-xl shadow-red-500/20'
                : ''
          }`} style={{ background: 'rgba(220,38,38,0.15)', backdropFilter: 'blur(10px)', border: '1px solid rgba(220,38,38,0.2)' }}>
            {/* Top Row - Status */}
            <div className="flex items-center justify-between mb-3 px-2">
              <div className="flex items-center gap-2">
                <svg className="w-4 h-4 text-gray-700" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                </svg>
                <span className="text-xs text-gray-800 font-semibold" style={{ fontFamily: 'Schibsted Grotesk, sans-serif' }}>
                  Trợ lý AI PCCC
                </span>
              </div>
              <div className="flex items-center gap-3">
                {loading && (
                  <span className="flex items-center gap-2 px-3 py-1 bg-gradient-to-r from-blue-50 to-indigo-100 text-blue-700 text-xs rounded-full border border-blue-200">
                    <svg className="w-3.5 h-3.5 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <circle cx="12" cy="12" r="10" strokeOpacity="0.25" />
                      <path d="M12 2a10 10 0 0 1 10 10" strokeLinecap="round" />
                    </svg>
                    <span className="font-medium">AI đang suy nghĩ...</span>
                    <span className="flex gap-0.5">
                      <span className="w-1 h-1 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                      <span className="w-1 h-1 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                      <span className="w-1 h-1 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
                    </span>
                  </span>
                )}
                <div className="flex items-center gap-1 text-xs text-gray-700 font-medium" style={{ fontFamily: 'Schibsted Grotesk, sans-serif' }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" className="text-red-600">
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z" />
                  </svg>
                  Hỗ trợ bởi AI
                </div>
              </div>
            </div>

            {/* Main Input */}
            <form onSubmit={sendMessage} className="bg-white rounded-xl p-3 shadow-lg">
              <div className="flex items-center gap-3">
                <input
                  type="text"
                  value={input}
                  onChange={handleInputChange}
                  placeholder={connectionStatus === 'connected' ? "Hỏi về quy định PCCC, hồ sơ thiết kế, nghiệm thu..." : "Đang chờ kết nối server..."}
                  className="flex-1 text-base outline-none"
                  style={{ color: 'rgba(0,0,0,0.8)' }}
                  disabled={loading || connectionStatus !== 'connected'}
                  maxLength={3000}
                />
                <button
                  type="submit"
                  className={`w-10 h-10 rounded-full flex items-center justify-center text-white transition-all duration-300 shadow-lg ${
                    loading 
                      ? 'bg-gradient-to-r from-blue-500 to-indigo-500 cursor-wait' 
                      : connectionStatus !== 'connected'
                        ? 'bg-gray-300 cursor-not-allowed'
                        : 'bg-gradient-to-r from-red-500 to-orange-500 hover:from-red-600 hover:to-orange-600 hover:scale-105 active:scale-95'
                  }`}
                  disabled={loading || !input.trim() || connectionStatus !== 'connected'}
                >
                  {loading ? (
                    <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <circle cx="12" cy="12" r="10" strokeOpacity="0.25" />
                      <path d="M12 2a10 10 0 0 1 10 10" strokeLinecap="round" />
                    </svg>
                  ) : (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 4l-1.41 1.41L16.17 11H4v2h12.17l-5.58 5.59L12 20l8-8z" />
                    </svg>
                  )}
                </button>
              </div>

              {/* Bottom Row */}
              <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-100">
                <div className="flex items-center gap-2">
                  <button type="button" className="flex items-center gap-1 px-2 py-1 bg-gray-100 rounded text-xs text-gray-600 hover:bg-gray-200">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48" />
                    </svg>
                    Đính kèm
                  </button>
                  <button type="button" className="flex items-center gap-1 px-2 py-1 bg-gray-100 rounded text-xs text-gray-600 hover:bg-gray-200">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z" />
                      <path d="M19 10v2a7 7 0 01-14 0v-2" />
                      <line x1="12" y1="19" x2="12" y2="23" />
                      <line x1="8" y1="23" x2="16" y2="23" />
                    </svg>
                    Giọng nói
                  </button>
                </div>
                <span className="text-xs text-gray-400">{charCount}/3,000</span>
              </div>
            </form>
          </div>

          {/* Messages */}
          {messages.length > 0 && (
            <div className="w-full max-w-[728px] mt-8 space-y-4">
              {messages.map((msg, i) => (
                <div
                  key={i}
                  className={`p-4 rounded-xl ${
                    msg.role === 'user' 
                      ? 'bg-red-600 text-white ml-auto' 
                      : msg.status === 'error'
                        ? 'bg-red-50 border border-red-200 text-red-800'
                        : 'bg-white text-gray-900 shadow-md'
                  }`}
                  style={{ maxWidth: '80%' }}
                >
                  <div className="flex items-start gap-3">
                    {msg.role === 'user' ? (
                      <svg className="w-5 h-5 text-current flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
                      </svg>
                    ) : msg.status === 'error' ? (
                      <svg className="w-5 h-5 text-current flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
                      </svg>
                    ) : (
                      <svg className="w-5 h-5 text-current flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M20 9V7c0-1.1-.9-2-2-2h-3c0-1.66-1.34-3-3-3S9 3.34 9 5H6c-1.1 0-2 .9-2 2v2c-1.66 0-3 1.34-3 3s1.34 3 3 3v4c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2v-4c1.66 0 3-1.34 3-3s-1.34-3-3-3zM7.5 11.5c0-.83.67-1.5 1.5-1.5s1.5.67 1.5 1.5S9.83 13 9 13s-1.5-.67-1.5-1.5zM16 17H8v-2h8v2zm-1-4c-.83 0-1.5-.67-1.5-1.5S14.17 10 15 10s1.5.67 1.5 1.5S15.83 13 15 13z"/>
                      </svg>
                    )}
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <strong className="block">
                          {msg.role === 'user' ? 'Bạn' : msg.status === 'error' ? 'Lỗi' : 'Trợ lý PCCC'}
                        </strong>
                        {msg.status === 'streaming' && (
                          <span className="flex items-center gap-1.5 px-2 py-0.5 bg-gradient-to-r from-blue-50 to-indigo-50 text-blue-600 text-xs rounded-full">
                            <span className="flex gap-0.5">
                              <span className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-pulse"></span>
                              <span className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-pulse" style={{ animationDelay: '200ms' }}></span>
                              <span className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-pulse" style={{ animationDelay: '400ms' }}></span>
                            </span>
                            <span className="font-medium">Đang viết</span>
                          </span>
                        )}
                        {msg.status === 'done' && (
                          <span className="flex items-center gap-1 px-2 py-0.5 bg-gradient-to-r from-green-50 to-emerald-50 text-green-600 text-xs rounded-full border border-green-200">
                            <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor">
                              <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
                            </svg>
                            <span className="font-medium">Hoàn thành</span>
                          </span>
                        )}
                      </div>
                      <p className="whitespace-pre-wrap">{msg.content || (msg.status === 'streaming' ? '...' : '')}</p>
                    </div>
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
