'use client';

import { useCallback, useEffect, useState, type ReactNode } from 'react';
import {
  Settings, Key, Users, Activity, RefreshCw,
  Server, LayoutGrid, X, AlertTriangle, Radio, LogOut,
} from 'lucide-react';

import type { BridgeConfig, ApiKey, Worker, SystemStatus, AdminTab } from './types';
import { safeAdminFetch, readHttpErrorDetail } from './utils';
import TabOverview from './TabOverview';
import TabConfig   from './TabConfig';
import TabKeys     from './TabKeys';
import TabWorkers  from './TabWorkers';
import TabStatus   from './TabStatus';
import LoginPage, { loadSession, clearSession } from './LoginPage';

const BRIDGE_API_URL  = process.env.NEXT_PUBLIC_BRIDGE_API_URL  || 'http://localhost:1122';
const SESSION_KEY = 'ui-bridge-session-token';

/* ── Main page ─────────────────────────────────────────────────────── */
export default function BridgeAdminPage() {
  const [sessionToken, setSessionToken] = useState<string>('');
  const [authChecked, setAuthChecked]   = useState(false);

  // Load session on mount
  useEffect(() => {
    setSessionToken(loadSession());
    setAuthChecked(true);
  }, []);

  const handleLogin = (token: string) => setSessionToken(token);

  const handleLogout = async () => {
    try {
      await fetch(`${BRIDGE_API_URL}/admin/logout`, {
        method: 'POST',
        headers: { 'X-Session-Token': sessionToken },
      });
    } catch { /* ignore */ }
    clearSession();
    setSessionToken('');
  };

  if (!authChecked) return (
    <div className="boot-screen">
      <div className="boot-logo">
        <Server className="h-6 w-6" />
      </div>
      <div className="boot-bars">
        <span /><span /><span />
      </div>
      <p className="boot-label">be-bridge Admin</p>
    </div>
  );
  if (!sessionToken) return <LoginPage onLogin={handleLogin} />;

  return <AdminDashboard sessionToken={sessionToken} onLogout={handleLogout} />;
}

/* ── Dashboard (requires session) ─────────────────────────────────── */
function AdminDashboard({ sessionToken, onLogout }: { sessionToken: string; onLogout: () => void }) {
  const [activeTab, setActiveTab]         = useState<AdminTab>('overview');
  const [config,    setConfig]            = useState<BridgeConfig | null>(null);
  const [apiKeys,   setApiKeys]           = useState<ApiKey[]>([]);
  const [workers,   setWorkers]           = useState<Worker[]>([]);
  const [status,    setStatus]            = useState<SystemStatus | null>(null);
  const [loading,   setLoading]           = useState(true);
  const [refreshing, setRefreshing]       = useState(false);
  const [error,     setError]             = useState<string | null>(null);
  const [success,   setSuccess]           = useState<string | null>(null);
  const [configForm, setConfigForm]       = useState<Partial<BridgeConfig>>({});
  const [browserRunning, setBrowserRunning] = useState(false);
  const [lastSyncAt, setLastSyncAt]       = useState<Date | null>(null);

  // Mutation states
  const [savingConfig,  setSavingConfig]  = useState(false);
  const [creatingKey,   setCreatingKey]   = useState(false);
  const [deletingKeyId, setDeletingKeyId] = useState<string | null>(null);
  const [togglingKeyId, setTogglingKeyId] = useState<string | null>(null);
  const [addingWorker,  setAddingWorker]  = useState(false);
  const [removingWorker, setRemovingWorker] = useState(false);
  const [browserAction, setBrowserAction] = useState<'show' | 'hide' | null>(null);
  const [newKeyName,    setNewKeyName]    = useState('');

  const busy = loading || refreshing || savingConfig || creatingKey ||
    deletingKeyId !== null || togglingKeyId !== null ||
    addingWorker || removingWorker || browserAction !== null;

  const headers = useCallback(() => ({
    'X-Session-Token': sessionToken,
    'Content-Type': 'application/json',
  }), [sessionToken]);

  const flash = (msg: string) => {
    setSuccess(msg);
    setTimeout(() => setSuccess(null), 4000);
  };

  /* ── Fetch all ─────────────────────────────────────────────────── */
  const fetchData = useCallback(async (isInitial = false) => {
    try {
      if (isInitial) setLoading(true); else setRefreshing(true);

      const endpoints = [
        { label: 'config',  url: `${BRIDGE_API_URL}/admin/config`  },
        { label: 'keys',    url: `${BRIDGE_API_URL}/admin/keys`    },
        { label: 'workers', url: `${BRIDGE_API_URL}/admin/workers` },
        { label: 'status',  url: `${BRIDGE_API_URL}/admin/status`  },
        { label: 'browser', url: `${BRIDGE_API_URL}/admin/browser` },
      ];

      const results = await Promise.all(
        endpoints.map(async ({ label, url }) => {
          const { res, networkErr } = await safeAdminFetch(url, headers());
          return { label, res, networkErr };
        })
      );

      if (results.some(r => r.res?.status === 401)) {
        setError('Phiên đăng nhập hết hạn. Đang chuyển về trang đăng nhập…');
        setTimeout(() => onLogout(), 1500);
        return;
      }

      const failures: string[] = [];
      const get = (label: string) => results.find(r => r.label === label);

      const parse = async <T,>(label: string, setter: (v: T) => void, fallback: T) => {
        const r = get(label);
        if (!r) return;
        if (r.networkErr) { failures.push(`${label}: lỗi mạng — ${r.networkErr}`); setter(fallback); return; }
        if (!r.res?.ok) {
          const d = r.res ? await readHttpErrorDetail(r.res.clone()) : '';
          failures.push(`${label}: HTTP ${r.res?.status}${d ? ` — ${d}` : ''}`);
          setter(fallback); return;
        }
        try { setter(await r.res!.json() as T); } catch { failures.push(`${label}: JSON parse error`); setter(fallback); }
      };

      await parse<{ config: BridgeConfig }>('config', d => { setConfig(d.config); setConfigForm(d.config); }, { config: null as unknown as BridgeConfig });
      await parse<{ keys: ApiKey[] }>('keys', d => setApiKeys(d.keys ?? []), { keys: [] });
      await parse<{ workers: Worker[] }>('workers', d => setWorkers(d.workers ?? []), { workers: [] });
      await parse<SystemStatus>('status', d => setStatus(d), null as unknown as SystemStatus);
      await parse<{ running: boolean }>('browser', d => setBrowserRunning(Boolean(d.running)), { running: false });

      setError(failures.length ? failures.map(f => `• ${f}`).join('\n') : null);
      if (results.some(r => r.res?.ok)) setLastSyncAt(new Date());
    } catch (e) {
      setError(`Lỗi không mong đợi: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      if (isInitial) setLoading(false);
      setRefreshing(false);
    }
  }, [sessionToken, headers, onLogout]);

  useEffect(() => {
    void fetchData(true);
    const id = setInterval(() => void fetchData(false), 10000);
    return () => clearInterval(id);
  }, [fetchData]);

  /* ── Mutations ─────────────────────────────────────────────────── */
  const handleSaveConfig = async () => {
    setSavingConfig(true); setError(null);
    try {
      const res = await fetch(`${BRIDGE_API_URL}/admin/config`, { method: 'PUT', headers: headers(), body: JSON.stringify(configForm) });
      if (res.ok) { flash('Cấu hình đã được lưu vào .env be-bridge.'); void fetchData(false); }
      else { const e = await res.json().catch(() => ({})); setError(`Lưu thất bại: ${(e as {error?:string}).error || res.statusText}`); }
    } catch { setError('Không thể lưu cấu hình (lỗi mạng).'); }
    finally { setSavingConfig(false); }
  };

  const handleCreateKey = async () => {
    if (!newKeyName.trim()) { setError('Vui lòng nhập tên cho key.'); return; }
    setCreatingKey(true); setError(null);
    try {
      const res = await fetch(`${BRIDGE_API_URL}/admin/keys`, { method: 'POST', headers: headers(), body: JSON.stringify({ name: newKeyName }) });
      if (res.ok) {
        const data = await res.json();
        setApiKeys(prev => [...prev, data.key]);
        setNewKeyName('');
        flash('API key mới đã được tạo. Sao chép và lưu an toàn ngay.');
      } else { const e = await res.json().catch(() => ({})); setError((e as {error?:string}).error || `Tạo key thất bại (${res.status})`); }
    } catch { setError('Không thể tạo API key (lỗi mạng).'); }
    finally { setCreatingKey(false); }
  };

  const handleDeleteKey = async (id: string) => {
    if (!confirm('Xóa API key này?')) return;
    setDeletingKeyId(id); setError(null);
    try {
      const res = await fetch(`${BRIDGE_API_URL}/admin/keys/${id}`, { method: 'DELETE', headers: headers() });
      if (res.ok) { setApiKeys(prev => prev.filter(k => k.id !== id)); flash('API key đã được xóa.'); }
      else { const e = await res.json().catch(() => ({})); setError((e as {error?:string}).error || `Xóa thất bại (${res.status})`); }
    } catch { setError('Không thể xóa API key (lỗi mạng).'); }
    finally { setDeletingKeyId(null); }
  };

  const handleToggleKey = async (id: string, active: boolean) => {
    setTogglingKeyId(id); setError(null);
    try {
      const res = await fetch(`${BRIDGE_API_URL}/admin/keys/${id}`, { method: 'PUT', headers: headers(), body: JSON.stringify({ active: !active }) });
      if (res.ok) { flash(active ? 'Đã vô hiệu hóa key.' : 'Đã kích hoạt key.'); void fetchData(false); }
      else { const e = await res.json().catch(() => ({})); setError((e as {error?:string}).error || `Cập nhật thất bại (${res.status})`); }
    } catch { setError('Không thể cập nhật trạng thái key (lỗi mạng).'); }
    finally { setTogglingKeyId(null); }
  };

  const handleBrowserAction = async (action: 'show' | 'hide') => {
    setBrowserAction(action); setError(null);
    try {
      const res = await fetch(`${BRIDGE_API_URL}/admin/browser`, { method: 'POST', headers: headers(), body: JSON.stringify({ action }) });
      if (res.ok) { flash(action === 'show' ? 'Đã gửi lệnh hiện cửa sổ ChatGPT.' : 'Đã gửi lệnh ẩn cửa sổ ChatGPT.'); void fetchData(false); }
      else { const e = await res.json().catch(() => ({})); setError((e as {error?:string}).error || `Thao tác thất bại (${res.status})`); }
    } catch { setError('Không thể thực hiện thao tác browser (lỗi mạng).'); }
    finally { setBrowserAction(null); }
  };

  const handleAddWorker = async () => {
    setAddingWorker(true); setError(null);
    try {
      const res = await fetch(`${BRIDGE_API_URL}/admin/workers`, { method: 'POST', headers: headers(), body: JSON.stringify({ count: 1 }) });
      if (res.ok) { flash('Đã thêm slot worker.'); void fetchData(false); }
      else { const e = await res.json().catch(() => ({})); setError((e as {error?:string}).error || `Thêm worker thất bại (${res.status})`); }
    } catch { setError('Không thể thêm worker (lỗi mạng).'); }
    finally { setAddingWorker(false); }
  };

  const handleRemoveWorker = async () => {
    setRemovingWorker(true); setError(null);
    try {
      const res = await fetch(`${BRIDGE_API_URL}/admin/workers`, { method: 'DELETE', headers: headers(), body: JSON.stringify({ count: 1 }) });
      if (res.ok) { flash('Đã gỡ một slot worker rảnh.'); void fetchData(false); }
      else { const e = await res.json().catch(() => ({})); setError((e as {error?:string}).error || `Gỡ worker thất bại (${res.status})`); }
    } catch { setError('Không thể gỡ worker (lỗi mạng).'); }
    finally { setRemovingWorker(false); }
  };

  /* ── Nav ───────────────────────────────────────────────────────── */
  const navItems: { id: AdminTab; label: string; icon: ReactNode }[] = [
    { id: 'overview', label: 'Tổng quan', icon: <LayoutGrid className="h-4 w-4 shrink-0" /> },
    { id: 'config',   label: 'Cấu hình',  icon: <Settings   className="h-4 w-4 shrink-0" /> },
    { id: 'keys',     label: 'API Keys',  icon: <Key        className="h-4 w-4 shrink-0" /> },
    { id: 'workers',  label: 'Workers',   icon: <Users      className="h-4 w-4 shrink-0" /> },
    { id: 'status',   label: 'Giám sát',  icon: <Activity   className="h-4 w-4 shrink-0" /> },
  ];

  /* ── Render ────────────────────────────────────────────────────── */
  return (
    <>
      {/* Top progress */}
      <div className="admin-progress" data-active={busy ? 'true' : 'false'} role="progressbar" aria-hidden={!busy} aria-busy={busy} />

      <div className="admin-shell">
        {/* Sidebar */}
        <aside className="admin-sidebar hidden lg:flex" style={{ width: 'var(--sidebar-w)' }}>
          {/* Logo */}
          <div className="flex items-center gap-2.5 px-4 py-5" style={{ borderBottom: '1px solid var(--c-border)' }}>
            <span className="flex h-8 w-8 items-center justify-center rounded-lg text-white" style={{ background: 'var(--c-accent)' }}>
              <Server className="h-4 w-4" />
            </span>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: 'var(--c-text-3)' }}>Console</p>
              <p className="text-sm font-bold" style={{ color: 'var(--c-text)' }}>be-bridge</p>
            </div>
          </div>

          {/* Nav */}
          <nav className="flex-1 px-3 py-4 space-y-0.5" aria-label="Điều hướng chính">
            {navItems.map(item => (
              <button
                key={item.id}
                type="button"
                className="admin-nav-btn"
                data-active={activeTab === item.id}
                aria-current={activeTab === item.id ? 'page' : undefined}
                onClick={() => setActiveTab(item.id)}
              >
                {item.icon}
                {item.label}
              </button>
            ))}
          </nav>

          {/* Footer */}
          <div className="px-4 py-4 text-xs" style={{ color: 'var(--c-text-4)', borderTop: '1px solid var(--c-border)' }}>
            {lastSyncAt && (
              <p>Đồng bộ: <time dateTime={lastSyncAt.toISOString()}>{lastSyncAt.toLocaleTimeString('vi-VN')}</time></p>
            )}
            <p className="mt-0.5 font-mono" style={{ fontSize: 10 }}>{BRIDGE_API_URL}</p>
          </div>
        </aside>

        {/* Main */}
        <div className="flex flex-1 flex-col min-w-0">
          {/* Header */}
          <header className="sticky top-0 z-40 flex items-center justify-between gap-4 px-5 py-3"
            style={{ background: 'rgba(255,255,255,0.92)', borderBottom: '1px solid var(--c-border)', backdropFilter: 'blur(8px)' }}>
            <div className="flex items-center gap-3">
              {/* Mobile nav */}
              <div className="flex gap-1 lg:hidden overflow-x-auto">
                {navItems.map(item => (
                  <button key={item.id} type="button"
                    className="admin-nav-btn shrink-0 px-2.5 py-2"
                    data-active={activeTab === item.id}
                    onClick={() => setActiveTab(item.id)}
                  >
                    {item.icon}
                    <span className="hidden sm:inline">{item.label}</span>
                  </button>
                ))}
              </div>
              <div className="hidden lg:block">
                <h1 className="text-base font-bold" style={{ color: 'var(--c-text)' }}>Quản trị vận hành</h1>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {lastSyncAt && (
                <span className="hidden md:inline text-xs" style={{ color: 'var(--c-text-4)' }}>
                  {lastSyncAt.toLocaleTimeString('vi-VN')}
                </span>
              )}
              <button type="button" className="admin-btn-secondary text-xs px-3 py-2"
                onClick={() => void fetchData(false)} disabled={refreshing} aria-busy={refreshing}>
                <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />
                <span className="hidden sm:inline">Đồng bộ</span>
              </button>
              <button type="button" className="admin-btn-ghost text-xs px-3 py-2" onClick={onLogout} title="Đăng xuất">
                <LogOut className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Đăng xuất</span>
              </button>
            </div>
          </header>

          <div className="flex-1 overflow-auto">
            <div style={{ maxWidth: '960px', margin: '0 auto', padding: '24px 20px' }} className="space-y-5">
            {/* Alerts */}
            <div role="region" aria-label="Thông báo hệ thống" aria-live="polite" className="space-y-2">
              {error && (
                <div role="alert" className="admin-alert-error">
                  <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-xs uppercase tracking-wide mb-1">Có lỗi</p>
                    <p className="whitespace-pre-wrap break-words text-sm">{error}</p>
                  </div>
                  <button className="admin-icon-btn shrink-0" aria-label="Đóng" onClick={() => setError(null)}>
                    <X className="h-4 w-4" />
                  </button>
                </div>
              )}
              {success && (
                <div role="status" className="admin-alert-success">
                  <Radio className="h-4 w-4 shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-xs uppercase tracking-wide mb-1">Thành công</p>
                    <p className="text-sm">{success}</p>
                  </div>
                  <button className="admin-icon-btn shrink-0" aria-label="Đóng" onClick={() => setSuccess(null)}>
                    <X className="h-4 w-4" />
                  </button>
                </div>
              )}
            </div>

            {/* Tab content */}
            <div className="admin-card p-6 min-h-[400px]">
              {activeTab === 'overview' && (
                <TabOverview
                  workers={workers} apiKeys={apiKeys} status={status}
                  browserRunning={browserRunning} loading={loading}
                  onRefresh={() => void fetchData(false)}
                />
              )}
              {activeTab === 'config' && (
                <TabConfig
                  config={config} configForm={configForm} saving={savingConfig}
                  onFormChange={patch => setConfigForm(prev => ({ ...prev, ...patch }))}
                  onSave={handleSaveConfig}
                  onRefresh={() => void fetchData(false)}
                />
              )}
              {activeTab === 'keys' && (
                <TabKeys
                  apiKeys={apiKeys} creating={creatingKey}
                  deletingId={deletingKeyId} togglingId={togglingKeyId}
                  newKeyName={newKeyName} onNewKeyNameChange={setNewKeyName}
                  onCreate={handleCreateKey} onDelete={handleDeleteKey} onToggle={handleToggleKey}
                />
              )}
              {activeTab === 'workers' && (
                <TabWorkers
                  workers={workers} browserRunning={browserRunning}
                  addingWorker={addingWorker} removingWorker={removingWorker}
                  browserAction={browserAction}
                  onAdd={handleAddWorker} onRemove={handleRemoveWorker}
                  onShowBrowser={() => void handleBrowserAction('show')}
                  onHideBrowser={() => void handleBrowserAction('hide')}
                />
              )}
              {activeTab === 'status' && (
                <TabStatus status={status} onRefresh={() => void fetchData(false)} />
              )}
            </div>
            </div>
          </div>

          <footer className="px-5 py-3 text-center text-xs" style={{ color: 'var(--c-text-4)', borderTop: '1px solid var(--c-border)' }}>
            be-bridge Admin · <span className="font-mono">{BRIDGE_API_URL}</span>
          </footer>
        </div>
      </div>
    </>
  );
}
