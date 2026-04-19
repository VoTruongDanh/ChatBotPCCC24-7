'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import Link from 'next/link';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8888';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  status?: 'streaming' | 'done' | 'error';
  id: string;
}
type ConnectionStatus = 'checking' | 'connected' | 'disconnected';

/* ══════════════════════════════════════════════
   CANVAS PARTICLE SYSTEM
══════════════════════════════════════════════ */
function ParticleCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let W = canvas.width = window.innerWidth;
    let H = canvas.height = window.innerHeight;
    let mouseX = W / 2, mouseY = H / 2;
    let raf: number;

    interface Particle {
      x: number; y: number; vx: number; vy: number;
      size: number; opacity: number; hue: number; life: number; maxLife: number;
    }
    const particles: Particle[] = [];

    const spawn = (mx?: number, my?: number) => {
      const x = mx ?? Math.random() * W;
      const y = my ?? Math.random() * H;
      const angle = Math.random() * Math.PI * 2;
      const speed = 0.2 + Math.random() * 0.6;
      particles.push({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 0.4,
        size: 1.5 + Math.random() * 2.5,
        opacity: 0,
        hue: 10 + Math.random() * 30,
        life: 0,
        maxLife: 120 + Math.random() * 180,
      });
    };

    for (let i = 0; i < 80; i++) spawn();

    const onMouse = (e: MouseEvent) => { mouseX = e.clientX; mouseY = e.clientY; };
    window.addEventListener('mousemove', onMouse);
    const onResize = () => { W = canvas.width = window.innerWidth; H = canvas.height = window.innerHeight; };
    window.addEventListener('resize', onResize);

    let frame = 0;
    const loop = () => {
      frame++;
      ctx.clearRect(0, 0, W, H);

      // Orb glow near mouse
      const gr = ctx.createRadialGradient(mouseX, mouseY, 0, mouseX, mouseY, 300);
      gr.addColorStop(0, 'rgba(220,60,30,0.06)');
      gr.addColorStop(1, 'rgba(220,60,30,0)');
      ctx.fillStyle = gr;
      ctx.fillRect(0, 0, W, H);

      if (frame % 4 === 0) spawn();
      if (frame % 60 === 0) spawn(mouseX + (Math.random() - 0.5) * 80, mouseY + (Math.random() - 0.5) * 80);

      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.life++;
        const t = p.life / p.maxLife;
        p.opacity = t < 0.15 ? t / 0.15 : t > 0.7 ? 1 - (t - 0.7) / 0.3 : 1;
        p.x += p.vx;
        p.y += p.vy;
        p.vy -= 0.003;

        ctx.save();
        ctx.globalAlpha = p.opacity * 0.7;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        const saturation = 80 + Math.random() * 20;
        ctx.fillStyle = `hsl(${p.hue},${saturation}%,60%)`;
        ctx.shadowBlur = 8;
        ctx.shadowColor = `hsl(${p.hue},100%,50%)`;
        ctx.fill();
        ctx.restore();

        if (p.life >= p.maxLife || p.y < -20) particles.splice(i, 1);
      }

      // Floating grid lines
      ctx.strokeStyle = 'rgba(220,60,30,0.04)';
      ctx.lineWidth = 0.5;
      const spacing = 80;
      const offsetX = (frame * 0.2) % spacing;
      const offsetY = (frame * 0.1) % spacing;
      for (let x = -offsetX; x < W; x += spacing) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
      }
      for (let y = -offsetY; y < H; y += spacing) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
      }

      raf = requestAnimationFrame(loop);
    };
    loop();
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('mousemove', onMouse);
      window.removeEventListener('resize', onResize);
    };
  }, []);
  return <canvas ref={canvasRef} style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 0 }} />;
}

/* ══════════════════════════════════════════════
   MAGNETIC BUTTON HOOK
══════════════════════════════════════════════ */
function useMagnetic(strength = 0.35) {
  const ref = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const onMove = (e: MouseEvent) => {
      const r = el.getBoundingClientRect();
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;
      const dx = e.clientX - cx;
      const dy = e.clientY - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const zone = Math.max(r.width, r.height) * 1.5;
      if (dist < zone) {
        el.style.transform = `translate(${dx * strength}px,${dy * strength}px) scale(1.06)`;
      }
    };
    const onLeave = () => { el.style.transform = 'translate(0,0) scale(1)'; };
    document.addEventListener('mousemove', onMove);
    el.addEventListener('mouseleave', onLeave);
    return () => { document.removeEventListener('mousemove', onMove); el.removeEventListener('mouseleave', onLeave); };
  }, [strength]);
  return ref;
}

/* ══════════════════════════════════════════════
   SCRAMBLE TEXT HOOK
══════════════════════════════════════════════ */
function useScramble(text: string, delay = 0) {
  const [display, setDisplay] = useState('');
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%';
  useEffect(() => {
    let frame = 0;
    let raf: number;
    const timeout = setTimeout(() => {
      const run = () => {
        setDisplay(text.split('').map((c, i) => {
          if (c === ' ') return ' ';
          if (i < frame / 2) return c;
          return chars[Math.floor(Math.random() * chars.length)];
        }).join(''));
        frame++;
        if (frame < text.length * 2 + 10) raf = requestAnimationFrame(run);
        else setDisplay(text);
      };
      run();
    }, delay);
    return () => { clearTimeout(timeout); cancelAnimationFrame(raf); };
  }, [text]);
  return display;
}

/* ══════════════════════════════════════════════
   RIPPLE EFFECT
══════════════════════════════════════════════ */
function useRipple() {
  const ref = useRef<HTMLButtonElement>(null);
  const trigger = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const r = document.createElement('span');
    r.style.cssText = `
      position:absolute;width:4px;height:4px;border-radius:50%;
      background:rgba(255,255,255,0.6);transform:scale(0);
      top:50%;left:50%;margin:-2px 0 0 -2px;
      animation:ripple 0.6s ease-out forwards;pointer-events:none;
    `;
    el.appendChild(r);
    setTimeout(() => r.remove(), 700);
  }, []);
  return { ref, trigger };
}

/* ══════════════════════════════════════════════
   TYPING INDICATOR
══════════════════════════════════════════════ */
function TypingDots() {
  return (
    <span className="pccc-typing">
      {[0, 1, 2].map(i => <span key={i} className="pccc-dot" style={{ animationDelay: `${i * 0.18}s` }} />)}
    </span>
  );
}

/* ══════════════════════════════════════════════
   MESSAGE BUBBLE
══════════════════════════════════════════════ */
function Bubble({ msg, index }: { msg: Message; index: number }) {
  const isUser = msg.role === 'user';
  const isError = msg.status === 'error';
  const ref = useRef<HTMLDivElement>(null);

  // 3D tilt on hover
  useEffect(() => {
    const el = ref.current;
    if (!el || isUser) return;
    const onMove = (e: MouseEvent) => {
      const r = el.getBoundingClientRect();
      const x = ((e.clientX - r.left) / r.width - 0.5) * 10;
      const y = ((e.clientY - r.top) / r.height - 0.5) * -10;
      el.style.transform = `perspective(600px) rotateX(${y}deg) rotateY(${x}deg) translateZ(4px)`;
    };
    const onLeave = () => { el.style.transform = 'perspective(600px) rotateX(0) rotateY(0) translateZ(0)'; };
    el.addEventListener('mousemove', onMove);
    el.addEventListener('mouseleave', onLeave);
    return () => { el.removeEventListener('mousemove', onMove); el.removeEventListener('mouseleave', onLeave); };
  }, [isUser]);

  return (
    <div
      className={`pccc-msg ${isUser ? 'pccc-msg-user' : 'pccc-msg-ai'}`}
      style={{ animationDelay: `${Math.min(index * 0.04, 0.25)}s` }}
    >
      {!isUser && (
        <div className={`pccc-avatar ${isError ? 'pccc-avatar-err' : ''}`}>
          <svg width="16" height="16" viewBox="0 0 28 28" fill="none">
            <path d="M14 2C14 2 8 8 8 14C8 17.3 10.7 20 14 20C17.3 20 20 17.3 20 14C20 11 18 9 18 9C18 9 17 12 15 13C15 13 16 10 14 7C14 7 13 10 11 11C11 11 12 7 14 2Z" fill="url(#fg1)" />
            <path d="M14 23C11.2 23 9 20.8 9 18C9 16.4 9.8 15 11 14.2C11.2 15.1 11.8 15.9 12.6 16.3C12.3 15.7 12 15 12 14.2C12 12.4 13.3 11 14 9.5C14.7 11 16 12.4 16 14.2C16 15 15.7 15.7 15.4 16.3C16.2 15.9 16.8 15.1 17 14.2C18.2 15 19 16.4 19 18C19 20.8 16.8 23 14 23Z" fill="url(#fg2)" />
            <defs>
              <linearGradient id="fg1" x1="14" y1="2" x2="14" y2="20" gradientUnits="userSpaceOnUse">
                <stop stopColor="#FF6B35"/><stop offset="1" stopColor="#DC2626"/>
              </linearGradient>
              <linearGradient id="fg2" x1="14" y1="9.5" x2="14" y2="23" gradientUnits="userSpaceOnUse">
                <stop stopColor="#FBBF24"/><stop offset="1" stopColor="#EF4444"/>
              </linearGradient>
            </defs>
          </svg>
          <div className="pccc-avatar-ring" />
        </div>
      )}
      <div
        ref={ref}
        className={`pccc-bubble ${isUser ? 'pccc-bubble-user' : isError ? 'pccc-bubble-err' : 'pccc-bubble-ai'}`}
        style={{ transition: 'transform 0.12s ease-out' }}
      >
        <div className="pccc-bubble-meta">
          <span className="pccc-sender">{isUser ? 'Bạn' : isError ? 'Lỗi' : 'Trợ lý PCCC'}</span>
          {msg.status === 'streaming' && (
            <span className="pccc-badge pccc-badge-stream"><TypingDots /><span>Đang soạn</span></span>
          )}
          {msg.status === 'done' && !isUser && (
            <span className="pccc-badge pccc-badge-done">
              <svg width="9" height="9" viewBox="0 0 24 24" fill="currentColor"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>
              Xong
            </span>
          )}
        </div>
        <p className="pccc-text">
          {msg.content || (msg.status === 'streaming' ? '' : '')}
          {msg.status === 'streaming' && <span className="pccc-cursor">▋</span>}
        </p>
      </div>
      {isUser && (
        <div className="pccc-avatar pccc-avatar-user">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
          </svg>
        </div>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════
   INPUT COMPONENT
══════════════════════════════════════════════ */
function ChatInput({ input, loading, connectionStatus, onSubmit, onChange }: {
  input: string;
  loading: boolean;
  connectionStatus: ConnectionStatus;
  onSubmit: (e: React.FormEvent) => void;
  onChange: (v: string) => void;
}) {
  const [focused, setFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const canSend = input.trim() && !loading && connectionStatus === 'connected';
  const { ref: sendRef, trigger: ripple } = useRipple();
  const magRef = useMagnetic(0.25);

  const handleSubmit = (e: React.FormEvent) => {
    ripple();
    onSubmit(e);
    // Keep focus on input after submit
    setTimeout(() => {
      inputRef.current?.focus();
    }, 50);
  };

  return (
    <div className={`pccc-input-shell ${focused ? 'pccc-input-focused' : ''}`}>
      <div className="pccc-input-top">
        <div className="pccc-input-brand">
          <div className="pccc-pulse-dot" />
          <span>Trợ lý AI PCCC</span>
        </div>
        {loading && (
          <div className="pccc-thinking">
            <TypingDots />
            <span>Đang suy nghĩ...</span>
          </div>
        )}
      </div>
      <form onSubmit={handleSubmit} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <input
          ref={inputRef}
          className="pccc-field"
          type="text"
          value={input}
          onChange={e => onChange(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder={connectionStatus === 'connected' ? 'Hỏi về quy định PCCC, hồ sơ, nghiệm thu...' : 'Đang chờ kết nối...'}
          disabled={loading || connectionStatus !== 'connected'}
          maxLength={3000}
        />
        <button
          ref={el => { (sendRef as any).current = el; (magRef as any).current = el; }}
          type="submit"
          disabled={!canSend}
          className={`pccc-send ${loading ? 'pccc-send-loading' : canSend ? 'pccc-send-active' : 'pccc-send-idle'}`}
          style={{ position: 'relative', overflow: 'hidden', transition: 'transform 0.3s cubic-bezier(0.34,1.56,0.64,1)' }}
        >
          <style>{`@keyframes ripple{to{transform:scale(40);opacity:0}}`}</style>
          {loading ? (
            <svg className="pccc-spin" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
              <circle cx="12" cy="12" r="10" strokeOpacity="0.25"/><path d="M12 2a10 10 0 0 1 10 10" strokeLinecap="round"/>
            </svg>
          ) : (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="white">
              <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
            </svg>
          )}
        </button>
      </form>
      <div className="pccc-input-footer">
        <div className="pccc-input-actions">
          <button type="button" className="pccc-action-chip">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48"/>
            </svg>
            Đính kèm
          </button>
          <button type="button" className="pccc-action-chip">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z"/><path d="M19 10v2a7 7 0 01-14 0v-2"/>
              <line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/>
            </svg>
            Giọng nói
          </button>
        </div>
        <span className="pccc-char">{input.length}/3,000</span>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════
   MAIN PAGE
══════════════════════════════════════════════ */
export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [sessionId, setSessionId] = useState('');
  const [mounted, setMounted] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('checking');
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [toastType, setToastType] = useState<'success' | 'error'>('success');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const title1 = useScramble('Tư Vấn PCCC', 300);
  const title2 = useScramble('Thông Minh', 900);

  useEffect(() => { 
    setSessionId(crypto.randomUUID()); 
    setMounted(true);
    // Detect system theme
    const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    setTheme(isDark ? 'dark' : 'light');
    document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
  }, []);

  const toggleTheme = () => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
    document.documentElement.setAttribute('data-theme', newTheme);
  };

  const showToastMessage = (message: string, type: 'success' | 'error') => {
    setToastMessage(message);
    setToastType(type);
    setShowToast(true);
    setTimeout(() => setShowToast(false), 3000);
  };

  useEffect(() => {
    const check = async () => {
      try {
        const r = await fetch(`${API_URL}/health`);
        setConnectionStatus(r.ok ? 'connected' : 'disconnected');
      } catch { setConnectionStatus('disconnected'); }
    };
    check();
    const t = setInterval(check, 10000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || loading || connectionStatus !== 'connected') return;
    const msgId = crypto.randomUUID();
    const userMsg: Message = { role: 'user', content: input, status: 'done', id: crypto.randomUUID() };
    setMessages(prev => [...prev, userMsg]);
    const savedInput = input;
    setInput('');
    setLoading(true);
    setMessages(prev => [...prev, { role: 'assistant', content: '', status: 'streaming', id: msgId }]);
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      
      const response = await fetch(`${API_URL}/api/chat/stream`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ prompt: savedInput, messages: [...messages, userMsg], sessionId }),
      });
      if (!response.ok) throw new Error(`Server error: ${response.status}`);
      if (!response.body) throw new Error('No response body');
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let ac = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        for (const line of lines) {
          const t = line.trim();
          if (!t?.startsWith('data: ')) continue;
          try {
            const data = JSON.parse(t.slice(6));
            if (data.error) throw new Error(data.error);
            if (data.delta) {
              ac += data.delta;
              setMessages(prev => prev.map(m => m.id === msgId ? { ...m, content: ac } : m));
            }
            if (data.done && data.response) {
              setMessages(prev => prev.map(m => m.id === msgId ? { ...m, content: data.response, status: 'done' } : m));
              return;
            }
          } catch (err) { if (err instanceof SyntaxError) continue; throw err; }
        }
      }
      setMessages(prev => prev.map(m =>
        m.id === msgId ? ac.trim()
          ? { ...m, content: ac, status: 'done' }
          : { ...m, content: '⚠️ Không nhận được phản hồi. Vui lòng thử lại.', status: 'error' }
        : m
      ));
    } catch (err) {
      const msg = err instanceof Error ? `❌ Lỗi: ${err.message}` : '❌ Không thể kết nối server.';
      setMessages(prev => prev.map(m => m.id === msgId ? { ...m, content: msg, status: 'error' } : m));
    } finally { setLoading(false); }
  }, [input, loading, connectionStatus, messages, sessionId]);

  if (!mounted) return null;

  const suggestions = ['Quy định sprinkler', 'Hồ sơ nghiệm thu', 'Khoảng cách báo khói', 'Thoát hiểm cao tầng', 'Bình CO₂'];

  return (
    <>
      <style>{`
        /* ── Google Font ── */
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&family=Instrument+Serif:ital@0;1&display=swap');

        /* ── Theme Tokens (light default + dark override) ── */
        :root, :root[data-theme="light"] {
          --r: #dc2626; --r2: #ef4444; --ember: #f97316; --gold: #fbbf24;
          --bg: #fafafa; --bg2: #f5f5f5; --bg3: #eeeeee;
          --surface: rgba(255,255,255,0.9); --surface2: rgba(255,255,255,0.7);
          --border: rgba(0,0,0,0.1); --border2: rgba(0,0,0,0.16);
          --text: #0f172a; --text2: #475569; --text3: #94a3b8;
          --shadow: 0 4px 24px rgba(0,0,0,0.1);
          --shadow-lg: 0 12px 48px rgba(0,0,0,0.15);
          --orb1: rgba(220,38,38,0.12); --orb2: rgba(249,115,22,0.08);
          --nav-bg: rgba(255,255,255,0.9);
          --input-bg: rgba(255,255,255,0.98);
          --bubble-ai-bg: rgba(255,255,255,0.98);
          --bubble-ai-border: rgba(0,0,0,0.1);
          --chip-bg: rgba(255,255,255,0.8);
          --chip-hover-bg: rgba(220,38,38,0.08);
        }
        :root[data-theme="dark"] {
          --bg: #050301; --bg2: #0d0805; --bg3: #160f0a;
          --surface: rgba(20,10,6,0.9); --surface2: rgba(15,8,4,0.75);
          --border: rgba(255,255,255,0.1); --border2: rgba(255,255,255,0.18);
          --text: #fef3e2; --text2: rgba(254,243,226,0.75); --text3: rgba(254,243,226,0.5);
          --shadow: 0 4px 24px rgba(0,0,0,0.6); --shadow-lg: 0 12px 48px rgba(0,0,0,0.8);
          --orb1: rgba(220,38,38,0.25); --orb2: rgba(249,115,22,0.18);
          --nav-bg: rgba(5,3,1,0.9);
          --input-bg: rgba(13,8,5,0.95);
          --bubble-ai-bg: rgba(20,10,6,0.95);
          --bubble-ai-border: rgba(255,255,255,0.1);
          --chip-bg: rgba(20,10,6,0.8);
          --chip-hover-bg: rgba(220,38,38,0.2);
        }
        @media (prefers-color-scheme: dark) {
          :root:not([data-theme]) {
            --bg: #050301; --bg2: #0d0805; --bg3: #160f0a;
            --surface: rgba(20,10,6,0.9); --surface2: rgba(15,8,4,0.75);
            --border: rgba(255,255,255,0.1); --border2: rgba(255,255,255,0.18);
            --text: #fef3e2; --text2: rgba(254,243,226,0.75); --text3: rgba(254,243,226,0.5);
            --shadow: 0 4px 24px rgba(0,0,0,0.6); --shadow-lg: 0 12px 48px rgba(0,0,0,0.8);
            --orb1: rgba(220,38,38,0.25); --orb2: rgba(249,115,22,0.18);
            --nav-bg: rgba(5,3,1,0.9);
            --input-bg: rgba(13,8,5,0.95);
            --bubble-ai-bg: rgba(20,10,6,0.95);
            --bubble-ai-border: rgba(255,255,255,0.1);
            --chip-bg: rgba(20,10,6,0.8);
            --chip-hover-bg: rgba(220,38,38,0.2);
          }
        }

        /* ── Base ── */
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        .pccc-page {
          position: relative; height: 100vh; overflow: hidden;
          display: flex; flex-direction: column;
          background: var(--bg);
          font-family: 'Plus Jakarta Sans', sans-serif;
          color: var(--text);
        }

        /* ── Background ── */
        .pccc-bg {
          position: absolute; inset: 0; pointer-events: none; z-index: 0; overflow: hidden;
        }
        .pccc-orb {
          position: absolute; border-radius: 50%;
          filter: blur(80px); pointer-events: none;
        }
        .pccc-orb-1 {
          width: 600px; height: 600px; bottom: -100px; left: -100px;
          background: radial-gradient(circle, var(--orb1), transparent 70%);
          animation: orbFloat1 12s ease-in-out infinite alternate;
        }
        .pccc-orb-2 {
          width: 400px; height: 400px; top: 10%; right: -80px;
          background: radial-gradient(circle, var(--orb2), transparent 70%);
          animation: orbFloat2 9s ease-in-out infinite alternate;
        }
        .pccc-orb-3 {
          width: 300px; height: 300px; top: 40%; left: 40%;
          background: radial-gradient(circle, rgba(251,191,36,0.06), transparent 70%);
          animation: orbFloat3 15s ease-in-out infinite alternate;
        }
        @keyframes orbFloat1 {
          0%{transform:translate(0,0) scale(1)} 100%{transform:translate(60px,-40px) scale(1.15)}
        }
        @keyframes orbFloat2 {
          0%{transform:translate(0,0) scale(1)} 100%{transform:translate(-40px,60px) scale(1.1)}
        }
        @keyframes orbFloat3 {
          0%{transform:translate(0,0)} 100%{transform:translate(-50px,30px)}
        }

        /* ── Nav ── */
        .pccc-nav {
          position: relative; z-index: 50; flex-shrink: 0;
          display: flex; align-items: center; justify-content: space-between;
          padding: 0 48px; height: 64px;
          background: var(--nav-bg);
          border-bottom: 1px solid var(--border);
          backdrop-filter: blur(24px); -webkit-backdrop-filter: blur(24px);
          animation: slideDown 0.5s cubic-bezier(0.16,1,0.3,1) both;
        }
        @keyframes slideDown { from{transform:translateY(-100%);opacity:0} to{transform:translateY(0);opacity:1} }
        .pccc-nav-left { display: flex; align-items: center; gap: 40px; }
        .pccc-brand { display: flex; align-items: center; gap: 10px; text-decoration: none; }
        .pccc-brand-text {
          font-size: 19px; font-weight: 800; letter-spacing: -0.5px;
          background: linear-gradient(135deg, var(--r) 0%, var(--ember) 100%);
          -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;
        }
        .pccc-nav-links { display: flex; align-items: center; gap: 2px; }
        .pccc-nav-link {
          padding: 6px 14px; font-size: 14px; font-weight: 500;
          color: var(--text2); text-decoration: none; border-radius: 8px;
          transition: color 0.2s, background 0.2s;
        }
        .pccc-nav-link:hover { color: var(--text); background: var(--border); }
        .pccc-nav-disabled {
          cursor: not-allowed; opacity: 0.4;
        }
        .pccc-nav-disabled:hover { color: var(--text2); background: transparent; }
        .pccc-nav-right { display: flex; align-items: center; gap: 10px; }

        /* ── Status Badge ── */
        .pccc-status {
          display: flex; align-items: center; gap: 7px;
          padding: 5px 13px; border-radius: 100px; font-size: 12px; font-weight: 600;
          letter-spacing: 0.2px;
        }
        .pccc-status-dot { width: 7px; height: 7px; border-radius: 50%; flex-shrink: 0; }
        .pccc-s-check { background: var(--border); border: 1px solid var(--border2); color: var(--text2); }
        .pccc-s-check .pccc-status-dot { background: var(--text3); animation: dotPulse 1.5s infinite; }
        .pccc-s-on { background: rgba(16,185,129,0.1); border: 1px solid rgba(16,185,129,0.25); color: #059669; }
        @media (prefers-color-scheme: dark) { .pccc-s-on { color: #6ee7b7; } }
        .pccc-s-on .pccc-status-dot { background: #10b981; animation: pingGreen 1.5s infinite; }
        .pccc-s-off { background: rgba(220,38,38,0.08); border: 1px solid rgba(220,38,38,0.25); color: #dc2626; animation: flashRed 2s infinite; }
        @media (prefers-color-scheme: dark) { .pccc-s-off { color: #fca5a5; } }
        .pccc-s-off .pccc-status-dot { background: var(--r2); animation: dotPulse 0.8s infinite; }
        @keyframes dotPulse { 0%,100%{opacity:1} 50%{opacity:0.3} }
        @keyframes pingGreen { 0%,100%{box-shadow:0 0 0 0 rgba(16,185,129,0.5)} 50%{box-shadow:0 0 0 5px rgba(16,185,129,0)} }
        @keyframes flashRed { 0%,100%{border-color:rgba(220,38,38,0.25)} 50%{border-color:rgba(220,38,38,0.5)} }

        /* ── Nav Buttons ── */
        .pccc-btn-ghost {
          padding: 7px 16px; background: transparent; border: 1px solid var(--border2);
          border-radius: 8px; color: var(--text2); font-size: 13px; font-weight: 600;
          cursor: pointer; font-family: inherit; transition: all 0.2s;
        }
        .pccc-btn-ghost:hover { color: var(--text); background: var(--border); }
        .pccc-btn-primary {
          padding: 7px 18px;
          background: linear-gradient(135deg, var(--r), var(--ember));
          border: none; border-radius: 8px; color: #fff;
          font-size: 13px; font-weight: 700; cursor: pointer;
          font-family: inherit; transition: all 0.25s;
          box-shadow: 0 4px 16px rgba(220,38,38,0.3);
        }
        .pccc-btn-primary:hover { transform: translateY(-1px); box-shadow: 0 8px 24px rgba(220,38,38,0.45); }
        .pccc-btn-primary:active { transform: scale(0.97); }
        
        /* ── Theme Toggle ── */
        .pccc-theme-toggle {
          width: 36px; height: 36px; border-radius: 8px;
          background: var(--border); border: 1px solid var(--border2);
          display: flex; align-items: center; justify-content: center;
          cursor: pointer; transition: all 0.2s;
        }
        .pccc-theme-toggle:hover { background: var(--border2); transform: scale(1.05); }
        .pccc-theme-toggle svg { width: 18px; height: 18px; color: var(--text2); transition: transform 0.3s; }
        .pccc-theme-toggle:hover svg { transform: rotate(20deg); }

        /* ── Content ── */
        .pccc-content {
          position: relative; z-index: 10; flex: 1;
          display: flex; flex-direction: column; overflow: hidden;
        }

        /* ── Hero ── */
        .pccc-hero {
          flex: 1; display: flex; flex-direction: column;
          align-items: center; justify-content: center; padding: 40px 24px;
        }
        .pccc-hero-badge {
          display: inline-flex; align-items: center; gap: 8px;
          padding: 6px 14px 6px 8px; margin-bottom: 28px;
          background: rgba(220,38,38,0.08); border: 1px solid rgba(220,38,38,0.2);
          border-radius: 100px; font-size: 12px; font-weight: 600;
          color: var(--r); letter-spacing: 0.3px;
          animation: popIn 0.5s cubic-bezier(0.34,1.56,0.64,1) 0.3s both;
        }
        .pccc-hero-badge-icon {
          width: 22px; height: 22px; border-radius: 50%;
          background: linear-gradient(135deg, var(--r), var(--ember));
          display: flex; align-items: center; justify-content: center;
        }
        @keyframes popIn { from{transform:scale(0.7);opacity:0} to{transform:scale(1);opacity:1} }

        .pccc-hero-title {
          font-family: 'Plus Jakarta Sans', sans-serif;
          font-size: clamp(44px, 9vw, 96px);
          font-weight: 800;
          line-height: 0.93;
          letter-spacing: -3px;
          text-align: center;
          margin-bottom: 22px;
          animation: titleUp 0.9s cubic-bezier(0.16,1,0.3,1) 0.1s both;
        }
        @keyframes titleUp { from{opacity:0;transform:translateY(50px) skewY(3deg)} to{opacity:1;transform:translateY(0)} }
        .pccc-title-plain { display: block; color: var(--text); }
        .pccc-title-fire {
          display: block;
          background: linear-gradient(135deg, var(--ember) 0%, var(--gold) 35%, var(--r2) 70%, var(--ember) 100%);
          background-size: 300% 300%;
          -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;
          animation: fireGrad 4s ease-in-out infinite;
        }
        @keyframes fireGrad { 0%,100%{background-position:0% 50%} 50%{background-position:100% 50%} }

        .pccc-hero-sub {
          max-width: 480px; text-align: center;
          font-size: 16px; font-weight: 400; line-height: 1.7;
          color: var(--text2); margin-bottom: 36px;
          animation: titleUp 0.8s cubic-bezier(0.16,1,0.3,1) 0.35s both;
        }

        /* ── Suggestion chips ── */
        .pccc-chips {
          display: flex; flex-wrap: wrap; gap: 8px; justify-content: center;
          margin-bottom: 32px;
          animation: titleUp 0.8s cubic-bezier(0.16,1,0.3,1) 0.5s both;
        }
        .pccc-chip {
          padding: 9px 18px; border-radius: 100px; font-size: 13px; font-weight: 500;
          color: var(--text2); cursor: pointer; font-family: inherit;
          background: var(--chip-bg); border: 1px solid var(--border);
          transition: all 0.28s cubic-bezier(0.34,1.56,0.64,1);
          backdrop-filter: blur(8px);
        }
        .pccc-chip:hover {
          color: var(--r); border-color: rgba(220,38,38,0.35);
          background: var(--chip-hover-bg);
          transform: translateY(-3px) scale(1.04);
          box-shadow: 0 8px 20px rgba(220,38,38,0.15);
        }
        .pccc-chip:active { transform: scale(0.96); }

        /* ── Input Shell ── */
        .pccc-hero-input { width: 100%; max-width: 720px; animation: titleUp 0.8s cubic-bezier(0.16,1,0.3,1) 0.6s both; }

        .pccc-input-shell {
          background: var(--input-bg);
          border-radius: 20px; padding: 14px 14px 10px;
          border: 1px solid var(--border2);
          backdrop-filter: blur(20px);
          box-shadow: var(--shadow);
          transition: box-shadow 0.3s, border-color 0.3s;
          position: relative;
        }
        .pccc-input-focused {
          box-shadow: 0 0 0 2px rgba(220,38,38,0.25), var(--shadow-lg);
          border-color: rgba(220,38,38,0.4);
        }

        .pccc-input-top { display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px; padding: 0 4px; }
        .pccc-input-brand { display: flex; align-items: center; gap: 8px; font-size: 12px; font-weight: 600; color: var(--text3); }
        .pccc-pulse-dot {
          width: 7px; height: 7px; border-radius: 50%;
          background: linear-gradient(135deg, var(--r), var(--ember));
          animation: dotPulse 2s ease-in-out infinite;
        }
        .pccc-thinking { display: flex; align-items: center; gap: 8px; font-size: 12px; font-weight: 600; color: #3b82f6; }
        @media (prefers-color-scheme: dark) { .pccc-thinking { color: #93c5fd; } }

        .pccc-field {
          flex: 1; background: transparent; border: none; outline: none;
          font-size: 15px; font-family: inherit;
          font-weight: 500; caret-color: var(--ember); letter-spacing: -0.2px;
          min-width: 0;
        }
        :root[data-theme="light"] .pccc-field, :root:not([data-theme]) .pccc-field {
          color: #1f2937;
        }
        :root[data-theme="light"] .pccc-field::placeholder, :root:not([data-theme]) .pccc-field::placeholder {
          color: #9ca3af;
        }
        :root[data-theme="dark"] .pccc-field {
          color: #fef3e2;
        }
        :root[data-theme="dark"] .pccc-field::placeholder {
          color: rgba(254,243,226,0.5);
        }
        @media (prefers-color-scheme: dark) {
          :root:not([data-theme]) .pccc-field { color: #fef3e2; }
          :root:not([data-theme]) .pccc-field::placeholder { color: rgba(254,243,226,0.5); }
        }
        .pccc-field:disabled { cursor: not-allowed; opacity: 0.5; }

        /* ── Send Button ── */
        .pccc-send {
          width: 44px; height: 44px; border-radius: 13px; border: none;
          display: flex; align-items: center; justify-content: center;
          cursor: pointer; flex-shrink: 0;
          position: relative;
        }
        .pccc-send-active {
          background: linear-gradient(135deg, var(--r) 0%, var(--ember) 100%);
          box-shadow: 0 4px 20px rgba(220,38,38,0.45);
          animation: bellPulse 2s ease-in-out infinite;
        }
        .pccc-send-active::before {
          content: ''; position: absolute; inset: -3px; border-radius: 16px;
          background: conic-gradient(from var(--angle,0deg), var(--r), var(--ember), var(--gold), var(--r2), var(--r));
          opacity: 0.6; filter: blur(8px); z-index: -1;
          animation: spinHalo 3s linear infinite;
        }
        @property --angle { syntax: '<angle>'; inherits: false; initial-value: 0deg; }
        @keyframes spinHalo { to { --angle: 360deg; } }
        @keyframes bellPulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.05); }
        }
        .pccc-send-active:hover { 
          box-shadow: 0 8px 32px rgba(220,38,38,0.65);
          animation: bellRing 0.5s ease-in-out;
        }
        @keyframes bellRing {
          0%, 100% { transform: rotate(0deg) scale(1); }
          25% { transform: rotate(-10deg) scale(1.1); }
          75% { transform: rotate(10deg) scale(1.1); }
        }
        .pccc-send-active:active { transform: scale(0.9) !important; }
        .pccc-send-idle { background: var(--border); cursor: not-allowed; opacity: 0.5; }
        .pccc-send-loading { 
          background: linear-gradient(135deg, #1d4ed8, #3b82f6); 
          box-shadow: 0 4px 20px rgba(59,130,246,0.4);
        }

        .pccc-input-footer { display: flex; align-items: center; justify-content: space-between; margin-top: 10px; padding-top: 10px; border-top: 1px solid var(--border); }
        .pccc-input-actions { display: flex; gap: 6px; }
        .pccc-action-chip {
          display: flex; align-items: center; gap: 5px; padding: 5px 10px;
          background: transparent; border: 1px solid var(--border);
          border-radius: 7px; color: var(--text3); font-size: 12px;
          cursor: pointer; font-family: inherit; transition: all 0.2s;
        }
        .pccc-action-chip:hover { color: var(--text2); border-color: var(--border2); background: var(--border); }
        .pccc-char { font-size: 11px; color: var(--text3); }

        /* ── Chat Area ── */
        .pccc-chat {
          flex: 1; overflow-y: auto; padding: 28px 24px 12px;
          scrollbar-width: thin; scrollbar-color: var(--border2) transparent;
        }
        .pccc-chat::-webkit-scrollbar { width: 4px; }
        .pccc-chat::-webkit-scrollbar-thumb { background: var(--border2); border-radius: 2px; }
        .pccc-msgs { max-width: 720px; margin: 0 auto; display: flex; flex-direction: column; gap: 18px; }

        /* ── Message ── */
        .pccc-msg {
          display: flex; align-items: flex-start; gap: 11px;
          animation: msgSpring 0.55s cubic-bezier(0.34,1.56,0.64,1) both;
        }
        @keyframes msgSpring { from{opacity:0;transform:translateY(24px) scale(0.94)} to{opacity:1;transform:translateY(0) scale(1)} }
        .pccc-msg-user { flex-direction: row-reverse; }
        .pccc-avatar {
          width: 36px; height: 36px; border-radius: 11px; flex-shrink: 0;
          display: flex; align-items: center; justify-content: center;
          background: rgba(220,38,38,0.1); border: 1px solid rgba(220,38,38,0.2);
          position: relative;
        }
        .pccc-avatar-user { background: var(--border); border-color: var(--border2); color: var(--text2); }
        .pccc-avatar-err { background: rgba(220,38,38,0.1); border-color: rgba(220,38,38,0.3); color: var(--r2); }
        .pccc-avatar-ring {
          position: absolute; inset: -3px; border-radius: 14px;
          border: 1px solid rgba(220,38,38,0.3);
          animation: ringPulse 2.4s ease-in-out infinite;
        }
        @keyframes ringPulse { 0%,100%{opacity:0.5;transform:scale(1)} 50%{opacity:0;transform:scale(1.18)} }

        .pccc-bubble {
          max-width: 74%; padding: 13px 16px 11px; border-radius: 16px;
          position: relative;
        }
        .pccc-bubble-ai {
          background: var(--bubble-ai-bg); border: 1px solid var(--bubble-ai-border);
          box-shadow: var(--shadow); backdrop-filter: blur(12px);
        }
        .pccc-bubble-ai::before {
          content: ''; position: absolute; top: 0; left: 0; right: 0; height: 1px;
          border-radius: 16px 16px 0 0;
          background: linear-gradient(90deg, transparent, rgba(220,38,38,0.2), transparent);
        }
        .pccc-bubble-user {
          background: linear-gradient(135deg, var(--r) 0%, #b91c1c 100%);
          box-shadow: 0 8px 28px rgba(220,38,38,0.35);
          border: 1px solid rgba(255,255,255,0.1);
        }
        .pccc-bubble-err {
          background: rgba(220,38,38,0.06); border: 1px solid rgba(220,38,38,0.2);
        }

        .pccc-bubble-meta { display: flex; align-items: center; gap: 8px; margin-bottom: 6px; }
        .pccc-sender { font-size: 10px; font-weight: 700; color: var(--text3); letter-spacing: 0.6px; text-transform: uppercase; }
        .pccc-bubble-user .pccc-sender { color: rgba(255,255,255,0.6); }

        .pccc-badge {
          display: flex; align-items: center; gap: 5px;
          padding: 2px 8px; border-radius: 100px; font-size: 10px; font-weight: 600;
        }
        .pccc-badge-stream { background: rgba(59,130,246,0.1); border: 1px solid rgba(59,130,246,0.2); color: #3b82f6; }
        @media (prefers-color-scheme: dark) { .pccc-badge-stream { color: #93c5fd; } }
        .pccc-badge-done { background: rgba(16,185,129,0.1); border: 1px solid rgba(16,185,129,0.2); color: #059669; }
        @media (prefers-color-scheme: dark) { .pccc-badge-done { color: #6ee7b7; } }

        .pccc-text {
          font-size: 14.5px; line-height: 1.66; color: var(--text);
          white-space: pre-wrap; word-break: break-word; letter-spacing: -0.1px;
        }
        .pccc-bubble-user .pccc-text { color: #fff; }

        /* ── Cursor blink ── */
        .pccc-cursor { color: var(--ember); animation: blink 0.7s steps(1) infinite; margin-left: 1px; }
        @keyframes blink { 0%,100%{opacity:1} 50%{opacity:0} }

        /* ── Typing dots ── */
        .pccc-typing { display: flex; align-items: center; gap: 3px; }
        .pccc-dot {
          width: 4px; height: 4px; border-radius: 50%; background: currentColor;
          animation: dotBounce 0.9s ease-in-out infinite;
        }
        @keyframes dotBounce { 0%,80%,100%{transform:scale(0.6);opacity:0.4} 40%{transform:scale(1.1);opacity:1} }

        /* ── Spin ── */
        .pccc-spin { animation: spinAnim 0.75s linear infinite; }
        @keyframes spinAnim { to { transform: rotate(360deg); } }

        /* ── Bottom input bar ── */
        .pccc-bottom { flex-shrink: 0; padding: 10px 24px 20px; }
        .pccc-bottom-inner { max-width: 720px; margin: 0 auto; }

        /* ── Responsive ── */
        @media (max-width: 640px) {
          .pccc-nav { padding: 0 20px; }
          .pccc-nav-links { display: none; }
          .pccc-chat { padding: 16px 16px 8px; }
          .pccc-bottom { padding: 8px 16px 16px; }
          .pccc-hero { padding: 24px 16px; }
          .pccc-btn-ghost { display: none; }
        }

        /* ══════════════════════════════════════════════
           SETTINGS MODAL
        ══════════════════════════════════════════════ */
        .pccc-modal-overlay {
          position: fixed; inset: 0; z-index: 100;
          background: rgba(0,0,0,0.6); backdrop-filter: blur(8px);
          display: flex; align-items: center; justify-content: center;
          padding: 24px;
          animation: fadeIn 0.2s ease-out;
        }
        @keyframes fadeIn { from{opacity:0} to{opacity:1} }
        
        .pccc-modal {
          background: var(--surface); border: 1px solid var(--border2);
          border-radius: 20px; box-shadow: var(--shadow-lg);
          width: 100%; max-width: 520px;
          animation: modalSlide 0.3s cubic-bezier(0.34,1.56,0.64,1);
        }
        @keyframes modalSlide { from{opacity:0;transform:translateY(40px) scale(0.95)} to{opacity:1;transform:translateY(0) scale(1)} }
        
        .pccc-modal-header {
          padding: 24px 24px 20px; border-bottom: 1px solid var(--border);
          display: flex; align-items: center; justify-content: space-between;
        }
        .pccc-modal-title {
          font-size: 19px; font-weight: 800; color: var(--text);
          letter-spacing: -0.5px;
        }
        .pccc-modal-close {
          width: 32px; height: 32px; border-radius: 8px;
          background: transparent; border: 1px solid var(--border);
          display: flex; align-items: center; justify-content: center;
          cursor: pointer; transition: all 0.2s; color: var(--text2);
        }
        .pccc-modal-close:hover {
          background: var(--border); color: var(--text);
        }
        
        .pccc-modal-body {
          padding: 24px; display: flex; flex-direction: column; gap: 24px;
        }
        
        .pccc-section {
          display: flex; flex-direction: column; gap: 10px;
        }
        .pccc-label {
          font-size: 12px; font-weight: 700; color: var(--text2);
          letter-spacing: 0.5px; text-transform: uppercase;
        }
        .pccc-input-group {
          position: relative; display: flex; align-items: center;
        }
        .pccc-input {
          flex: 1; padding: 12px 44px 12px 14px;
          background: var(--bg2); border: 1px solid var(--border2);
          border-radius: 10px; font-size: 14px; font-weight: 500;
          color: var(--text); font-family: 'Plus Jakarta Sans', monospace;
          transition: all 0.2s; outline: none;
        }
        .pccc-input:focus {
          border-color: rgba(220,38,38,0.4);
          box-shadow: 0 0 0 3px rgba(220,38,38,0.1);
        }
        .pccc-input:disabled {
          opacity: 0.5; cursor: not-allowed;
        }
        .pccc-input::placeholder {
          color: var(--text3);
        }
        .pccc-toggle-key {
          position: absolute; right: 8px;
          width: 32px; height: 32px; border-radius: 6px;
          background: transparent; border: none;
          display: flex; align-items: center; justify-content: center;
          cursor: pointer; color: var(--text3);
          transition: all 0.2s;
        }
        .pccc-toggle-key:hover {
          background: var(--border); color: var(--text2);
        }
        .pccc-helper {
          font-size: 12px; color: var(--text3); line-height: 1.5;
        }
        
        .pccc-status-card {
          padding: 14px 16px; border-radius: 12px;
          display: flex; align-items: center; gap: 12px;
          border: 1px solid var(--border2);
        }
        .pccc-status-card.idle {
          background: var(--bg2);
        }
        .pccc-status-card.testing {
          background: rgba(59,130,246,0.08); border-color: rgba(59,130,246,0.2);
        }
        .pccc-status-card.success {
          background: rgba(16,185,129,0.08); border-color: rgba(16,185,129,0.2);
        }
        .pccc-status-card.error {
          background: rgba(220,38,38,0.06); border-color: rgba(220,38,38,0.2);
        }
        .pccc-status-icon {
          width: 36px; height: 36px; border-radius: 8px;
          display: flex; align-items: center; justify-content: center;
          flex-shrink: 0;
        }
        .pccc-status-card.idle .pccc-status-icon {
          background: var(--border);
        }
        .pccc-status-card.testing .pccc-status-icon {
          background: rgba(59,130,246,0.15);
        }
        .pccc-status-card.success .pccc-status-icon {
          background: rgba(16,185,129,0.15);
        }
        .pccc-status-card.error .pccc-status-icon {
          background: rgba(220,38,38,0.12);
        }
        .pccc-status-text {
          flex: 1; display: flex; flex-direction: column; gap: 2px;
        }
        .pccc-status-label {
          font-size: 13px; font-weight: 600; color: var(--text);
        }
        .pccc-status-desc {
          font-size: 12px; color: var(--text3);
        }
        .pccc-status-card.error .pccc-status-desc {
          color: var(--r2);
        }
        
        .pccc-modal-footer {
          padding: 20px 24px 24px; border-top: 1px solid var(--border);
          display: flex; gap: 10px; justify-content: flex-end;
        }
        .pccc-btn {
          padding: 10px 20px; border-radius: 10px;
          font-size: 14px; font-weight: 600; font-family: inherit;
          cursor: pointer; transition: all 0.2s;
          display: flex; align-items: center; gap: 8px;
          border: none; outline: none;
        }
        .pccc-btn:disabled {
          opacity: 0.5; cursor: not-allowed;
        }
        .pccc-btn-secondary {
          background: var(--bg2); color: var(--text2);
          border: 1px solid var(--border2);
        }
        .pccc-btn-secondary:hover:not(:disabled) {
          background: var(--border); color: var(--text);
        }
        .pccc-btn-primary-modal {
          background: linear-gradient(135deg, var(--r), var(--ember));
          color: #fff; box-shadow: 0 4px 16px rgba(220,38,38,0.3);
        }
        .pccc-btn-primary-modal:hover:not(:disabled) {
          box-shadow: 0 6px 20px rgba(220,38,38,0.45);
          transform: translateY(-1px);
        }
        .pccc-btn-primary-modal:active:not(:disabled) {
          transform: scale(0.97);
        }
        
        /* ── Toast ── */
        .pccc-toast {
          position: fixed; bottom: 24px; right: 24px; z-index: 200;
          padding: 14px 18px; border-radius: 12px;
          display: flex; align-items: center; gap: 10px;
          box-shadow: var(--shadow-lg);
          animation: toastSlide 0.3s cubic-bezier(0.34,1.56,0.64,1);
          font-size: 14px; font-weight: 600;
        }
        @keyframes toastSlide { from{opacity:0;transform:translateX(100px)} to{opacity:1;transform:translateX(0)} }
        .pccc-toast.success {
          background: rgba(16,185,129,0.95); color: #fff;
          border: 1px solid rgba(255,255,255,0.2);
        }
        .pccc-toast.error {
          background: rgba(220,38,38,0.95); color: #fff;
          border: 1px solid rgba(255,255,255,0.2);
        }
        .pccc-toast-icon {
          width: 20px; height: 20px; flex-shrink: 0;
        }
        
        /* ── Settings Button in Nav ── */
        .pccc-btn-settings {
          width: 36px; height: 36px; border-radius: 8px;
          background: var(--border); border: 1px solid var(--border2);
          display: flex; align-items: center; justify-content: center;
          cursor: pointer; transition: all 0.2s; color: var(--text2);
        }
        .pccc-btn-settings:hover {
          background: var(--border2); color: var(--text);
          transform: rotate(45deg);
        }
      `}</style>

      <div className="pccc-page">
        {/* Background */}
        <div className="pccc-bg">
          <div className="pccc-orb pccc-orb-1" />
          <div className="pccc-orb pccc-orb-2" />
          <div className="pccc-orb pccc-orb-3" />
          <ParticleCanvas />
        </div>

        {/* Nav */}
        <nav className="pccc-nav">
          <div className="pccc-nav-left">
            <Link href="/" className="pccc-brand">
              <svg width="26" height="26" viewBox="0 0 28 28" fill="none">
                <path d="M14 2C14 2 8 8 8 14C8 17.3 10.7 20 14 20C17.3 20 20 17.3 20 14C20 11 18 9 18 9C18 9 17 12 15 13C15 13 16 10 14 7C14 7 13 10 11 11C11 11 12 7 14 2Z" fill="url(#nb1)"/>
                <path d="M14 23C11.2 23 9 20.8 9 18C9 16.4 9.8 15 11 14.2C11.2 15.1 11.8 15.9 12.6 16.3C12.3 15.7 12 15 12 14.2C12 12.4 13.3 11 14 9.5C14.7 11 16 12.4 16 14.2C16 15 15.7 15.7 15.4 16.3C16.2 15.9 16.8 15.1 17 14.2C18.2 15 19 16.4 19 18C19 20.8 16.8 23 14 23Z" fill="url(#nb2)"/>
                <defs>
                  <linearGradient id="nb1" x1="14" y1="2" x2="14" y2="20" gradientUnits="userSpaceOnUse"><stop stopColor="#FF6B35"/><stop offset="1" stopColor="#DC2626"/></linearGradient>
                  <linearGradient id="nb2" x1="14" y1="9.5" x2="14" y2="23" gradientUnits="userSpaceOnUse"><stop stopColor="#FBBF24"/><stop offset="1" stopColor="#EF4444"/></linearGradient>
                </defs>
              </svg>
              <span className="pccc-brand-text">PCCC Consult</span>
            </Link>
            <div className="pccc-nav-links">
              <Link href="/dich-vu" className="pccc-nav-link">Dịch vụ</Link>
              <span className="pccc-nav-link pccc-nav-disabled" title="Sắp ra mắt">Quy định</span>
              <span className="pccc-nav-link pccc-nav-disabled" title="Sắp ra mắt">Hồ sơ</span>
              <span className="pccc-nav-link pccc-nav-disabled" title="Sắp ra mắt">Liên hệ</span>
            </div>
          </div>
          <div className="pccc-nav-right">
            {connectionStatus === 'checking' && (
              <span className="pccc-status pccc-s-check">
                <svg className="pccc-spin" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                  <circle cx="12" cy="12" r="10" strokeOpacity="0.25"/><path d="M12 2a10 10 0 0 1 10 10" strokeLinecap="round"/>
                </svg>
                Đang kết nối
              </span>
            )}
            {connectionStatus === 'connected' && (
              <span className="pccc-status pccc-s-on">
                <span className="pccc-status-dot" />Sẵn sàng
              </span>
            )}
            {connectionStatus === 'disconnected' && (
              <span className="pccc-status pccc-s-off">
                <span className="pccc-status-dot" />Mất kết nối
              </span>
            )}
            <button className="pccc-theme-toggle" onClick={toggleTheme} title={theme === 'light' ? 'Chuyển sang chế độ tối' : 'Chuyển sang chế độ sáng'}>
              {theme === 'light' ? (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
                </svg>
              ) : (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/>
                  <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
                  <line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/>
                  <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
                </svg>
              )}
            </button>
            <button className="pccc-btn-ghost">Đăng ký</button>
            <button className="pccc-btn-primary">Đăng nhập</button>
          </div>
        </nav>

        {/* Content */}
        <div className="pccc-content">
          {messages.length === 0 ? (
            /* ── HERO ── */
            <div className="pccc-hero">
              <div className="pccc-hero-badge">
                <div className="pccc-hero-badge-icon">
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="white"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
                </div>
                AI thế hệ mới · Miễn phí
              </div>
              <h1 className="pccc-hero-title">
                <span className="pccc-title-plain">{title1}</span>
                <span className="pccc-title-fire">{title2}</span>
              </h1>
              <p className="pccc-hero-sub">
                Hỏi đáp về quy định phòng cháy chữa cháy, hồ sơ thiết kế, nghiệm thu và mọi vấn đề PCCC — được hỗ trợ bởi AI tiên tiến.
              </p>
              <div className="pccc-chips">
                {suggestions.map(q => (
                  <button key={q} className="pccc-chip" onClick={() => setInput(q)}>{q}</button>
                ))}
              </div>
              <div className="pccc-hero-input">
                <ChatInput input={input} loading={loading} connectionStatus={connectionStatus} onSubmit={sendMessage} onChange={setInput} />
              </div>
            </div>
          ) : (
            /* ── CHAT ── */
            <>
              <div className="pccc-chat">
                <div className="pccc-msgs">
                  {messages.map((msg, i) => <Bubble key={msg.id} msg={msg} index={i} />)}
                  <div ref={messagesEndRef} />
                </div>
              </div>
              <div className="pccc-bottom">
                <div className="pccc-bottom-inner">
                  <ChatInput input={input} loading={loading} connectionStatus={connectionStatus} onSubmit={sendMessage} onChange={setInput} />
                </div>
              </div>
            </>
          )}
        </div>

        {/* Settings Modal */}
        {/* Toast Notification */}
        {showToast && (
          <div className={`pccc-toast ${toastType}`}>
            <svg className="pccc-toast-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              {toastType === 'success' ? (
                <polyline points="20 6 9 17 4 12"/>
              ) : (
                <><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></>
              )}
            </svg>
            {toastMessage}
          </div>
        )}
      </div>
    </>
  );
}









