'use client';
import './admin.css';
import { useState, useEffect, useCallback } from 'react';

/* ── Types ── */
interface Rule {
  id: string; name: string;
  type: 'system' | 'context' | 'instruction';
  content: string; priority: number;
  active: boolean; createdAt: string; updatedAt: string;
}
type ConnStatus = 'checking' | 'connected' | 'disconnected';
type KeyStatus  = 'idle' | 'checking' | 'valid' | 'invalid';
type MutState   = 'idle' | 'saving' | 'deleting' | 'toggling';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8888';

const TYPE_META = {
  system:      { label: 'Vai trò',    color: 'a-badge-brand'   },
  context:     { label: 'Kiến thức',  color: 'a-badge-success' },
  instruction: { label: 'Hướng dẫn', color: 'a-badge-warn'    },
};

/* ── Spinner SVG ── */
const Spin = () => (
  <svg className="a-spin" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
    <circle cx="12" cy="12" r="10" strokeOpacity=".25"/>
    <path d="M12 2a10 10 0 0 1 10 10" strokeLinecap="round"/>
  </svg>
);

/* ── Main ── */
export default function AdminPage() {
  const [tab, setTab]                   = useState<'settings' | 'rules'>('settings');
  const [rules, setRules]               = useState<Rule[]>([]);
  const [rulesLoading, setRulesLoading] = useState(false);
  const [rulesError, setRulesError]     = useState<string | null>(null);
  const [conn, setConn]                 = useState<ConnStatus>('checking');
  const [keyStatus, setKeyStatus]       = useState<KeyStatus>('idle');
  const [apiUrl, setApiUrl]             = useState(API_URL);
  const [apiKey, setApiKey]             = useState('');
  const [settingsSaved, setSettingsSaved] = useState(false);
  const [settingsError, setSettingsError] = useState<string | null>(null);
  const [savingSettings, setSavingSettings] = useState(false);
  const [editingRule, setEditingRule]   = useState<Rule | null>(null);
  const [mutState, setMutState]         = useState<MutState>('idle');
  const [mutError, setMutError]         = useState<string | null>(null);
  const [mutSuccess, setMutSuccess]     = useState<string | null>(null);
  const [form, setForm] = useState({ name: '', type: 'instruction' as Rule['type'], content: '', priority: 5, active: true });

  /* Load from localStorage */
  useEffect(() => {
    const url = localStorage.getItem('pccc_api_url') || API_URL;
    const key = localStorage.getItem('pccc_bridge_api_key') || '';
    setApiUrl(url); setApiKey(key);
    checkConn(url);
  }, []);

  const headers = useCallback(() => {
    const h: Record<string, string> = { 'Content-Type': 'application/json' };
    if (apiKey) h['X-Bridge-API-Key'] = apiKey;
    return h;
  }, [apiKey]);

  const checkConn = async (url: string) => {
    setConn('checking');
    try {
      const r = await fetch(`${url}/health`);
      setConn(r.ok ? 'connected' : 'disconnected');
    } catch { setConn('disconnected'); }
  };

  const fetchRules = useCallback(async () => {
    if (!apiUrl) return;
    setRulesLoading(true); setRulesError(null);
    try {
      const r = await fetch(`${apiUrl}/api/rules`, { headers: headers() });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const d = await r.json();
      setRules(d.rules || []);
    } catch (e) {
      setRulesError(e instanceof Error ? e.message : 'Không tải được danh sách rules');
    } finally { setRulesLoading(false); }
  }, [apiUrl, headers]);

  useEffect(() => { if (conn === 'connected') fetchRules(); }, [conn]);

  /* ── Settings save ── */
  const saveSettings = async () => {
    setSavingSettings(true); setSettingsError(null); setSettingsSaved(false);
    try {
      localStorage.setItem('pccc_api_url', apiUrl);
      if (apiKey) localStorage.setItem('pccc_bridge_api_key', apiKey);
      else localStorage.removeItem('pccc_bridge_api_key');

      // Validate key
      if (apiKey) {
        setKeyStatus('checking');
        const r = await fetch(`${apiUrl}/api/settings/bridge-status`, {
          headers: { 'Content-Type': 'application/json', 'X-Bridge-API-Key': apiKey }
        });
        const d = await r.json().catch(() => ({})) as { connected?: boolean };
        setKeyStatus(d.connected ? 'valid' : 'invalid');
        if (!d.connected) { setSettingsError('API Key không hợp lệ hoặc máy chủ AI chưa sẵn sàng.'); setSavingSettings(false); return; }
      }

      // Persist key to server
      if (apiKey) {
        await fetch(`${apiUrl}/api/settings/bridge-key`, {
          method: 'PUT', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ key: apiKey })
        }).catch(() => {});
      }

      setSettingsSaved(true);
      setTimeout(() => setSettingsSaved(false), 3000);
      checkConn(apiUrl);
    } catch (e) {
      setSettingsError(e instanceof Error ? e.message : 'Lưu thất bại');
    } finally { setSavingSettings(false); }
  };

  /* ── Rule mutations ── */
  const flash = (msg: string) => { setMutSuccess(msg); setTimeout(() => setMutSuccess(null), 3000); };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMutState('saving'); setMutError(null);
    try {
      const url = editingRule ? `${apiUrl}/api/rules/${editingRule.id}` : `${apiUrl}/api/rules`;
      const r = await fetch(url, { method: editingRule ? 'PUT' : 'POST', headers: headers(), body: JSON.stringify(form) });
      if (!r.ok) { const d = await r.json().catch(() => ({})); throw new Error((d as {error?:string}).error || `HTTP ${r.status}`); }
      flash(editingRule ? 'Đã cập nhật rule.' : 'Đã thêm rule mới.');
      resetForm(); fetchRules();
    } catch (e) { setMutError(e instanceof Error ? e.message : 'Lưu thất bại'); }
    finally { setMutState('idle'); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Xóa rule này?')) return;
    setMutState('deleting'); setMutError(null);
    try {
      const r = await fetch(`${apiUrl}/api/rules/${id}`, { method: 'DELETE', headers: headers() });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      flash('Đã xóa rule.'); fetchRules();
    } catch (e) { setMutError(e instanceof Error ? e.message : 'Xóa thất bại'); }
    finally { setMutState('idle'); }
  };

  const handleToggle = async (rule: Rule) => {
    setMutState('toggling'); setMutError(null);
    try {
      const r = await fetch(`${apiUrl}/api/rules/${rule.id}`, { method: 'PUT', headers: headers(), body: JSON.stringify({ active: !rule.active }) });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      fetchRules();
    } catch (e) { setMutError(e instanceof Error ? e.message : 'Cập nhật thất bại'); }
    finally { setMutState('idle'); }
  };

  const resetForm = () => { setEditingRule(null); setForm({ name: '', type: 'instruction', content: '', priority: 5, active: true }); };
  const startEdit = (r: Rule) => { setEditingRule(r); setForm({ name: r.name, type: r.type, content: r.content, priority: r.priority, active: r.active }); };

  /* ── Render ── */
  return (
    <div className="a-shell">
      {/* Top bar */}
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
          <a href="/" className="a-btn a-btn-ghost" style={{fontSize:12}}>← Về chat</a>
        </div>
      </header>

      <main className="a-main">
        {/* Tabs */}
        <nav className="a-tabs">
          {(['settings', 'rules'] as const).map(t => (
            <button key={t} className="a-tab" data-active={tab === t} onClick={() => setTab(t)}>
              {t === 'settings' ? '⚙️ Cài đặt' : `📋 Rules${rules.length ? ` (${rules.length})` : ''}`}
            </button>
          ))}
        </nav>

        {/* ── Settings Tab ── */}
        {tab === 'settings' && (
          <div className="a-card" style={{padding: 24, maxWidth: 520}}>
            <p className="a-section-title">Cài đặt hệ thống</p>

            <div style={{display:'flex', flexDirection:'column', gap:16}}>
              <div>
                <label className="a-label">URL máy chủ</label>
                <input className="a-input" value={apiUrl} onChange={e => setApiUrl(e.target.value)} placeholder="http://localhost:8888" />
              </div>

              <div>
                <label className="a-label">
                  API Key
                  {keyStatus === 'checking' && <span style={{marginLeft:8, fontSize:11, color:'var(--a-text-4)', fontWeight:400}}>Đang kiểm tra…</span>}
                  {keyStatus === 'valid'    && <span style={{marginLeft:8, fontSize:11, color:'var(--a-success)', fontWeight:400}}>✓ Hợp lệ</span>}
                  {keyStatus === 'invalid'  && <span style={{marginLeft:8, fontSize:11, color:'var(--a-danger)', fontWeight:400}}>✗ Không hợp lệ</span>}
                </label>
                <input
                  className="a-input"
                  type="password"
                  autoComplete="new-password"
                  value={apiKey}
                  data-success={keyStatus === 'valid'}
                  data-error={keyStatus === 'invalid'}
                  onChange={e => { setApiKey(e.target.value); setKeyStatus('idle'); }}
                  placeholder="Nhập API Key để kích hoạt chatbot"
                />
                <p style={{fontSize:11, color:'var(--a-text-4)', marginTop:4}}>
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

              <button className="a-btn a-btn-primary" onClick={saveSettings} disabled={savingSettings} style={{width:'100%', padding:'10px 16px'}}>
                {savingSettings ? <><Spin /> Đang lưu…</> : '💾 Lưu cài đặt'}
              </button>
            

              </div>
          </div>
        )}

        {/* ── Rules Tab ── */}
        {tab === 'rules' && (
          <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:20, alignItems:'start'}}>

            {/* Form */}
            <div className="a-card" style={{padding:20}}>
              <p className="a-section-title">{editingRule ? 'Chỉnh sửa Rule' : 'Thêm Rule mới'}</p>

              {mutError && <div className="a-alert a-alert-error" style={{marginBottom:12}}><span>⚠</span><span>{mutError}</span></div>}
              {mutSuccess && <div className="a-alert a-alert-success" style={{marginBottom:12}}><span>✓</span><span>{mutSuccess}</span></div>}

              <form onSubmit={handleSubmit} style={{display:'flex', flexDirection:'column', gap:14}}>
                <div>
                  <label className="a-label">Tên Rule <span style={{color:'var(--a-danger)'}}>*</span></label>
                  <input className="a-input" value={form.name} onChange={e => setForm({...form, name: e.target.value})} required placeholder="VD: Vai trò chuyên gia PCCC" />
                </div>

                <div>
                  <label className="a-label">Loại</label>
                  <select className="a-input" value={form.type} onChange={e => setForm({...form, type: e.target.value as Rule['type']})}>
                    <option value="system">Vai trò (System)</option>
                    <option value="context">Kiến thức (Context)</option>
                    <option value="instruction">Hướng dẫn (Instruction)</option>
                  </select>
                </div>

                <div>
                  <label className="a-label">Nội dung <span style={{color:'var(--a-danger)'}}>*</span></label>
                  <textarea className="a-input" style={{minHeight:110, resize:'vertical'}} value={form.content} onChange={e => setForm({...form, content: e.target.value})} required placeholder="Nhập nội dung rule…" />
                </div>

                <div>
                  <label className="a-label">Độ ưu tiên <span style={{color:'var(--a-text-4)', fontWeight:400, textTransform:'none', letterSpacing:0}}>(1 = cao nhất)</span></label>
                  <input className="a-input" type="number" min={1} max={10} value={form.priority} onChange={e => setForm({...form, priority: +e.target.value})} />
                </div>

                <label style={{display:'flex', alignItems:'center', gap:8, cursor:'pointer', userSelect:'none'}}>
                  <input type="checkbox" checked={form.active} onChange={e => setForm({...form, active: e.target.checked})} style={{width:15, height:15, accentColor:'var(--a-brand)'}} />
                  <span style={{fontSize:13, color:'var(--a-text-2)'}}>Kích hoạt ngay</span>
                </label>

                <div style={{display:'flex', gap:8}}>
                  <button type="submit" className="a-btn a-btn-primary" disabled={mutState === 'saving'} style={{flex:1}}>
                    {mutState === 'saving' ? <><Spin />{editingRule ? 'Đang lưu…' : 'Đang thêm…'}</> : editingRule ? 'Cập nhật' : 'Thêm mới'}
                  </button>
                  {editingRule && (
                    <button type="button" className="a-btn a-btn-secondary" onClick={resetForm}>Hủy</button>
                  )}
                </div>
              </form>
            </div>

            {/* List */}
            <div className="a-card" style={{padding:20}}>
              <div style={{display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:16}}>
                <p className="a-section-title" style={{marginBottom:0}}>Danh sách Rules</p>
                <button className="a-btn a-btn-ghost" onClick={fetchRules} disabled={rulesLoading} style={{fontSize:12, padding:'4px 10px'}}>
                  {rulesLoading ? <Spin /> : '↻'} Làm mới
                </button>
              </div>

              {/* Loading */}
              {rulesLoading && (
                <div style={{display:'flex', flexDirection:'column', gap:10}}>
                  {[1,2,3].map(i => <div key={i} className="a-skeleton" style={{height:72}} />)}
                </div>
              )}

              {/* Error */}
              {!rulesLoading && rulesError && (
                <div className="a-alert a-alert-error">
                  <span>⚠</span>
                  <div>
                    <p style={{fontWeight:600}}>Không tải được rules</p>
                    <p style={{marginTop:2}}>{rulesError}</p>
                    <button className="a-btn a-btn-secondary" onClick={fetchRules} style={{marginTop:8, fontSize:12}}>Thử lại</button>
                  </div>
                </div>
              )}

              {/* Empty */}
              {!rulesLoading && !rulesError && rules.length === 0 && (
                <div className="a-empty">
                  <span style={{fontSize:32, marginBottom:8}}>📋</span>
                  <p style={{fontWeight:600, color:'var(--a-text-2)'}}>Chưa có rule nào</p>
                  <p style={{fontSize:12, color:'var(--a-text-3)', marginTop:4}}>Thêm rule đầu tiên ở form bên trái.</p>
                </div>
              )}

              {/* List */}
              {!rulesLoading && !rulesError && rules.length > 0 && (
                <div style={{display:'flex', flexDirection:'column', gap:8}}>
                  {rules.map(rule => (
                    <div key={rule.id} className="a-rule-row" data-inactive={!rule.active}>
                      <div style={{display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:8}}>
                        <div style={{flex:1, minWidth:0}}>
                          <div style={{display:'flex', alignItems:'center', gap:6, flexWrap:'wrap', marginBottom:4}}>
                            <span style={{fontWeight:600, fontSize:13, color:'var(--a-text)'}}>{rule.name}</span>
                            <span className={`a-badge ${TYPE_META[rule.type].color}`}>{TYPE_META[rule.type].label}</span>
                            <span style={{fontSize:11, color:'var(--a-text-4)'}}>P{rule.priority}</span>
                          </div>
                          <p style={{fontSize:12, color:'var(--a-text-3)', overflow:'hidden', display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical'}}>
                            {rule.content}
                          </p>
                        </div>
                      </div>
                      <div style={{display:'flex', gap:6, marginTop:10, paddingTop:10, borderTop:'1px solid var(--a-border)'}}>
                        <button
                          className={`a-btn ${rule.active ? 'a-btn-secondary' : 'a-btn-ghost'}`}
                          style={{fontSize:11, padding:'3px 10px'}}
                          onClick={() => handleToggle(rule)}
                          disabled={mutState === 'toggling'}
                        >
                          {mutState === 'toggling' ? <Spin /> : rule.active ? '● Active' : '○ Inactive'}
                        </button>
                        <button className="a-btn a-btn-secondary" style={{fontSize:11, padding:'3px 10px'}} onClick={() => startEdit(rule)}>
                          ✏ Sửa
                        </button>
                        <button
                          className="a-btn a-btn-danger"
                          style={{fontSize:11, padding:'3px 10px', marginLeft:'auto'}}
                          onClick={() => handleDelete(rule.id)}
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
          </div>
        )}
      </main>
    </div>
  );
}
