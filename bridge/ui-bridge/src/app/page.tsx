'use client';

import { useCallback, useEffect, useState, type ReactNode } from 'react';
import {
  Settings,
  Key,
  Users,
  Activity,
  RefreshCw,
  Plus,
  Trash2,
  Eye,
  EyeOff,
  Save,
  Server,
  Cpu,
  Shield,
  Globe,
  Monitor,
  LayoutGrid,
  Loader2,
  X,
  AlertTriangle,
  Inbox,
  Radio
} from 'lucide-react';

const BRIDGE_API_URL = process.env.NEXT_PUBLIC_BRIDGE_API_URL || 'http://localhost:1122';
const BRIDGE_ENV_ADMIN =
  process.env.NEXT_PUBLIC_ADMIN_API_KEY || 'bridge_admin_default_key';
const ADMIN_KEY_STORAGE = 'ui-bridge-admin-api-key';

function readStoredAdminKey(): string {
  if (typeof window === 'undefined') return '';
  try {
    return localStorage.getItem(ADMIN_KEY_STORAGE) ?? '';
  } catch {
    return '';
  }
}

/** Fetch không nuốt lỗi — trả về response hoặc lỗi mạng để UI báo rõ */
async function safeAdminFetch(
  url: string,
  headers: HeadersInit
): Promise<{ res: Response | null; networkErr?: string }> {
  try {
    const res = await fetch(url, { headers });
    return { res };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { res: null, networkErr: msg };
  }
}

async function readHttpErrorDetail(res: Response): Promise<string> {
  const text = await res.text();
  if (!text.trim()) return '';
  try {
    const j = JSON.parse(text) as { error?: string };
    return (j.error || text).slice(0, 280);
  } catch {
    return text.slice(0, 280);
  }
}

interface BridgeConfig {
  HOST: string;
  PORT: number;
  NUM_WORKERS: number;
  PREFERRED_BROWSER: string;
  CHAT_URL: string;
  HIDE_WINDOW: boolean;
  LAUNCH_MINIMIZED: boolean;
  LAUNCH_OFFSCREEN: boolean;
  PROFILE_DIR: string;
  STREAM_NO_CHANGE_THRESHOLD: number;
  STREAM_FALLBACK_THRESHOLD: number;
  STREAM_MAX_TIMEOUT: number;
  STREAM_START_TIMEOUT: number;
  STREAM_CHECK_INTERVAL: number;
  BRIDGE_API_KEY: string;
  BRIDGE_ADMIN_API_KEY?: string;
}

interface ApiKey {
  id: string;
  name: string;
  key: string;
  createdAt: string;
  lastUsed: string | null;
  active: boolean;
}

interface Worker {
  id: string;
  busy: boolean;
  lastActivity: string | null;
}

interface SystemStatus {
  system: {
    uptime: number;
    memory: {
      rss: number;
      heapTotal: number;
      heapUsed: number;
      external: number;
    };
    platform: string;
    nodeVersion: string;
  };
  bridge: {
    host: string;
    port: number;
    workers: {
      total: number;
      available: number;
      busy: number;
      generating: number;
    };
    authEnabled: boolean;
    config: {
      preferredBrowser: string;
      chatUrl: string;
      hideWindow: boolean;
    };
  };
  admin: {
    keysCount: number;
    activeKeys: number;
  };
}

type AdminTab = 'overview' | 'config' | 'keys' | 'workers' | 'status';

export default function BridgeAdminPage() {
  const [activeTab, setActiveTab] = useState<AdminTab>('overview');
  const [config, setConfig] = useState<BridgeConfig | null>(null);
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [status, setStatus] = useState<SystemStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [adminKeyOverride, setAdminKeyOverride] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [showApiKey, setShowApiKey] = useState<string | null>(null);
  const [newKeyName, setNewKeyName] = useState('');
  const [configForm, setConfigForm] = useState<Partial<BridgeConfig>>({});
  const [browserRunning, setBrowserRunning] = useState(false);
  const [lastSyncAt, setLastSyncAt] = useState<Date | null>(null);
  const [savingConfig, setSavingConfig] = useState(false);
  const [creatingKey, setCreatingKey] = useState(false);
  const [deletingKeyId, setDeletingKeyId] = useState<string | null>(null);
  const [togglingKeyId, setTogglingKeyId] = useState<string | null>(null);
  const [addingWorker, setAddingWorker] = useState(false);
  const [removingWorker, setRemovingWorker] = useState(false);
  const [browserAction, setBrowserAction] = useState<'show' | 'hide' | null>(null);

  const showTopProgress =
    loading ||
    refreshing ||
    savingConfig ||
    creatingKey ||
    deletingKeyId !== null ||
    togglingKeyId !== null ||
    addingWorker ||
    removingWorker ||
    browserAction !== null;

  useEffect(() => {
    const stored = readStoredAdminKey();
    if (stored) setAdminKeyOverride(stored);
  }, []);

  const resolvedAdminKey = adminKeyOverride.trim() || BRIDGE_ENV_ADMIN;

  const fetchData = useCallback(async (isInitial = false) => {
    try {
      if (isInitial) setLoading(true);
      else setRefreshing(true);

      const headers = {
        'X-Admin-API-Key': resolvedAdminKey,
        'Content-Type': 'application/json'
      };

      const endpoints: { label: string; url: string }[] = [
        { label: 'GET /admin/config', url: `${BRIDGE_API_URL}/admin/config` },
        { label: 'GET /admin/keys', url: `${BRIDGE_API_URL}/admin/keys` },
        { label: 'GET /admin/workers', url: `${BRIDGE_API_URL}/admin/workers` },
        { label: 'GET /admin/status', url: `${BRIDGE_API_URL}/admin/status` },
        { label: 'GET /admin/browser', url: `${BRIDGE_API_URL}/admin/browser` }
      ];

      const outcomes = await Promise.all(
        endpoints.map(async ({ label, url }) => {
          const { res, networkErr } = await safeAdminFetch(url, headers);
          return { label, res, networkErr };
        })
      );

      const auth401 = outcomes.some(o => o.res?.status === 401);
      if (auth401) {
        setError(
          'Xác thực admin thất bại (HTTP 401).\n' +
            '• Kiểm tra BRIDGE_ADMIN_API_KEY trong bridge/.env rồi chạy: npm run config:sync\n' +
            '• Hoặc nhập đúng key ở ô “Admin API Key” phía trên và bấm “Lưu trên trình duyệt”.'
        );
        setConfig(null);
        setApiKeys([]);
        setWorkers([]);
        setStatus(null);
        setBrowserRunning(false);
        return;
      }

      const failures: string[] = [];
      for (const { label, res, networkErr } of outcomes) {
        if (networkErr) {
          failures.push(`${label}: lỗi mạng — ${networkErr}`);
          continue;
        }
        if (!res) {
          failures.push(`${label}: không có phản hồi (null).`);
          continue;
        }
        if (!res.ok) {
          const detail = await readHttpErrorDetail(res.clone());
          failures.push(
            `${label}: HTTP ${res.status}${detail ? ` — ${detail}` : ' (không có nội dung lỗi từ server)'}`
          );
        }
      }

      const byLabel = (s: string) => outcomes.find(o => o.label === s);

      const configOut = byLabel('GET /admin/config');
      const keysOut = byLabel('GET /admin/keys');
      const workersOut = byLabel('GET /admin/workers');
      const statusOut = byLabel('GET /admin/status');
      const browserOut = byLabel('GET /admin/browser');

      if (configOut?.res?.ok) {
        try {
          const configData = (await configOut.res.json()) as { config: BridgeConfig };
          setConfig(configData.config);
          setConfigForm(configData.config);
        } catch {
          failures.push('GET /admin/config: phản hồi không phải JSON hợp lệ.');
          setConfig(null);
        }
      } else {
        setConfig(null);
      }

      if (keysOut?.res?.ok) {
        try {
          const keysData = (await keysOut.res.json()) as { keys: ApiKey[] };
          setApiKeys(keysData.keys || []);
        } catch {
          failures.push('GET /admin/keys: phản hồi không phải JSON hợp lệ.');
          setApiKeys([]);
        }
      } else {
        setApiKeys([]);
      }

      if (workersOut?.res?.ok) {
        try {
          const workersData = (await workersOut.res.json()) as { workers: Worker[] };
          setWorkers(workersData.workers || []);
        } catch {
          failures.push('GET /admin/workers: phản hồi không phải JSON hợp lệ.');
          setWorkers([]);
        }
      } else {
        setWorkers([]);
      }

      if (browserOut?.res?.ok) {
        try {
          const browserData = (await browserOut.res.json()) as { running: boolean };
          setBrowserRunning(Boolean(browserData.running));
        } catch {
          failures.push('GET /admin/browser: phản hồi không phải JSON hợp lệ.');
        }
      } else {
        setBrowserRunning(false);
      }

      if (statusOut?.res?.ok) {
        try {
          const statusData = (await statusOut.res.json()) as SystemStatus;
          setStatus(statusData);
        } catch {
          failures.push('GET /admin/status: phản hồi không phải JSON hợp lệ.');
          setStatus(null);
        }
      } else {
        setStatus(null);
      }

      const anyOk = outcomes.some(o => o.res?.ok);
      if (failures.length > 0) {
        const header =
          anyOk ?
            'Một số API lỗi (dữ liệu khả dụng có thể đã cập nhật một phần):'
          : 'Không tải được dữ liệu từ be-bridge:';
        setError([header, ...failures.map(f => `• ${f}`)].join('\n'));
      } else {
        setError(null);
      }

      if (anyOk) {
        setLastSyncAt(new Date());
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(`Lỗi không mong đợi khi đồng bộ: ${msg}`);
      console.error('[fetchData]', err);
    } finally {
      if (isInitial) setLoading(false);
      setRefreshing(false);
    }
  }, [resolvedAdminKey]);

  useEffect(() => {
    void fetchData(true);
    const interval = setInterval(() => void fetchData(false), 10000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const handleSaveConfig = async () => {
    setSavingConfig(true);
    setError(null);
    try {
      const headers = {
        'X-Admin-API-Key': resolvedAdminKey,
        'Content-Type': 'application/json'
      };

      const res = await fetch(`${BRIDGE_API_URL}/admin/config`, {
        method: 'PUT',
        headers,
        body: JSON.stringify(configForm)
      });

      if (res.ok) {
        setSuccessMessage('Cấu hình đã được lưu vào .env be-bridge.');
        setTimeout(() => setSuccessMessage(null), 4000);
        void fetchData(false);
      } else {
        const errorData = await res.json().catch(() => ({}));
        setError(`Lưu cấu hình thất bại: ${(errorData as { error?: string }).error || res.statusText}`);
      }
    } catch {
      setError('Không thể lưu cấu hình (lỗi mạng hoặc máy chủ).');
    } finally {
      setSavingConfig(false);
    }
  };

  const handleGenerateKey = async () => {
    if (!newKeyName.trim()) {
      setError('Vui lòng nhập tên cho key.');
      return;
    }
    setCreatingKey(true);
    setError(null);
    try {
      const headers = {
        'X-Admin-API-Key': resolvedAdminKey,
        'Content-Type': 'application/json'
      };

      const res = await fetch(`${BRIDGE_API_URL}/admin/keys`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ name: newKeyName })
      });

      if (res.ok) {
        const data = await res.json();
        setApiKeys([...apiKeys, data.key]);
        setNewKeyName('');
        setSuccessMessage('API key mới đã được tạo. Sao chép và lưu an toàn ngay.');
        setTimeout(() => setSuccessMessage(null), 5000);
      } else {
        const errBody = await res.json().catch(() => ({}));
        setError((errBody as { error?: string }).error || `Tạo key thất bại (${res.status})`);
      }
    } catch {
      setError('Không thể tạo API key (lỗi mạng).');
    } finally {
      setCreatingKey(false);
    }
  };

  const handleDeleteKey = async (keyId: string) => {
    if (!confirm('Bạn có chắc chắn muốn xóa API key này?')) return;
    setDeletingKeyId(keyId);
    setError(null);
    try {
      const headers = {
        'X-Admin-API-Key': resolvedAdminKey,
        'Content-Type': 'application/json'
      };

      const res = await fetch(`${BRIDGE_API_URL}/admin/keys/${keyId}`, {
        method: 'DELETE',
        headers
      });

      if (res.ok) {
        setApiKeys(apiKeys.filter(key => key.id !== keyId));
        setSuccessMessage('API key đã được xóa khỏi bộ nhớ bridge.');
        setTimeout(() => setSuccessMessage(null), 4000);
      } else {
        const errBody = await res.json().catch(() => ({}));
        setError((errBody as { error?: string }).error || `Xóa key thất bại (${res.status})`);
      }
    } catch {
      setError('Không thể xóa API key (lỗi mạng).');
    } finally {
      setDeletingKeyId(null);
    }
  };

  
  const handleShowBrowser = async () => {
    setBrowserAction('show');
    setError(null);
    try {
      const headers = {
        'X-Admin-API-Key': resolvedAdminKey,
        'Content-Type': 'application/json'
      };

      const res = await fetch(`${BRIDGE_API_URL}/admin/browser`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ action: 'show' })
      });

      if (res.ok) {
        setSuccessMessage('Đã gửi lệnh hiện cửa sổ ChatGPT tới Puppeteer.');
        setTimeout(() => setSuccessMessage(null), 4000);
        void fetchData(false);
      } else {
        const errBody = await res.json().catch(() => ({}));
        setError((errBody as { error?: string }).error || `Hiện cửa sổ thất bại (${res.status})`);
      }
    } catch {
      setError('Không thể hiện cửa sổ (lỗi mạng).');
    } finally {
      setBrowserAction(null);
    }
  };

  const handleHideBrowser = async () => {
    setBrowserAction('hide');
    setError(null);
    try {
      const headers = {
        'X-Admin-API-Key': resolvedAdminKey,
        'Content-Type': 'application/json'
      };

      const res = await fetch(`${BRIDGE_API_URL}/admin/browser`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ action: 'hide' })
      });

      if (res.ok) {
        setSuccessMessage('Đã gửi lệnh thu nhỏ / ẩn cửa sổ ChatGPT.');
        setTimeout(() => setSuccessMessage(null), 4000);
        void fetchData(false);
      } else {
        const errBody = await res.json().catch(() => ({}));
        setError((errBody as { error?: string }).error || `Ẩn cửa sổ thất bại (${res.status})`);
      }
    } catch {
      setError('Không thể ẩn cửa sổ (lỗi mạng).');
    } finally {
      setBrowserAction(null);
    }
  };

  const handleToggleKey = async (keyId: string, active: boolean) => {
    setTogglingKeyId(keyId);
    setError(null);
    try {
      const headers = {
        'X-Admin-API-Key': resolvedAdminKey,
        'Content-Type': 'application/json'
      };

      const res = await fetch(`${BRIDGE_API_URL}/admin/keys/${keyId}`, {
        method: 'PUT',
        headers,
        body: JSON.stringify({ active: !active })
      });

      if (res.ok) {
        setSuccessMessage(active ? 'Đã vô hiệu hóa key.' : 'Đã kích hoạt key.');
        setTimeout(() => setSuccessMessage(null), 3500);
        void fetchData(false);
      } else {
        const errBody = await res.json().catch(() => ({}));
        setError((errBody as { error?: string }).error || `Cập nhật key thất bại (${res.status})`);
      }
    } catch {
      setError('Không thể cập nhật trạng thái key (lỗi mạng).');
    } finally {
      setTogglingKeyId(null);
    }
  };

  const handleAddWorker = async () => {
    setAddingWorker(true);
    setError(null);
    try {
      const headers = {
        'X-Admin-API-Key': resolvedAdminKey,
        'Content-Type': 'application/json'
      };

      const res = await fetch(`${BRIDGE_API_URL}/admin/workers`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ count: 1 })
      });

      if (res.ok) {
        setSuccessMessage('Đã thêm slot worker (cùng một phiên Puppeteer).');
        setTimeout(() => setSuccessMessage(null), 4000);
        void fetchData(false);
      } else {
        const errBody = await res.json().catch(() => ({}));
        setError((errBody as { error?: string }).error || `Thêm worker thất bại (${res.status})`);
      }
    } catch {
      setError('Không thể thêm worker (lỗi mạng).');
    } finally {
      setAddingWorker(false);
    }
  };

  const handleRemoveWorker = async () => {
    setRemovingWorker(true);
    setError(null);
    try {
      const headers = {
        'X-Admin-API-Key': resolvedAdminKey,
        'Content-Type': 'application/json'
      };

      const res = await fetch(`${BRIDGE_API_URL}/admin/workers`, {
        method: 'DELETE',
        headers,
        body: JSON.stringify({ count: 1 })
      });

      if (res.ok) {
        setSuccessMessage('Đã gỡ một slot worker rảnh.');
        setTimeout(() => setSuccessMessage(null), 4000);
        void fetchData(false);
      } else {
        const errBody = await res.json().catch(() => ({}));
        setError((errBody as { error?: string }).error || `Xóa worker thất bại (${res.status})`);
      }
    } catch {
      setError('Không thể xóa worker (lỗi mạng).');
    } finally {
      setRemovingWorker(false);
    }
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatUptime = (seconds: number) => {
    const days = Math.floor(seconds / (3600 * 24));
    const hours = Math.floor((seconds % (3600 * 24)) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    
    const parts = [];
    if (days > 0) parts.push(`${days}d`);
    if (hours > 0) parts.push(`${hours}h`);
    if (minutes > 0) parts.push(`${minutes}m`);
    if (secs > 0 || parts.length === 0) parts.push(`${secs}s`);
    
    return parts.join(' ');
  };

  const persistAdminKey = () => {
    try {
      const v = adminKeyOverride.trim();
      if (v) localStorage.setItem(ADMIN_KEY_STORAGE, v);
      else localStorage.removeItem(ADMIN_KEY_STORAGE);
      setSuccessMessage(
        v
          ? 'Đã lưu Admin API Key trên trình duyệt.'
          : 'Đã xóa key cục bộ; dùng key từ biến môi trường build.'
      );
      setTimeout(() => setSuccessMessage(null), 4000);
      void fetchData(false);
    } catch {
      setError('Không ghi được localStorage.');
    }
  };

  const clearStoredAdminKey = () => {
    try {
      localStorage.removeItem(ADMIN_KEY_STORAGE);
    } catch {
      /* ignore */
    }
    setAdminKeyOverride('');
    setSuccessMessage('Đã xóa key cục bộ.');
    setTimeout(() => setSuccessMessage(null), 3000);
    void fetchData(false);
  };

  const navItems: { id: AdminTab; label: string; icon: ReactNode }[] = [
    { id: 'overview', label: 'Tổng quan', icon: <LayoutGrid className="h-4 w-4 shrink-0" /> },
    { id: 'config', label: 'Cấu hình', icon: <Settings className="h-4 w-4 shrink-0" /> },
    { id: 'keys', label: 'API Keys', icon: <Key className="h-4 w-4 shrink-0" /> },
    { id: 'workers', label: 'Workers', icon: <Users className="h-4 w-4 shrink-0" /> },
    { id: 'status', label: 'Giám sát', icon: <Activity className="h-4 w-4 shrink-0" /> }
  ];

  return (
    <>
      <div
        className="admin-progress-track"
        data-active={showTopProgress ? 'true' : 'false'}
        role="progressbar"
        aria-hidden={!showTopProgress}
        aria-busy={showTopProgress}
        aria-label={showTopProgress ? 'Đang xử lý' : undefined}
      />

      {loading ? (
        <div className="mx-auto flex min-h-screen max-w-6xl flex-col gap-6 p-6 lg:flex-row lg:gap-0">
          <aside className="hidden w-56 shrink-0 space-y-3 lg:block lg:border-r lg:border-slate-200 lg:pr-6">
            {[1, 2, 3, 4, 5].map(i => (
              <div key={i} className="admin-skeleton h-10 w-full" />
            ))}
          </aside>
          <div className="flex-1 space-y-6">
            <div className="admin-skeleton h-10 w-48" />
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="admin-skeleton h-28 w-full rounded-xl" />
              ))}
            </div>
            <div className="admin-skeleton h-64 w-full rounded-xl" />
            <p className="text-center text-sm text-slate-500">Đang tải dữ liệu từ be-bridge…</p>
          </div>
        </div>
      ) : (
        <div className="mx-auto flex min-h-screen w-full max-w-[1600px] flex-col lg:flex-row">
          <aside className="admin-sidebar flex flex-col border-b lg:w-60 lg:border-b-0 lg:px-3 lg:py-6">
            <div className="flex items-center gap-2 border-b border-slate-100 px-4 py-4 lg:border-0 lg:px-2 lg:pb-6">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-600 text-white shadow-sm">
                <Server className="h-5 w-5" aria-hidden />
              </span>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Console</p>
                <p className="text-sm font-bold text-slate-900">be-bridge</p>
              </div>
            </div>
            <nav className="flex gap-1 overflow-x-auto px-2 py-3 lg:flex-col lg:px-2" aria-label="Điều hướng chính">
              {navItems.map(item => (
                <button
                  key={item.id}
                  type="button"
                  data-active={activeTab === item.id}
                  className="admin-nav-btn shrink-0"
                  aria-current={activeTab === item.id ? 'page' : undefined}
                  onClick={() => setActiveTab(item.id)}
                >
                  {item.icon}
                  {item.label}
                </button>
              ))}
            </nav>
            <div className="mt-auto hidden px-3 pb-4 text-xs text-slate-500 lg:block">
              {lastSyncAt && (
                <p>
                  Đồng bộ:{' '}
                  <time dateTime={lastSyncAt.toISOString()}>{lastSyncAt.toLocaleTimeString('vi-VN')}</time>
                </p>
              )}
            </div>
          </aside>

          <div className="flex min-w-0 flex-1 flex-col">
            <header className="sticky top-0 z-40 border-b border-slate-200/90 bg-white/90 px-4 py-3 backdrop-blur-md md:px-8">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <h1 className="text-lg font-bold tracking-tight text-slate-900 md:text-xl">
                    Quản trị vận hành
                  </h1>
                  <p className="text-xs text-slate-500 md:text-sm">
                    Endpoint{' '}
                    <code className="rounded bg-slate-100 px-1 py-0.5 font-mono text-[11px] text-slate-700">
                      {BRIDGE_API_URL}
                    </code>
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {lastSyncAt && (
                    <span className="hidden text-xs text-slate-500 sm:inline">
                      Cập nhật: {lastSyncAt.toLocaleTimeString('vi-VN')}
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => void fetchData(false)}
                    disabled={refreshing}
                    aria-busy={refreshing}
                    className="admin-btn-secondary"
                  >
                    <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} aria-hidden />
                    Đồng bộ dữ liệu
                  </button>
                </div>
              </div>
            </header>

            <div className="flex-1 space-y-6 px-4 py-6 md:px-8">
              <section className="admin-card p-5" aria-labelledby="auth-heading">
                <h2 id="auth-heading" className="sr-only">
                  Xác thực quản trị
                </h2>
                <div className="flex flex-col gap-4 lg:flex-row lg:items-end">
                  <div className="min-w-0 flex-1 space-y-2">
                    <label htmlFor="admin-api-key" className="admin-label">
                      Admin API Key
                    </label>
                    <input
                      id="admin-api-key"
                      type="password"
                      autoComplete="off"
                      value={adminKeyOverride}
                      onChange={e => setAdminKeyOverride(e.target.value)}
                      placeholder="Trống = dùng NEXT_PUBLIC_ADMIN_API_KEY từ build"
                      className="admin-input font-mono text-sm"
                    />
                    <p className="text-xs text-slate-500">
                      Header <span className="font-mono">X-Admin-API-Key</span>. Sau khi đổi trong{' '}
                      <span className="font-mono">bridge/.env</span>, chạy{' '}
                      <span className="font-mono">npm run config:sync</span>.
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button type="button" onClick={persistAdminKey} className="admin-btn-primary">
                      Lưu trên trình duyệt
                    </button>
                    <button type="button" onClick={clearStoredAdminKey} className="admin-btn-secondary">
                      Xóa key cục bộ
                    </button>
                  </div>
                </div>
              </section>

              <div className="space-y-3" role="region" aria-label="Thông báo hệ thống" aria-live="polite">
                {error && (
                  <div
                    role="alert"
                    className="flex items-start gap-3 rounded-lg border border-red-200 bg-[var(--admin-danger-bg)] p-4 text-sm text-red-900"
                  >
                    <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-red-600" aria-hidden />
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold">Có lỗi</p>
                      <p className="mt-1 whitespace-pre-wrap break-words text-left text-sm text-red-800">
                        {error}
                      </p>
                    </div>
                    <button
                      type="button"
                      className="rounded p-1 text-red-700 hover:bg-red-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-400"
                      aria-label="Đóng thông báo lỗi"
                      onClick={() => setError(null)}
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                )}
                {successMessage && (
                  <div
                    role="status"
                    className="flex items-start gap-3 rounded-lg border border-emerald-200 bg-[var(--admin-success-bg)] p-4 text-sm text-emerald-900"
                  >
                    <Radio className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" aria-hidden />
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold">Thành công</p>
                      <p className="mt-1 text-emerald-800">{successMessage}</p>
                    </div>
                    <button
                      type="button"
                      className="rounded p-1 text-emerald-800 hover:bg-emerald-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
                      aria-label="Đóng thông báo"
                      onClick={() => setSuccessMessage(null)}
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                )}
              </div>

              <div className="admin-card min-h-[420px] p-6 md:p-8">
          {activeTab === 'overview' && (
            <div className="space-y-8">
              <div>
                <h2 className="text-base font-bold text-slate-900">Tổng quan vận hành</h2>
                <p className="mt-1 text-sm text-slate-500">
                  Chỉ số tổng hợp từ be-bridge. Chọn mục bên trái để cấu hình chi tiết.
                </p>
              </div>
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Workers</p>
                  <p className="mt-2 text-3xl font-bold tabular-nums text-slate-900">{workers.length}</p>
                  <p className="mt-1 text-xs text-slate-600">
                    Rảnh: {workers.filter(w => !w.busy).length} · Bận: {workers.filter(w => w.busy).length}
                  </p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">API keys (RAM)</p>
                  <p className="mt-2 text-3xl font-bold tabular-nums text-slate-900">{apiKeys.length}</p>
                  <p className="mt-1 text-xs text-slate-600">Keys do admin tạo trong phiên bridge</p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Xác thực bridge</p>
                  <p className="mt-2 text-lg font-bold text-slate-900">
                    {status?.bridge.authEnabled ? 'Bật' : 'Tắt'}
                  </p>
                  <p className="mt-1 text-xs text-slate-600">BRIDGE_API_KEY cho be-main</p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Puppeteer</p>
                  <p className="mt-2 text-lg font-bold text-slate-900">
                    {browserRunning ? 'Browser mở' : 'Không xác định'}
                  </p>
                  <p className="mt-1 text-xs text-slate-600">Theo /admin/browser</p>
                </div>
              </div>
              {status ? (
                <div className="grid gap-4 lg:grid-cols-2">
                  <div className="rounded-xl border border-slate-200 p-4">
                    <h3 className="text-sm font-semibold text-slate-800">Hệ thống</h3>
                    <dl className="mt-3 space-y-2 text-sm">
                      <div className="flex justify-between gap-4">
                        <dt className="text-slate-500">Uptime</dt>
                        <dd className="font-medium tabular-nums">{formatUptime(status.system.uptime)}</dd>
                      </div>
                      <div className="flex justify-between gap-4">
                        <dt className="text-slate-500">Node</dt>
                        <dd className="font-mono text-xs text-slate-800">{status.system.nodeVersion}</dd>
                      </div>
                      <div className="flex justify-between gap-4">
                        <dt className="text-slate-500">RSS</dt>
                        <dd className="font-medium">{formatBytes(status.system.memory.rss)}</dd>
                      </div>
                    </dl>
                  </div>
                  <div className="rounded-xl border border-slate-200 p-4">
                    <h3 className="text-sm font-semibold text-slate-800">Bridge</h3>
                    <dl className="mt-3 space-y-2 text-sm">
                      <div className="flex justify-between gap-4">
                        <dt className="text-slate-500">Listen</dt>
                        <dd className="font-mono text-xs">
                          {status.bridge.host}:{status.bridge.port}
                        </dd>
                      </div>
                      <div className="flex justify-between gap-4">
                        <dt className="text-slate-500">Browser</dt>
                        <dd className="font-medium">{status.bridge.config.preferredBrowser}</dd>
                      </div>
                    </dl>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50/50 py-12 text-center">
                  <Inbox className="h-10 w-10 text-slate-300" aria-hidden />
                  <p className="mt-3 text-sm font-medium text-slate-700">Chưa có snapshot trạng thái</p>
                  <p className="mt-1 max-w-sm text-xs text-slate-500">
                    Kết nối API hoặc quyền admin chưa đủ. Dùng &quot;Đồng bộ dữ liệu&quot; hoặc kiểm tra key.
                  </p>
                  <button
                    type="button"
                    className="admin-btn-primary mt-4"
                    onClick={() => void fetchData(false)}
                  >
                    Thử tải lại
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Config Tab */}
          {activeTab === 'config' && (config ? (
            <div className="space-y-6">
              <h2 className="text-xl font-semibold flex items-center gap-2">
                <Settings className="h-5 w-5" />
                Cấu hình hệ thống
              </h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {/* Basic Settings */}
                <div className="space-y-4">
                  <h3 className="font-medium text-gray-900 flex items-center gap-2">
                    <Globe className="h-4 w-4" />
                    Cài đặt cơ bản
                  </h3>
                  
                  <div>
                    <label className="admin-label">Host</label>
                    <input
                      type="text"
                      value={configForm.HOST || ''}
                      onChange={e => setConfigForm({...configForm, HOST: e.target.value})}
                      className="admin-input"
                    />
                  </div>
                  
                  <div>
                    <label className="admin-label">Port</label>
                    <input
                      type="number"
                      value={configForm.PORT || 1122}
                      onChange={e => setConfigForm({...configForm, PORT: parseInt(e.target.value)})}
                      className="admin-input"
                    />
                  </div>
                  
                  <div>
                    <label className="admin-label">Số lượng Workers</label>
                    <input
                      type="number"
                      min="1"
                      max="10"
                      value={configForm.NUM_WORKERS || 2}
                      onChange={e => setConfigForm({...configForm, NUM_WORKERS: parseInt(e.target.value)})}
                      className="admin-input"
                    />
                  </div>
                </div>

                {/* Browser Settings */}
                <div className="space-y-4">
                  <h3 className="font-medium text-gray-900 flex items-center gap-2">
                    <Monitor className="h-4 w-4" />
                    Cài đặt Browser
                  </h3>
                  
                  <div>
                    <label className="admin-label">Trình duyệt ưu tiên</label>
                    <select
                      value={configForm.PREFERRED_BROWSER || 'chrome'}
                      onChange={e => setConfigForm({...configForm, PREFERRED_BROWSER: e.target.value})}
                      className="admin-input"
                    >
                      <option value="chrome">Chrome</option>
                      <option value="edge">Edge</option>
                    </select>
                  </div>
                  
                  <div>
                    <label className="admin-label">Chat URL</label>
                    <input
                      type="text"
                      value={configForm.CHAT_URL || ''}
                      onChange={e => setConfigForm({...configForm, CHAT_URL: e.target.value})}
                      className="admin-input"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="hideWindow"
                        checked={configForm.HIDE_WINDOW || false}
                        onChange={e => setConfigForm({...configForm, HIDE_WINDOW: e.target.checked})}
                        className="w-4 h-4"
                      />
                      <label htmlFor="hideWindow" className="text-sm">Ẩn cửa sổ chat</label>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="launchMinimized"
                        checked={configForm.LAUNCH_MINIMIZED || false}
                        onChange={e => setConfigForm({...configForm, LAUNCH_MINIMIZED: e.target.checked})}
                        className="w-4 h-4"
                      />
                      <label htmlFor="launchMinimized" className="text-sm">Khởi chạy thu nhỏ</label>
                    </div>
                  </div>
                </div>

                {/* Streaming Settings */}
                <div className="space-y-4">
                  <h3 className="font-medium text-gray-900 flex items-center gap-2">
                    <Cpu className="h-4 w-4" />
                    Cài đặt Streaming
                  </h3>
                  
                  <div>
                    <label className="admin-label">No Change Threshold</label>
                    <input
                      type="number"
                      value={configForm.STREAM_NO_CHANGE_THRESHOLD || 10}
                      onChange={e => setConfigForm({...configForm, STREAM_NO_CHANGE_THRESHOLD: parseInt(e.target.value)})}
                      className="admin-input"
                    />
                  </div>
                  
                  <div>
                    <label className="admin-label">Fallback Threshold</label>
                    <input
                      type="number"
                      value={configForm.STREAM_FALLBACK_THRESHOLD || 25}
                      onChange={e => setConfigForm({...configForm, STREAM_FALLBACK_THRESHOLD: parseInt(e.target.value)})}
                      className="admin-input"
                    />
                  </div>
                  
                  <div>
                    <label className="admin-label">Max Timeout (ms)</label>
                    <input
                      type="number"
                      value={configForm.STREAM_MAX_TIMEOUT || 120000}
                      onChange={e => setConfigForm({...configForm, STREAM_MAX_TIMEOUT: parseInt(e.target.value)})}
                      className="admin-input"
                    />
                  </div>
                </div>
              </div>

              {/* API Key */}
              <div className="pt-6 border-t">
                <h3 className="font-medium text-gray-900 mb-4 flex items-center gap-2">
                  <Shield className="h-4 w-4" />
                  API Key cho be-main
                </h3>
                <div className="flex items-center gap-3">
                  <div className="flex-1">
                    <input
                      type={showApiKey === 'bridge' ? 'text' : 'password'}
                      value={configForm.BRIDGE_API_KEY || ''}
                      onChange={e => setConfigForm({...configForm, BRIDGE_API_KEY: e.target.value})}
                      className="admin-input font-mono"
                      placeholder="Nhập API key mới (để trống để giữ nguyên)"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowApiKey(showApiKey === 'bridge' ? null : 'bridge')}
                    className="admin-btn-secondary px-3 py-2"
                  >
                    {showApiKey === 'bridge' ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                <p className="text-sm text-gray-500 mt-2">
                  API key này được be-main sử dụng để xác thực với be-bridge
                </p>
              </div>

              <div className="pt-6 border-t">
                <h3 className="font-medium text-gray-900 mb-4 flex items-center gap-2">
                  <Key className="h-4 w-4" />
                  Admin API Key (lưu vào .env be-bridge)
                </h3>
                <p className="text-sm text-gray-500 mb-3">
                  Để trống khi bấm Lưu = giữ nguyên giá trị hiện tại trên file. Đổi key xong cần khởi động lại be-bridge và cập nhật key trên dashboard (hoặc localStorage).
                </p>
                <div className="flex items-center gap-3">
                  <div className="flex-1">
                    <input
                      type={showApiKey === 'admincfg' ? 'text' : 'password'}
                      value={configForm.BRIDGE_ADMIN_API_KEY || ''}
                      onChange={e =>
                        setConfigForm({ ...configForm, BRIDGE_ADMIN_API_KEY: e.target.value })
                      }
                      className="admin-input font-mono text-sm"
                      placeholder="Nhập admin key mới (tuỳ chọn)"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowApiKey(showApiKey === 'admincfg' ? null : 'admincfg')}
                    className="admin-btn-secondary px-3 py-2"
                  >
                    {showApiKey === 'admincfg' ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {/* Save Button */}
              <div className="pt-6 border-t">
                <button
                  type="button"
                  onClick={handleSaveConfig}
                  disabled={savingConfig}
                  aria-busy={savingConfig}
                  className="admin-btn-primary px-6 py-3"
                >
                  {savingConfig ? (
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                  ) : (
                    <Save className="h-4 w-4" aria-hidden />
                  )}
                  {savingConfig ? 'Đang lưu…' : 'Lưu cấu hình'}
                </button>
                <p className="text-sm text-gray-500 mt-2">
                  Lưu ý: Thay đổi cấu hình sẽ yêu cầu khởi động lại be-bridge
                </p>
              </div>
            </div>
          ) : (
            <div className="py-16 text-center space-y-4 text-slate-600">
              <p className="text-lg font-medium text-slate-800">Chưa tải được cấu hình</p>
              <p className="text-sm max-w-md mx-auto">
                Kiểm tra be-bridge đang chạy, URL API và Admin API Key ở trên. Tab khác vẫn có thể dùng nếu chỉ riêng config lỗi.
              </p>
              <button
                type="button"
                onClick={() => void fetchData(false)}
                className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-slate-800"
              >
                <RefreshCw className="h-4 w-4" />
                Thử tải lại
              </button>
            </div>
          ))}

          {/* API Keys Tab */}
          {activeTab === 'keys' && (
            <div className="space-y-6">
              <h2 className="text-xl font-semibold flex items-center gap-2">
                <Key className="h-5 w-5" />
                Quản lý API Keys
              </h2>

              {/* Generate New Key */}
              <div className="bg-gray-50 p-4 rounded-lg">
                <h3 className="font-medium mb-3">Tạo API key mới</h3>
                <div className="flex gap-3">
                  <input
                    type="text"
                    value={newKeyName}
                    onChange={e => setNewKeyName(e.target.value)}
                    placeholder="Tên key (ví dụ: Production Key)"
                    className="admin-input flex-1"
                  />
                  <button
                    type="button"
                    onClick={handleGenerateKey}
                    disabled={creatingKey}
                    aria-busy={creatingKey}
                    className="admin-btn-primary shrink-0"
                  >
                    {creatingKey ? (
                      <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                    ) : (
                      <Plus className="h-4 w-4" aria-hidden />
                    )}
                    {creatingKey ? 'Đang tạo…' : 'Tạo key'}
                  </button>
                </div>
              </div>

              {/* Keys List */}
              <div>
                <h3 className="font-medium mb-3">Danh sách API Keys ({apiKeys?.length || 0})</h3>
                <div className="space-y-3">
                  {apiKeys.map(key => (
                    <div key={key.id} className="border rounded-lg p-4">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-3">
                          <span className="font-medium">{key.name}</span>
                          <span className={`text-xs px-2 py-1 rounded-full ${
                            key.active 
                              ? 'bg-green-100 text-green-700' 
                              : 'bg-gray-100 text-gray-600'
                          }`}>
                            {key.active ? 'Active' : 'Inactive'}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setShowApiKey(showApiKey === key.id ? null : key.id)}
                            className="admin-btn-secondary px-3 py-1.5 text-xs"
                          >
                            {showApiKey === key.id ? 'Ẩn' : 'Hiện'}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleToggleKey(key.id, key.active)}
                            disabled={togglingKeyId === key.id}
                            aria-busy={togglingKeyId === key.id}
                            className="admin-btn-secondary inline-flex items-center gap-1.5 px-3 py-1.5 text-xs"
                          >
                            {togglingKeyId === key.id ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                            ) : null}
                            {key.active ? 'Vô hiệu' : 'Kích hoạt'}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteKey(key.id)}
                            disabled={deletingKeyId === key.id}
                            aria-busy={deletingKeyId === key.id}
                            className="admin-btn-danger px-3 py-1.5 text-xs"
                          >
                            {deletingKeyId === key.id ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                            ) : (
                              <Trash2 className="h-3.5 w-3.5" aria-hidden />
                            )}
                          </button>
                        </div>
                      </div>
                      
                      {showApiKey === key.id && (
                        <div className="mt-3 pt-3 border-t">
                          <div className="font-mono bg-gray-50 p-3 rounded text-sm break-all">
                            {key.key}
                          </div>
                          <p className="text-xs text-gray-500 mt-2">
                            Tạo ngày: {new Date(key.createdAt).toLocaleString('vi-VN')}
                          </p>
                        </div>
                      )}
                    </div>
                  ))}
                  
                  {apiKeys?.length === 0 && (
                    <div className="flex flex-col items-center rounded-xl border border-dashed border-slate-200 bg-slate-50/60 py-12 text-center">
                      <Inbox className="h-9 w-9 text-slate-300" aria-hidden />
                      <p className="mt-3 text-sm font-medium text-slate-700">Chưa có API key</p>
                      <p className="mt-1 max-w-xs text-xs text-slate-500">
                        Tạo key mới ở form phía trên. Key chỉ tồn tại trong bộ nhớ bridge cho đến khi restart.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Workers Tab */}
          {activeTab === 'workers' && (
            <div className="space-y-6">
              <h2 className="text-xl font-semibold flex items-center gap-2">
                <Users className="h-5 w-5" />
                Quản lý Workers
              </h2>

              {/* Worker Stats */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-blue-50 p-4 rounded-lg">
                  <div className="text-2xl font-bold">{workers?.length || 0}</div>
                  <div className="text-sm text-blue-700">Tổng số Workers</div>
                </div>
                <div className="bg-green-50 p-4 rounded-lg">
                  <div className="text-2xl font-bold">
                    {workers?.filter(w => !w.busy).length}
                  </div>
                  <div className="text-sm text-green-700">Workers sẵn sàng</div>
                </div>
                <div className="bg-yellow-50 p-4 rounded-lg">
                  <div className="text-2xl font-bold">
                    {workers?.filter(w => w.busy).length}
                  </div>
                  <div className="text-sm text-yellow-700">Workers đang xử lý</div>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-gradient-to-r from-slate-50 to-white p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <p className="font-semibold text-slate-800">Cửa sổ Puppeteer (ChatGPT)</p>
                  <p className="text-sm text-slate-600 mt-1">
                    Trạng thái:{' '}
                    <span className={browserRunning ? 'text-emerald-600 font-medium' : 'text-slate-500'}>
                      {browserRunning ? 'Đang có browser' : 'Chưa báo / đã đóng'}
                    </span>
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => void handleShowBrowser()}
                    disabled={browserAction !== null}
                    aria-busy={browserAction === 'show'}
                    className="admin-btn-primary bg-slate-900 hover:bg-slate-800"
                  >
                    {browserAction === 'show' ? (
                      <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                    ) : null}
                    Hiện cửa sổ
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleHideBrowser()}
                    disabled={browserAction !== null}
                    aria-busy={browserAction === 'hide'}
                    className="admin-btn-secondary"
                  >
                    {browserAction === 'hide' ? (
                      <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                    ) : null}
                    Thu nhỏ / ẩn
                  </button>
                </div>
              </div>

              {/* Worker Controls */}
              <div className="flex gap-4">
                <button
                  type="button"
                  onClick={handleAddWorker}
                  disabled={addingWorker}
                  aria-busy={addingWorker}
                  className="admin-btn-primary bg-emerald-600 hover:bg-emerald-700"
                >
                  {addingWorker ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Plus className="h-4 w-4" aria-hidden />}
                  {addingWorker ? 'Đang thêm…' : 'Thêm worker'}
                </button>
                <button
                  type="button"
                  onClick={handleRemoveWorker}
                  disabled={workers?.filter(w => !w.busy).length === 0 || removingWorker}
                  aria-busy={removingWorker}
                  className="admin-btn-danger"
                >
                  {removingWorker ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Trash2 className="h-4 w-4" aria-hidden />}
                  {removingWorker ? 'Đang gỡ…' : 'Gỡ worker rảnh'}
                </button>
              </div>

              {/* Workers List */}
              <div>
                <h3 className="font-medium mb-3">Danh sách Workers</h3>
                <div className="space-y-3">
                  {workers.map(worker => (
                    <div key={worker.id} className="border rounded-lg p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className={`h-3 w-3 rounded-full ${
                            worker.busy ? 'bg-yellow-500' : 'bg-green-500'
                          }`}></div>
                          <span className="font-mono text-sm">{worker.id.slice(0, 8)}...</span>
                          <span className={`text-xs px-2 py-1 rounded-full ${
                            worker.busy 
                              ? 'bg-yellow-100 text-yellow-700' 
                              : 'bg-green-100 text-green-700'
                          }`}>
                            {worker.busy ? 'Đang xử lý' : 'Sẵn sàng'}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                  
                  {workers?.length === 0 && (
                    <div className="flex flex-col items-center rounded-xl border border-dashed border-slate-200 py-10 text-center">
                      <Inbox className="h-8 w-8 text-slate-300" aria-hidden />
                      <p className="mt-2 text-sm font-medium text-slate-700">Không có worker trong pool</p>
                      <p className="mt-1 text-xs text-slate-500">Kiểm tra be-bridge đã khởi động thành công.</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Status Tab */}
          {activeTab === 'status' && (status ? (
            <div className="space-y-6">
              <h2 className="text-xl font-semibold flex items-center gap-2">
                <Activity className="h-5 w-5" />
                Trạng thái hệ thống
              </h2>

              {/* System Status */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-gray-50 p-4 rounded-lg">
                  <h3 className="font-medium mb-3">Thông tin hệ thống</h3>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Uptime:</span>
                      <span className="font-medium">{formatUptime(status.system.uptime)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Platform:</span>
                      <span className="font-medium">{status.system.platform}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Node.js:</span>
                      <span className="font-medium">{status.system.nodeVersion}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Memory RSS:</span>
                      <span className="font-medium">{formatBytes(status.system.memory.rss)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Heap Used:</span>
                      <span className="font-medium">{formatBytes(status.system.memory.heapUsed)}</span>
                    </div>
                  </div>
                </div>

                <div className="bg-gray-50 p-4 rounded-lg">
                  <h3 className="font-medium mb-3">Thông tin Bridge</h3>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Địa chỉ:</span>
                      <span className="font-medium">{status.bridge.host}:{status.bridge.port}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Trình duyệt:</span>
                      <span className="font-medium">{status.bridge.config.preferredBrowser}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Xác thực:</span>
                      <span className={`font-medium ${status.bridge.authEnabled ? 'text-green-600' : 'text-yellow-600'}`}>
                        {status.bridge.authEnabled ? 'Đã bật' : 'Đã tắt'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Ẩn cửa sổ:</span>
                      <span className="font-medium">{status.bridge.config.hideWindow ? 'Có' : 'Không'}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Worker Status */}
              <div className="bg-gray-50 p-4 rounded-lg">
                <h3 className="font-medium mb-3">Trạng thái Workers</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="text-center">
                    <div className="text-3xl font-bold">{status.bridge.workers.total}</div>
                    <div className="text-sm text-gray-600">Tổng số</div>
                  </div>
                  <div className="text-center">
                    <div className="text-3xl font-bold text-green-600">{status.bridge.workers.available}</div>
                    <div className="text-sm text-gray-600">Sẵn sàng</div>
                  </div>
                  <div className="text-center">
                    <div className="text-3xl font-bold text-yellow-600">{status.bridge.workers.busy}</div>
                    <div className="text-sm text-gray-600">Đang xử lý</div>
                  </div>
                  <div className="text-center">
                    <div className="text-3xl font-bold text-red-600">{status.bridge.workers.generating}</div>
                    <div className="text-sm text-gray-600">Đang generate</div>
                  </div>
                </div>
              </div>

              {/* Admin Status */}
              <div className="bg-gray-50 p-4 rounded-lg">
                <h3 className="font-medium mb-3">Thông tin Admin</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="text-center">
                    <div className="text-3xl font-bold">{status.admin.keysCount}</div>
                    <div className="text-sm text-gray-600">Tổng API Keys</div>
                  </div>
                  <div className="text-center">
                    <div className="text-3xl font-bold text-green-600">{status.admin.activeKeys}</div>
                    <div className="text-sm text-gray-600">Keys đang hoạt động</div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="py-16 text-center space-y-3 text-slate-600">
              <p className="text-lg font-medium text-slate-800">Chưa có dữ liệu trạng thái</p>
              <p className="text-sm">Kiểm tra kết nối tới be-bridge và Admin API Key.</p>
              <button
                type="button"
                onClick={() => void fetchData(false)}
                className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-slate-800"
              >
                <RefreshCw className="h-4 w-4" />
                Thử lại
              </button>
            </div>
          ))}
              </div>
            </div>

            <footer className="border-t border-slate-200/80 px-4 py-4 text-center text-xs text-slate-500 md:px-8">
              <p>be-bridge Admin</p>
              <p className="mt-1 font-mono text-[11px] text-slate-400">{BRIDGE_API_URL}</p>
            </footer>
          </div>
        </div>
      )}
    </>
  );
}