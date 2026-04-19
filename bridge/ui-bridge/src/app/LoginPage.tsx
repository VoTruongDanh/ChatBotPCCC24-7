'use client';
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Server, Eye, EyeOff, Loader2, AlertTriangle, ShieldCheck } from 'lucide-react';

const BRIDGE_API_URL = process.env.NEXT_PUBLIC_BRIDGE_API_URL || 'http://localhost:1110';
const SESSION_KEY = 'ui-bridge-session-token';

export function saveSession(token: string) {
  try { sessionStorage.setItem(SESSION_KEY, token); } catch { /* ignore */ }
}
export function loadSession(): string {
  try { return sessionStorage.getItem(SESSION_KEY) ?? ''; } catch { return ''; }
}
export function clearSession() {
  try { sessionStorage.removeItem(SESSION_KEY); } catch { /* ignore */ }
}

interface Props { onLogin: (token: string) => void; }

const features = ['Worker pool management', 'API key lifecycle', 'Real-time monitoring'];

/* Floating orbs for brand panel */
const orbs = [
  { w: 320, h: 320, x: '-10%', y: '-15%', delay: 0,   dur: 7  },
  { w: 240, h: 240, x: '55%',  y: '50%',  delay: 1.5, dur: 9  },
  { w: 180, h: 180, x: '20%',  y: '65%',  delay: 0.8, dur: 11 },
];

export default function LoginPage({ onLogin }: Props) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPw,   setShowPw]   = useState(false);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState<string | null>(null);
  const [success,  setSuccess]  = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password) { setError('Vui lòng nhập đầy đủ thông tin.'); return; }
    setLoading(true); setError(null);
    try {
      const res = await fetch(`${BRIDGE_API_URL}/admin/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username.trim(), password }),
      });
      const data = await res.json().catch(() => ({})) as { token?: string; error?: string };
      if (res.ok && data.token) {
        setSuccess(true);
        saveSession(data.token);
        setTimeout(() => onLogin(data.token!), 600);
      } else {
        setError(data.error ?? `Đăng nhập thất bại (${res.status})`);
      }
    } catch (err) {
      setError(`Không thể kết nối be-bridge: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-shell">

      {/* ── Brand panel ── */}
      <div className="login-brand">
        {/* Animated orbs */}
        {orbs.map((o, i) => (
          <motion.div key={i}
            className="login-orb"
            style={{ width: o.w, height: o.h, left: o.x, top: o.y }}
            animate={{ scale: [1, 1.15, 1], opacity: [0.35, 0.55, 0.35] }}
            transition={{ duration: o.dur, delay: o.delay, repeat: Infinity, ease: 'easeInOut' }}
          />
        ))}

        {/* Dot grid */}
        <div className="login-brand-grid" />

        <div className="relative z-10 flex flex-col justify-between h-full p-10">
          {/* Logo */}
          <motion.div className="flex items-center gap-3"
            initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, ease: 'easeOut' }}>
            <span className="login-logo-icon"><Server className="h-5 w-5" /></span>
            <span className="text-white font-bold tracking-tight text-sm">API Chatbot</span>
          </motion.div>

          {/* Headline */}
          <div>
            <motion.p className="text-4xl font-extrabold text-white leading-tight tracking-tight"
              initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.15, ease: 'easeOut' }}>
              API<br />Chatbot<br />Admin
            </motion.p>

            <motion.p className="mt-4 text-sm text-white/55 max-w-xs leading-relaxed"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              transition={{ duration: 0.6, delay: 0.35 }}>
              Quản trị toàn bộ hệ thống Puppeteer bridge — workers, keys, config và giám sát realtime.
            </motion.p>

            <div className="mt-8 flex flex-col gap-3">
              {features.map((f, i) => (
                <motion.div key={f} className="flex items-center gap-3"
                  initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.5, delay: 0.5 + i * 0.1 }}>
                  <span className="login-feature-dot" />
                  <span className="text-xs text-white/65">{f}</span>
                </motion.div>
              ))}
            </div>
          </div>

          <motion.p className="text-xs text-white/25 font-mono"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1 }}>
            {BRIDGE_API_URL}
          </motion.p>
        </div>
      </div>

      {/* ── Form panel ── */}
      <div className="login-form-panel">
        <motion.div className="w-full max-w-[400px]"
          initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}>

          {/* Header */}
          <motion.div className="mb-7"
            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}>
            <div className="flex items-center gap-2.5 mb-5">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl text-white"
                style={{ background: 'var(--c-accent)' }}>
                <Server className="h-4 w-4" />
              </span>
              <span className="text-sm font-bold" style={{ color: 'var(--c-text)' }}>API Chatbot Admin</span>
            </div>
            <p className="text-2xl font-bold" style={{ color: 'var(--c-text)' }}>Chào mừng trở lại</p>
            <p className="text-sm mt-1" style={{ color: 'var(--c-text-3)' }}>
              Đăng nhập để quản trị hệ thống
            </p>
          </motion.div>

          {/* Card */}
          <div className="admin-card p-6">
            <AnimatePresence mode="wait">
              {success ? (
                <motion.div key="success"
                  className="flex flex-col items-center gap-4 py-8"
                  initial={{ opacity: 0, scale: 0.85 }} animate={{ opacity: 1, scale: 1 }}
                  transition={{ type: 'spring', stiffness: 260, damping: 20 }}>
                  <motion.div className="login-success-icon"
                    initial={{ scale: 0 }} animate={{ scale: 1 }}
                    transition={{ type: 'spring', stiffness: 300, damping: 18, delay: 0.1 }}>
                    <ShieldCheck className="h-8 w-8" style={{ color: 'var(--c-success)' }} />
                  </motion.div>
                  <p className="text-sm font-semibold" style={{ color: 'var(--c-text)' }}>Xác thực thành công</p>
                  <p className="text-xs" style={{ color: 'var(--c-text-3)' }}>Đang chuyển hướng…</p>
                </motion.div>
              ) : (
                <motion.form key="form" onSubmit={handleSubmit} noValidate className="space-y-4"
                  initial={{ opacity: 1 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.2 }}>

                  <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>
                    <label htmlFor="username" className="admin-label">Tên đăng nhập</label>
                    <input id="username" type="text" autoComplete="username" autoFocus
                      className="admin-input" value={username}
                      onChange={e => { setUsername(e.target.value); setError(null); }}
                      disabled={loading} />
                  </motion.div>

                  <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.32 }}>
                    <label htmlFor="password" className="admin-label">Mật khẩu</label>
                    <div className="flex gap-2">
                      <input id="password" type={showPw ? 'text' : 'password'}
                        autoComplete="current-password"
                        className="admin-input flex-1" value={password}
                        onChange={e => { setPassword(e.target.value); setError(null); }}
                        disabled={loading} placeholder="" />
                      <button type="button" className="admin-icon-btn shrink-0"
                        style={{ border: '1px solid var(--c-border)' }}
                        onClick={() => setShowPw(v => !v)} tabIndex={-1}>
                        {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </motion.div>

                  <AnimatePresence>
                    {error && (
                      <motion.div role="alert" className="admin-alert-error text-xs"
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.22 }}>
                        <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                        <span>{error}</span>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <motion.button type="submit"
                    className="admin-btn-primary w-full justify-center"
                    style={{ paddingTop: '11px', paddingBottom: '11px' }}
                    disabled={loading} aria-busy={loading}
                    initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.4 }}
                    whileHover={{ scale: loading ? 1 : 1.015 }}
                    whileTap={{ scale: loading ? 1 : 0.975 }}>
                    {loading
                      ? <><Loader2 className="h-4 w-4 animate-spin" /> Đang xác thực…</>
                      : 'Đăng nhập'}
                  </motion.button>
                </motion.form>
              )}
            </AnimatePresence>
          </div>

          <motion.p className="mt-5 text-xs text-center" style={{ color: 'var(--c-text-4)' }}
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6 }}>
            Cấu hình tài khoản trong <code className="admin-mono">bridge/.env</code>
          </motion.p>
        </motion.div>
      </div>
    </div>
  );
}

