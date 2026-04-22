'use client';

import './admin.css';
import { useCallback, useEffect, useMemo, useState } from 'react';
import Navigation from '@/components/Navigation';
import {
  AdditionalService,
  API_URL,
  createEmptyAdditionalService,
  createEmptyPackage,
  EMPTY_SERVICE_DATA,
  ServicePackage,
  ServicePackagesResponse
} from '@/lib/service-packages';

interface Rule {
  id: string;
  name: string;
  type: 'system' | 'context' | 'instruction';
  scope?: 'pccc' | 'sales';
  content: string;
  priority: number;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

type ConnStatus = 'checking' | 'connected' | 'disconnected';
type KeyStatus = 'idle' | 'checking' | 'valid' | 'invalid';
type MutState = 'idle' | 'saving' | 'deleting' | 'toggling';
type AdminTab = 'settings' | 'rules' | 'services';

const TYPE_META = {
  system: { label: 'Vai trò', color: 'a-badge-brand' },
  context: { label: 'Kiến thức', color: 'a-badge-success' },
  instruction: { label: 'Hướng dẫn', color: 'a-badge-warn' }
};

const SCOPE_META = {
  pccc: {
    label: 'Tư vấn PCCC',
    color: '#2563eb',
    bg: 'rgba(37,99,235,0.08)',
    border: 'rgba(37,99,235,0.16)',
    description: 'Rule chuyên môn, quy định, hồ sơ, nghiệm thu và tư vấn nghiệp vụ PCCC.'
  },
  sales: {
    label: 'Sale dịch vụ',
    color: '#dc2626',
    bg: 'rgba(220,38,38,0.08)',
    border: 'rgba(220,38,38,0.16)',
    description: 'Rule dùng để tư vấn gói, báo giá, chốt nhu cầu và call-to-action.'
  }
} as const;

const SALES_ROLE_TEMPLATE = {
  name: 'Role tu van goi dich vu PCCC',
  type: 'system' as Rule['type'],
  scope: 'sales' as const,
  content: 'Ban dong thoi la tu van vien ban giai phap PCCC. Khi nguoi dung hoi ve chi phi, bao gia, chon goi, nang cap he thong, hoac nhu cau trien khai dich vu, hay chu dong goi y goi dich vu phu hop dua tren du lieu goi hien tai. Tu van theo huong huu ich, khong ep mua, khong qua da. Luon giai thich vi sao goi do phu hop, neu can thi de nghi nguoi dung de lai thong tin cong trinh de duoc tu van sau.',
  priority: 4,
  active: true
};

const PCCC_TEMPLATE = {
  name: 'Huong dan tu van nghiep vu PCCC',
  type: 'instruction' as Rule['type'],
  scope: 'pccc' as const,
  content: 'Tap trung tu van dung pham vi PCCC, dua tren quy dinh, thuc te cong trinh, ho so, nghiem thu, van hanh va an toan. Tra loi ngan gon, co cau truc, uu tien hanh dong cu the va canh bao dung rui ro.',
  priority: 4,
  active: true
};

const Spin = () => (
  <svg className="a-spin" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
    <circle cx="12" cy="12" r="10" strokeOpacity=".25" />
    <path d="M12 2a10 10 0 0 1 10 10" strokeLinecap="round" />
  </svg>
);

function ScopeBadge({ scope }: { scope: 'pccc' | 'sales' }) {
  const meta = SCOPE_META[scope];
  return (
    <span
      className="a-badge"
      style={{ color: meta.color, background: meta.bg, border: `1px solid ${meta.border}` }}
    >
      {meta.label}
    </span>
  );
}

export default function AdminPage() {
  const [tab, setTab] = useState<AdminTab>('settings');
  const [rules, setRules] = useState<Rule[]>([]);
  const [rulesLoading, setRulesLoading] = useState(false);
  const [rulesError, setRulesError] = useState<string | null>(null);
  const [conn, setConn] = useState<ConnStatus>('checking');
  const [keyStatus, setKeyStatus] = useState<KeyStatus>('idle');
  const [apiUrl, setApiUrl] = useState(API_URL);
  const [apiKey, setApiKey] = useState('');
  const [settingsSaved, setSettingsSaved] = useState(false);
  const [settingsError, setSettingsError] = useState<string | null>(null);
  const [savingSettings, setSavingSettings] = useState(false);
  const [editingRule, setEditingRule] = useState<Rule | null>(null);
  const [mutState, setMutState] = useState<MutState>('idle');
  const [mutError, setMutError] = useState<string | null>(null);
  const [mutSuccess, setMutSuccess] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: '',
    type: 'instruction' as Rule['type'],
    scope: 'pccc' as 'pccc' | 'sales',
    content: '',
    priority: 5,
    active: true
  });
  const [serviceData, setServiceData] = useState<ServicePackagesResponse>(EMPTY_SERVICE_DATA);
  const [serviceLoading, setServiceLoading] = useState(false);
  const [serviceError, setServiceError] = useState<string | null>(null);
  const [serviceSaved, setServiceSaved] = useState<string | null>(null);

  useEffect(() => {
    const url = localStorage.getItem('pccc_api_url') || API_URL;
    const key = localStorage.getItem('pccc_bridge_api_key') || '';
    setApiUrl(url);
    setApiKey(key);
    void checkConn(url);
  }, []);

  const headers = useCallback(() => {
    const h: Record<string, string> = { 'Content-Type': 'application/json' };
    if (apiKey) {
      h['X-Bridge-API-Key'] = apiKey;
    }
    return h;
  }, [apiKey]);

  const checkConn = async (url: string) => {
    setConn('checking');
    try {
      const r = await fetch(`${url}/health`);
      setConn(r.ok ? 'connected' : 'disconnected');
    } catch {
      setConn('disconnected');
    }
  };

  const fetchRules = useCallback(async () => {
    if (!apiUrl) return;
    setRulesLoading(true);
    setRulesError(null);
    try {
      const r = await fetch(`${apiUrl}/api/rules`, { headers: headers() });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const d = await r.json();
      setRules(d.rules || []);
    } catch (e) {
      setRulesError(e instanceof Error ? e.message : 'Không tải được danh sách rules');
    } finally {
      setRulesLoading(false);
    }
  }, [apiUrl, headers]);

  const fetchServicePackages = useCallback(async () => {
    if (!apiUrl) return;
    setServiceLoading(true);
    setServiceError(null);
    try {
      const r = await fetch(`${apiUrl}/api/service-packages`);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const d = await r.json() as ServicePackagesResponse;
      setServiceData({
        packages: Array.isArray(d.packages) ? d.packages : [],
        additionalServices: Array.isArray(d.additionalServices) ? d.additionalServices : []
      });
    } catch (e) {
      setServiceError(e instanceof Error ? e.message : 'Không tải được dữ liệu dịch vụ');
    } finally {
      setServiceLoading(false);
    }
  }, [apiUrl]);

  useEffect(() => {
    if (conn === 'connected') {
      void fetchRules();
      void fetchServicePackages();
    }
  }, [conn, fetchRules, fetchServicePackages]);

  const saveSettings = async () => {
    setSavingSettings(true);
    setSettingsError(null);
    setSettingsSaved(false);
    try {
      localStorage.setItem('pccc_api_url', apiUrl);
      if (apiKey) localStorage.setItem('pccc_bridge_api_key', apiKey);
      else localStorage.removeItem('pccc_bridge_api_key');

      if (apiKey) {
        setKeyStatus('checking');
        const r = await fetch(`${apiUrl}/api/settings/bridge-status`, {
          headers: { 'Content-Type': 'application/json', 'X-Bridge-API-Key': apiKey }
        });
        const d = await r.json().catch(() => ({})) as { connected?: boolean };
        setKeyStatus(d.connected ? 'valid' : 'invalid');
        if (!d.connected) {
          setSettingsError('API Key không hợp lệ hoặc máy chủ AI chưa sẵn sàng.');
          setSavingSettings(false);
          return;
        }
      }

      if (apiKey) {
        await fetch(`${apiUrl}/api/settings/bridge-key`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ key: apiKey })
        }).catch(() => {});
      }

      setSettingsSaved(true);
      setTimeout(() => setSettingsSaved(false), 3000);
      void checkConn(apiUrl);
    } catch (e) {
      setSettingsError(e instanceof Error ? e.message : 'Lưu thất bại');
    } finally {
      setSavingSettings(false);
    }
  };

  const flash = (msg: string) => {
    setMutSuccess(msg);
    setTimeout(() => setMutSuccess(null), 3000);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMutState('saving');
    setMutError(null);
    try {
      const url = editingRule ? `${apiUrl}/api/rules/${editingRule.id}` : `${apiUrl}/api/rules`;
      const r = await fetch(url, {
        method: editingRule ? 'PUT' : 'POST',
        headers: headers(),
        body: JSON.stringify(form)
      });
      if (!r.ok) {
        const d = await r.json().catch(() => ({}));
        throw new Error((d as { error?: string }).error || `HTTP ${r.status}`);
      }
      flash(editingRule ? 'Đã cập nhật rule.' : 'Đã thêm rule mới.');
      resetForm();
      void fetchRules();
    } catch (e) {
      setMutError(e instanceof Error ? e.message : 'Lưu thất bại');
    } finally {
      setMutState('idle');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Xóa rule này?')) return;
    setMutState('deleting');
    setMutError(null);
    try {
      const r = await fetch(`${apiUrl}/api/rules/${id}`, { method: 'DELETE', headers: headers() });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      flash('Đã xóa rule.');
      void fetchRules();
    } catch (e) {
      setMutError(e instanceof Error ? e.message : 'Xóa thất bại');
    } finally {
      setMutState('idle');
    }
  };

  const handleToggle = async (rule: Rule) => {
    setMutState('toggling');
    setMutError(null);
    try {
      const r = await fetch(`${apiUrl}/api/rules/${rule.id}`, {
        method: 'PUT',
        headers: headers(),
        body: JSON.stringify({ active: !rule.active })
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      void fetchRules();
    } catch (e) {
      setMutError(e instanceof Error ? e.message : 'Cập nhật thất bại');
    } finally {
      setMutState('idle');
    }
  };

  const resetForm = () => {
    setEditingRule(null);
    setForm({
      name: '',
      type: 'instruction',
      scope: 'pccc',
      content: '',
      priority: 5,
      active: true
    });
  };

  const startEdit = (rule: Rule) => {
    setEditingRule(rule);
    setForm({
      name: rule.name,
      type: rule.type,
      scope: rule.scope || 'pccc',
      content: rule.content,
      priority: rule.priority,
      active: rule.active
    });
  };

  const updatePackage = (id: string, field: keyof ServicePackage, value: string | boolean | string[]) => {
    setServiceData((prev) => ({
      ...prev,
      packages: prev.packages.map((pkg) => (pkg.id === id ? { ...pkg, [field]: value } : pkg))
    }));
  };

  const updateAdditionalService = (id: string, field: keyof AdditionalService, value: string) => {
    setServiceData((prev) => ({
      ...prev,
      additionalServices: prev.additionalServices.map((service) => (
        service.id === id ? { ...service, [field]: value } : service
      ))
    }));
  };

  const setRecommendedPackage = (id: string) => {
    setServiceData((prev) => ({
      ...prev,
      packages: prev.packages.map((pkg) => ({
        ...pkg,
        recommended: pkg.id === id
      }))
    }));
  };

  const addPackage = () => {
    setServiceData((prev) => ({
      ...prev,
      packages: [...prev.packages, createEmptyPackage()]
    }));
  };

  const removePackage = (id: string) => {
    setServiceData((prev) => ({
      ...prev,
      packages: prev.packages.filter((pkg) => pkg.id !== id)
    }));
  };

  const addAdditionalService = () => {
    setServiceData((prev) => ({
      ...prev,
      additionalServices: [...prev.additionalServices, createEmptyAdditionalService()]
    }));
  };

  const removeAdditionalService = (id: string) => {
    setServiceData((prev) => ({
      ...prev,
      additionalServices: prev.additionalServices.filter((service) => service.id !== id)
    }));
  };

  const saveServices = async () => {
    setServiceLoading(true);
    setServiceError(null);
    setServiceSaved(null);
    try {
      const sanitized = {
        packages: serviceData.packages.map((pkg) => ({
          ...pkg,
          name: pkg.name.trim(),
          price: pkg.price.trim(),
          duration: pkg.duration.trim(),
          color: pkg.color.trim() || 'blue',
          features: pkg.features.map((feature) => feature.trim()).filter(Boolean)
        })),
        additionalServices: serviceData.additionalServices.map((service) => ({
          ...service,
          icon: service.icon.trim() || '📌',
          title: service.title.trim(),
          description: service.description.trim(),
          price: service.price.trim()
        }))
      };

      const r = await fetch(`${apiUrl}/api/service-packages`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(sanitized)
      });

      if (!r.ok) {
        const d = await r.json().catch(() => ({}));
        throw new Error((d as { error?: string }).error || `HTTP ${r.status}`);
      }

      const d = await r.json() as ServicePackagesResponse;
      setServiceData({
        packages: Array.isArray(d.packages) ? d.packages : [],
        additionalServices: Array.isArray(d.additionalServices) ? d.additionalServices : []
      });
      setServiceSaved('Đã lưu dữ liệu dịch vụ.');
      setTimeout(() => setServiceSaved(null), 3000);
    } catch (e) {
      setServiceError(e instanceof Error ? e.message : 'Lưu dữ liệu dịch vụ thất bại');
    } finally {
      setServiceLoading(false);
    }
  };

  const pcccRules = useMemo(
    () => rules.filter((rule) => (rule.scope || 'pccc') === 'pccc'),
    [rules]
  );
  const salesRules = useMemo(
    () => rules.filter((rule) => (rule.scope || 'pccc') === 'sales'),
    [rules]
  );

  const renderRuleSection = (title: string, scope: 'pccc' | 'sales', sectionRules: Rule[]) => (
    <div className="a-card" style={{ padding: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div>
          <p className="a-section-title" style={{ marginBottom: 4 }}>{title}</p>
          <p style={{ fontSize: 12, color: 'var(--a-text-3)' }}>{SCOPE_META[scope].description}</p>
        </div>
        <ScopeBadge scope={scope} />
      </div>

      {sectionRules.length === 0 ? (
        <div className="a-empty" style={{ minHeight: 120 }}>
          <span style={{ fontSize: 28, marginBottom: 8 }}>📭</span>
          <p style={{ fontWeight: 600, color: 'var(--a-text-2)' }}>Chưa có rule</p>
          <p style={{ fontSize: 12, color: 'var(--a-text-3)', marginTop: 4 }}>Tạo rule mới ở khung bên trái.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {sectionRules.map((rule) => (
            <div key={rule.id} className="a-rule-row" data-inactive={!rule.active}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 4 }}>
                    <span style={{ fontWeight: 600, fontSize: 13, color: 'var(--a-text)' }}>{rule.name}</span>
                    <span className={`a-badge ${TYPE_META[rule.type].color}`}>{TYPE_META[rule.type].label}</span>
                    <span style={{ fontSize: 11, color: 'var(--a-text-4)' }}>P{rule.priority}</span>
                  </div>
                  <p style={{ fontSize: 12, color: 'var(--a-text-3)', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                    {rule.content}
                  </p>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 6, marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--a-border)' }}>
                <button
                  className={`a-btn ${rule.active ? 'a-btn-secondary' : 'a-btn-ghost'}`}
                  style={{ fontSize: 11, padding: '3px 10px' }}
                  onClick={() => void handleToggle(rule)}
                  disabled={mutState === 'toggling'}
                >
                  {mutState === 'toggling' ? <Spin /> : rule.active ? '● Active' : '○ Inactive'}
                </button>
                <button className="a-btn a-btn-secondary" style={{ fontSize: 11, padding: '3px 10px' }} onClick={() => startEdit(rule)}>
                  ✏ Sửa
                </button>
                <button
                  className="a-btn a-btn-danger"
                  style={{ fontSize: 11, padding: '3px 10px', marginLeft: 'auto' }}
                  onClick={() => void handleDelete(rule.id)}
                  disabled={mutState === 'deleting'}
                >
                  {mutState === 'deleting' ? <Spin /> : '🗑'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  return (
    <div>
      <Navigation />
      <div className="a-shell">
      <header className="a-topbar">
        <a href="/" className="a-topbar-brand">
          <span className="a-topbar-icon">🔥</span>
          PCCC Admin
        </a>
        <div className="flex items-center gap-3">
          <span className={`a-status a-status--${conn}`}>
            <span className="a-status-dot" />
            {conn === 'checking' ? 'Đang kiểm tra…' : conn === 'connected' ? 'Đã kết nối' : 'Mất kết nối'}
          </span>
          <a href="/" className="a-btn a-btn-ghost" style={{ fontSize: 12 }}>← Về chat</a>
        </div>
      </header>

      <main className="a-main">
        <nav className="a-tabs">
          <button className="a-tab" data-active={tab === 'settings'} onClick={() => setTab('settings')}>
            ⚙️ Cài đặt
          </button>
          <button className="a-tab" data-active={tab === 'rules'} onClick={() => setTab('rules')}>
            📋 Rules{rules.length ? ` (${rules.length})` : ''}
          </button>
          <button className="a-tab" data-active={tab === 'services'} onClick={() => setTab('services')}>
            🧰 Dịch vụ{serviceData.packages.length ? ` (${serviceData.packages.length})` : ''}
          </button>
        </nav>

        {tab === 'settings' && (
          <div className="a-card" style={{ padding: 24, maxWidth: 520 }}>
            <p className="a-section-title">Cài đặt hệ thống</p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label className="a-label">URL máy chủ</label>
                <input className="a-input" value={apiUrl} onChange={(e) => setApiUrl(e.target.value)} placeholder="http://localhost:8888" />
              </div>

              <div>
                <label className="a-label">
                  API Key
                  {keyStatus === 'checking' && <span style={{ marginLeft: 8, fontSize: 11, color: 'var(--a-text-4)', fontWeight: 400 }}>Đang kiểm tra…</span>}
                  {keyStatus === 'valid' && <span style={{ marginLeft: 8, fontSize: 11, color: 'var(--a-success)', fontWeight: 400 }}>✓ Hợp lệ</span>}
                  {keyStatus === 'invalid' && <span style={{ marginLeft: 8, fontSize: 11, color: 'var(--a-danger)', fontWeight: 400 }}>✕ Không hợp lệ</span>}
                </label>
                <input
                  className="a-input"
                  type="password"
                  autoComplete="new-password"
                  value={apiKey}
                  data-success={keyStatus === 'valid'}
                  data-error={keyStatus === 'invalid'}
                  onChange={(e) => {
                    setApiKey(e.target.value);
                    setKeyStatus('idle');
                  }}
                  placeholder="Nhập API Key để kích hoạt chatbot"
                />
                <p style={{ fontSize: 11, color: 'var(--a-text-4)', marginTop: 4 }}>
                  {apiKey ? '••••••••' : 'Chưa cấu hình'} · Lấy key từ Bridge Admin Dashboard
                </p>
              </div>

              {settingsError && (
                <div className="a-alert a-alert-error">
                  <span>⚠</span><span>{settingsError}</span>
                </div>
              )}
              {settingsSaved && (
                <div className="a-alert a-alert-success">
                  <span>✓</span><span>Đã lưu cài đặt thành công.</span>
                </div>
              )}

              <button className="a-btn a-btn-primary" onClick={saveSettings} disabled={savingSettings} style={{ width: '100%', padding: '10px 16px' }}>
                {savingSettings ? <><Spin /> Đang lưu…</> : '💾 Lưu cài đặt'}
              </button>
            </div>
          </div>
        )}

        {tab === 'rules' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.25fr', gap: 20, alignItems: 'start' }}>
            <div className="a-card" style={{ padding: 20 }}>
              <p className="a-section-title">{editingRule ? 'Chỉnh sửa Rule' : 'Thêm Rule mới'}</p>
              <div
                style={{
                  marginBottom: 14,
                  padding: '12px 14px',
                  borderRadius: 12,
                  background: SCOPE_META[form.scope].bg,
                  border: `1px solid ${SCOPE_META[form.scope].border}`
                }}
              >
                <div style={{ fontSize: 12, fontWeight: 700, color: SCOPE_META[form.scope].color }}>
                  {form.scope === 'sales' ? 'Nhóm Sale dịch vụ' : 'Nhóm Tư vấn PCCC'}
                </div>
                <div style={{ marginTop: 4, fontSize: 12, color: 'var(--a-text-3)' }}>
                  {SCOPE_META[form.scope].description}
                </div>
              </div>

              {!editingRule && (
                <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
                  <button type="button" className="a-btn a-btn-secondary" onClick={() => setForm(SALES_ROLE_TEMPLATE)}>
                    Nạp mẫu role bán gói dịch vụ
                  </button>
                  <button type="button" className="a-btn a-btn-secondary" onClick={() => setForm(PCCC_TEMPLATE)}>
                    Nạp mẫu tư vấn PCCC
                  </button>
                </div>
              )}

              {mutError && <div className="a-alert a-alert-error" style={{ marginBottom: 12 }}><span>⚠</span><span>{mutError}</span></div>}
              {mutSuccess && <div className="a-alert a-alert-success" style={{ marginBottom: 12 }}><span>✓</span><span>{mutSuccess}</span></div>}

              <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div>
                  <label className="a-label">Tên Rule <span style={{ color: 'var(--a-danger)' }}>*</span></label>
                  <input className="a-input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required placeholder="VD: Vai trò chuyên gia PCCC" />
                </div>

                <div>
                  <label className="a-label">Loại</label>
                  <select className="a-input" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as Rule['type'] })}>
                    <option value="system">Vai trò (System)</option>
                    <option value="context">Kiến thức (Context)</option>
                    <option value="instruction">Hướng dẫn (Instruction)</option>
                  </select>
                </div>

                <div>
                  <label className="a-label">Nhóm chỉnh sửa</label>
                  <select className="a-input" value={form.scope} onChange={(e) => setForm({ ...form, scope: e.target.value as 'pccc' | 'sales' })}>
                    <option value="pccc">Tư vấn PCCC</option>
                    <option value="sales">Sale dịch vụ</option>
                  </select>
                </div>

                <div>
                  <label className="a-label">Nội dung <span style={{ color: 'var(--a-danger)' }}>*</span></label>
                  <textarea className="a-input" style={{ minHeight: 110, resize: 'vertical' }} value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} required placeholder="Nhập nội dung rule…" />
                </div>

                <div>
                  <label className="a-label">Độ ưu tiên <span style={{ color: 'var(--a-text-4)', fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>(1 = cao nhất)</span></label>
                  <input className="a-input" type="number" min={1} max={10} value={form.priority} onChange={(e) => setForm({ ...form, priority: Number(e.target.value) })} />
                </div>

                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', userSelect: 'none' }}>
                  <input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} style={{ width: 15, height: 15, accentColor: 'var(--a-brand)' }} />
                  <span style={{ fontSize: 13, color: 'var(--a-text-2)' }}>Kích hoạt ngay</span>
                </label>

                <div style={{ display: 'flex', gap: 8 }}>
                  <button type="submit" className="a-btn a-btn-primary" disabled={mutState === 'saving'} style={{ flex: 1 }}>
                    {mutState === 'saving' ? <><Spin />{editingRule ? 'Đang lưu…' : 'Đang thêm…'}</> : editingRule ? 'Cập nhật' : 'Thêm mới'}
                  </button>
                  {editingRule && (
                    <button type="button" className="a-btn a-btn-secondary" onClick={resetForm}>Hủy</button>
                  )}
                </div>
              </form>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              <div className="a-card" style={{ padding: 20 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                  <div>
                    <p className="a-section-title" style={{ marginBottom: 4 }}>Phân khu Rules</p>
                    <p style={{ fontSize: 12, color: 'var(--a-text-3)' }}>
                      Tách rõ 2 mạch: chuyên môn PCCC và sale dịch vụ.
                    </p>
                  </div>
                  <button className="a-btn a-btn-ghost" onClick={() => void fetchRules()} disabled={rulesLoading} style={{ fontSize: 12, padding: '4px 10px' }}>
                    {rulesLoading ? <Spin /> : '↻'} Làm mới
                  </button>
                </div>

                {!rulesLoading && rulesError && (
                  <div className="a-alert a-alert-error">
                    <span>⚠</span>
                    <div>
                      <p style={{ fontWeight: 600 }}>Không tải được rules</p>
                      <p style={{ marginTop: 2 }}>{rulesError}</p>
                      <button className="a-btn a-btn-secondary" onClick={() => void fetchRules()} style={{ marginTop: 8, fontSize: 12 }}>Thử lại</button>
                    </div>
                  </div>
                )}

                {rulesLoading && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {[1, 2, 3].map((i) => <div key={i} className="a-skeleton" style={{ height: 72 }} />)}
                  </div>
                )}

                {!rulesLoading && !rulesError && rules.length === 0 && (
                  <div className="a-empty">
                    <span style={{ fontSize: 32, marginBottom: 8 }}>📋</span>
                    <p style={{ fontWeight: 600, color: 'var(--a-text-2)' }}>Chưa có rule nào</p>
                    <p style={{ fontSize: 12, color: 'var(--a-text-3)', marginTop: 4 }}>Thêm rule đầu tiên ở form bên trái.</p>
                  </div>
                )}
              </div>

              {!rulesLoading && !rulesError && rules.length > 0 && (
                <>
                  {renderRuleSection('Tư vấn PCCC', 'pccc', pcccRules)}
                  {renderRuleSection('Sale gói dịch vụ', 'sales', salesRules)}
                </>
              )}
            </div>
          </div>
        )}

        {tab === 'services' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div className="a-card" style={{ padding: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', marginBottom: 16, flexWrap: 'wrap' }}>
                <div>
                  <p className="a-section-title" style={{ marginBottom: 4 }}>Quản lý trang dịch vụ</p>
                  <p style={{ fontSize: 12, color: 'var(--a-text-3)' }}>Dữ liệu được lưu trong JSON và render ngoài trang `/dich-vu`.</p>
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <button className="a-btn a-btn-ghost" onClick={() => void fetchServicePackages()} disabled={serviceLoading}>
                    {serviceLoading ? <Spin /> : '↻'} Tải lại
                  </button>
                  <button className="a-btn a-btn-primary" onClick={() => void saveServices()} disabled={serviceLoading}>
                    {serviceLoading ? <><Spin /> Đang lưu…</> : '💾 Lưu dịch vụ'}
                  </button>
                </div>
              </div>

              {serviceError && <div className="a-alert a-alert-error" style={{ marginBottom: 12 }}><span>⚠</span><span>{serviceError}</span></div>}
              {serviceSaved && <div className="a-alert a-alert-success" style={{ marginBottom: 12 }}><span>✓</span><span>{serviceSaved}</span></div>}

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <p className="a-section-title" style={{ marginBottom: 0 }}>Gói dịch vụ chính</p>
                <button className="a-btn a-btn-secondary" onClick={addPackage}>+ Thêm gói</button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {serviceData.packages.map((pkg, index) => (
                  <div key={pkg.id} className="a-rule-row">
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 12 }}>
                      <div>
                        <label className="a-label">Tên gói</label>
                        <input className="a-input" value={pkg.name} onChange={(e) => updatePackage(pkg.id, 'name', e.target.value)} />
                      </div>
                      <div>
                        <label className="a-label">ID</label>
                        <input className="a-input" value={pkg.id} onChange={(e) => updatePackage(pkg.id, 'id', e.target.value)} />
                      </div>
                      <div>
                        <label className="a-label">Giá</label>
                        <input className="a-input" value={pkg.price} onChange={(e) => updatePackage(pkg.id, 'price', e.target.value)} />
                      </div>
                      <div>
                        <label className="a-label">Thời lượng</label>
                        <input className="a-input" value={pkg.duration} onChange={(e) => updatePackage(pkg.id, 'duration', e.target.value)} />
                      </div>
                      <div>
                        <label className="a-label">Màu</label>
                        <select className="a-input" value={pkg.color} onChange={(e) => updatePackage(pkg.id, 'color', e.target.value)}>
                          <option value="blue">Blue</option>
                          <option value="red">Red</option>
                          <option value="orange">Orange</option>
                          <option value="purple">Purple</option>
                        </select>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'end' }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', userSelect: 'none' }}>
                          <input
                            type="radio"
                            checked={Boolean(pkg.recommended)}
                            onChange={() => setRecommendedPackage(pkg.id)}
                            name="recommended-package"
                            style={{ width: 15, height: 15, accentColor: 'var(--a-brand)' }}
                          />
                          <span style={{ fontSize: 13, color: 'var(--a-text-2)' }}>Ghim gói recommend</span>
                        </label>
                      </div>
                    </div>

                    <div style={{ marginTop: 12 }}>
                      <label className="a-label">Tính năng (mỗi dòng một mục)</label>
                      <textarea
                        className="a-input"
                        style={{ minHeight: 120, resize: 'vertical' }}
                        value={pkg.features.join('\n')}
                        onChange={(e) => updatePackage(pkg.id, 'features', e.target.value.split('\n'))}
                      />
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--a-border)' }}>
                      <span style={{ fontSize: 12, color: 'var(--a-text-4)' }}>Gói #{index + 1}</span>
                      <button className="a-btn a-btn-danger" onClick={() => removePackage(pkg.id)}>Xóa gói</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="a-card" style={{ padding: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <p className="a-section-title" style={{ marginBottom: 0 }}>Dịch vụ bổ sung</p>
                <button className="a-btn a-btn-secondary" onClick={addAdditionalService}>+ Thêm dịch vụ</button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {serviceData.additionalServices.map((service) => (
                  <div key={service.id} className="a-rule-row">
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 12 }}>
                      <div>
                        <label className="a-label">Tên dịch vụ</label>
                        <input className="a-input" value={service.title} onChange={(e) => updateAdditionalService(service.id, 'title', e.target.value)} />
                      </div>
                      <div>
                        <label className="a-label">ID</label>
                        <input className="a-input" value={service.id} onChange={(e) => updateAdditionalService(service.id, 'id', e.target.value)} />
                      </div>
                      <div>
                        <label className="a-label">Icon</label>
                        <input className="a-input" value={service.icon} onChange={(e) => updateAdditionalService(service.id, 'icon', e.target.value)} />
                      </div>
                      <div>
                        <label className="a-label">Giá</label>
                        <input className="a-input" value={service.price} onChange={(e) => updateAdditionalService(service.id, 'price', e.target.value)} />
                      </div>
                    </div>

                    <div style={{ marginTop: 12 }}>
                      <label className="a-label">Mô tả</label>
                      <textarea
                        className="a-input"
                        style={{ minHeight: 90, resize: 'vertical' }}
                        value={service.description}
                        onChange={(e) => updateAdditionalService(service.id, 'description', e.target.value)}
                      />
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--a-border)' }}>
                      <button className="a-btn a-btn-danger" onClick={() => removeAdditionalService(service.id)}>Xóa dịch vụ</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </main>
      </div>
    </div>
  );
}
