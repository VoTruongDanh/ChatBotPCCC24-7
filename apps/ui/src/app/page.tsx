'use client';

import { useState, useRef, useEffect, useCallback } from 'react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [sessionId, setSessionId] = useState('');
  const [mounted, setMounted] = useState(false);
  const [credits] = useState(60);
  const [charCount, setCharCount] = useState(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const fadingOutRef = useRef(false);
  const fadeFrameRef = useRef<number>(0);

  useEffect(() => {
    setSessionId(crypto.randomUUID());
    setMounted(true);
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Video fade system
  const animateFade = useCallback((element: HTMLVideoElement, targetOpacity: number, duration: number) => {
    const startOpacity = parseFloat(getComputedStyle(element).opacity) || 0;
    const startTime = performance.now();

    cancelAnimationFrame(fadeFrameRef.current);

    const animate = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const currentOpacity = startOpacity + (targetOpacity - startOpacity) * progress;
      element.style.opacity = String(currentOpacity);

      if (progress < 1) {
        fadeFrameRef.current = requestAnimationFrame(animate);
      }
    };

    fadeFrameRef.current = requestAnimationFrame(animate);
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleTimeUpdate = () => {
      const remaining = video.duration - video.currentTime;
      if (remaining <= 0.55 && !fadingOutRef.current) {
        fadingOutRef.current = true;
        animateFade(video, 0, 250);
      }
    };

    const handleEnded = () => {
      video.style.opacity = '0';
      setTimeout(() => {
        video.currentTime = 0;
        video.play();
        fadingOutRef.current = false;
        animateFade(video, 1, 250);
      }, 100);
    };

    const handleLoadedData = () => {
      animateFade(video, 1, 250);
    };

    video.addEventListener('timeupdate', handleTimeUpdate);
    video.addEventListener('ended', handleEnded);
    video.addEventListener('loadeddata', handleLoadedData);

    return () => {
      video.removeEventListener('timeupdate', handleTimeUpdate);
      video.removeEventListener('ended', handleEnded);
      video.removeEventListener('loadeddata', handleLoadedData);
      cancelAnimationFrame(fadeFrameRef.current);
    };
  }, [animateFade]);

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || loading) return;

    const userMessage: Message = { role: 'user', content: input };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setCharCount(0);
    setLoading(true);

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

      if (!response.ok) throw new Error('Request failed');

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let assistantContent = '';

      setMessages(prev => [...prev, { role: 'assistant', content: '' }]);

      while (reader) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              if (data.delta) {
                assistantContent += data.delta;
                setMessages(prev => {
                  const updated = [...prev];
                  updated[updated.length - 1] = { role: 'assistant', content: assistantContent };
                  return updated;
                });
              }
              if (data.done && data.response) {
                setMessages(prev => {
                  const updated = [...prev];
                  updated[updated.length - 1] = { role: 'assistant', content: data.response };
                  return updated;
                });
              }
            } catch {}
          }
        }
      }
    } catch (err) {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Lỗi kết nối đến server.' }]);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setInput(value);
    setCharCount(value.length);
  };

  if (!mounted) return null;

  return (
    <div className="relative min-h-screen overflow-hidden">
      {/* Video Background */}
      <div
        className="absolute inset-0 w-full h-full bg-gradient-to-br from-green-50 via-blue-50 to-purple-50"
        style={{ filter: 'blur(100px)', opacity: 0.6 }}
      />
      <video
        ref={videoRef}
        className="absolute inset-0 w-[115%] h-[115%] object-cover object-top opacity-0 hidden"
        style={{ left: '-7.5%', top: '-7.5%' }}
        autoPlay
        muted
        loop={false}
        playsInline
      >
        <source src="https://stream.mux.com/NcU3HlHeF7CUL86azTTzpy3Tlb00d6iF3BmCdFslMJYM.m3u8" type="video/mp4" />
      </video>

      {/* Content Overlay */}
      <div className="relative z-10 min-h-screen flex flex-col">
        {/* Navigation */}
        <nav className="flex items-center justify-between px-[120px] py-4">
          <div className="flex items-center gap-8">
            <span className="text-2xl font-semibold tracking-[-1.44px]" style={{ fontFamily: 'Schibsted Grotesk, sans-serif' }}>
              Logoipsum
            </span>
            <div className="flex items-center gap-6">
              {['Platform', 'Features', 'Projects', 'Community', 'Contact'].map((item) => (
                <a key={item} href="#" className="text-base font-medium tracking-[-0.2px] hover:opacity-70 flex items-center gap-1" style={{ fontFamily: 'Schibsted Grotesk, sans-serif' }}>
                  {item}
                  {item === 'Features' && (
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M6 9l6 6 6-6" />
                    </svg>
                  )}
                </a>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button className="w-[82px] py-2 text-sm font-medium">Sign Up</button>
            <button className="w-[101px] py-2 bg-black text-white text-sm font-medium rounded-lg">Log In</button>
          </div>
        </nav>

        {/* Hero Content */}
        <div className="flex-1 flex flex-col items-center justify-center -mt-[50px] px-[120px]">
          {/* Badge */}
          <div className="flex items-center gap-2 mb-6">
            <span className="inline-flex items-center gap-1 px-2 py-1 bg-[#0e1311] text-white text-xs rounded-full">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
              </svg>
              New
            </span>
            <span className="px-3 py-1 bg-gray-100 text-sm rounded-full shadow-sm" style={{ fontFamily: 'Inter, sans-serif' }}>
              Discover what's possible
            </span>
          </div>

          {/* Headline */}
          <h1 className="text-[80px] font-bold tracking-[-4.8px] text-center text-black mb-4" style={{ fontFamily: 'Fustat, sans-serif', lineHeight: 1 }}>
            Transform Data Quickly
          </h1>

          {/* Subtitle */}
          <p className="text-xl font-medium tracking-[-0.4px] text-[#505050] text-center max-w-[542px] mb-11" style={{ fontFamily: 'Fustat, sans-serif' }}>
            Upload your information and get powerful insights right away. Work smarter and achieve goals effortlessly.
          </p>

          {/* Search Input Box */}
          <div className="w-full max-w-[728px] p-4 rounded-[18px]" style={{ background: 'rgba(0,0,0,0.24)', backdropFilter: 'blur(10px)' }}>
            {/* Top Row */}
            <div className="flex items-center justify-between mb-3 px-2">
              <div className="flex items-center gap-2">
                <span className="text-xs text-white font-medium" style={{ fontFamily: 'Schibsted Grotesk, sans-serif' }}>
                  {credits}/450 credits
                </span>
                <button className="px-2 py-1 text-xs text-white rounded" style={{ background: 'rgba(90,225,76,0.89)' }}>
                  Upgrade
                </button>
              </div>
              <div className="flex items-center gap-1 text-xs text-white font-medium" style={{ fontFamily: 'Schibsted Grotesk, sans-serif' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z" />
                </svg>
                Powered by GPT-4o
              </div>
            </div>

            {/* Main Input */}
            <form onSubmit={sendMessage} className="bg-white rounded-xl p-3 shadow-lg">
              <div className="flex items-center gap-3">
                <input
                  type="text"
                  value={input}
                  onChange={handleInputChange}
                  placeholder="Type question..."
                  className="flex-1 text-base outline-none"
                  style={{ color: 'rgba(0,0,0,0.6)' }}
                  disabled={loading}
                  maxLength={3000}
                />
                <button
                  type="submit"
                  className="w-9 h-9 bg-black rounded-full flex items-center justify-center text-white disabled:opacity-50"
                  disabled={loading || !input.trim()}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 4l-1.41 1.41L16.17 11H4v2h12.17l-5.58 5.59L12 20l8-8z" />
                  </svg>
                </button>
              </div>

              {/* Bottom Row */}
              <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-100">
                <div className="flex items-center gap-2">
                  <button type="button" className="flex items-center gap-1 px-2 py-1 bg-gray-100 rounded text-xs text-gray-600">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48" />
                    </svg>
                    Attach
                  </button>
                  <button type="button" className="flex items-center gap-1 px-2 py-1 bg-gray-100 rounded text-xs text-gray-600">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z" />
                      <path d="M19 10v2a7 7 0 01-14 0v-2" />
                      <line x1="12" y1="19" x2="12" y2="23" />
                      <line x1="8" y1="23" x2="16" y2="23" />
                    </svg>
                    Voice
                  </button>
                  <button type="button" className="flex items-center gap-1 px-2 py-1 bg-gray-100 rounded text-xs text-gray-600">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="11" cy="11" r="8" />
                      <line x1="21" y1="21" x2="16.65" y2="16.65" />
                    </svg>
                    Prompts
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
                  className={`p-4 rounded-xl ${msg.role === 'user' ? 'bg-black text-white ml-auto' : 'bg-white text-black'}`}
                  style={{ maxWidth: '80%' }}
                >
                  <strong>{msg.role === 'user' ? 'Bạn' : 'AI'}:</strong> {msg.content}
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
