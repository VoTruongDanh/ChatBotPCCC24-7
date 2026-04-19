'use client';
import { useState, useEffect, useRef } from 'react';
import { Save, RefreshCw, Loader2, Globe, Monitor, Cpu, AlertTriangle } from 'lucide-react';
import type { BridgeConfig } from './types';

interface Props {
  config: BridgeConfig | null;
  configForm: Partial<BridgeConfig>;
  saving: boolean;
  onFormChange: (patch: Partial<BridgeConfig>) => void;
  onSave: () => void;
  onRefresh: () => void;
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="admin-label">{label}</label>
      {children}
      {hint && <p className="admin-hint">{hint}</p>}
    </div>
  );
}

function SectionHead({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <div className="flex items-center gap-2 mb-4 pb-3" style={{ borderBottom: '1px solid var(--c-border)' }}>
      <span style={{ color: 'var(--c-accent)' }}>{icon}</span>
      <p className="text-sm font-semibold" style={{ color: 'var(--c-text)' }}>{title}</p>
    </div>
  );
}

export default function TabConfig({ config, configForm, saving, onFormChange, onSave, onRefresh }: Props) {
  const [dirty, setDirty] = useState(false);
  const isFirstRender = useRef(true);

  // Track dirty state — bỏ qua lần đầu khi config load vào form
  useEffect(() => {
    if (isFirstRender.current) { isFirstRender.current = false; return; }
    setDirty(true);
  }, [configForm]);

  // Reset dirty sau khi save thành công hoặc refresh
  useEffect(() => {
    if (!saving) setDirty(false);
  }, [config]); // eslint-disable-line react-hooks/exhaustive-deps

  const set = (patch: Partial<BridgeConfig>) => onFormChange(patch);

  const handleSave = () => { onSave(); setDirty(false); };

  if (!config) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4 text-center">
        <p className="text-sm font-semibold" style={{ color: 'var(--c-text-2)' }}>Chưa tải được cấu hình</p>
        <p className="text-xs max-w-sm" style={{ color: 'var(--c-text-3)' }}>
          Kiểm tra be-bridge đang chạy, URL API và Admin API Key.
        </p>
        <button className="admin-btn-secondary" onClick={onRefresh}>
          <RefreshCw className="h-4 w-4" /> Thử tải lại
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="admin-section-title"><Globe className="h-4 w-4" />Cấu hình hệ thống</p>
          <p className="admin-section-desc">Thay đổi sẽ ghi vào .env be-bridge · cần restart để áp dụng</p>
        </div>
        {/* Unsaved indicator */}
        {dirty && !saving && (
          <div className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium shrink-0"
            style={{ background: 'var(--c-warn-bg)', color: 'var(--c-warn-txt)', border: '1px solid var(--c-warn-bd)' }}>
            <AlertTriangle className="h-3.5 w-3.5" />
            Chưa lưu
          </div>
        )}
      </div>

      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        {/* Basic */}
        <div className="admin-panel">
          <SectionHead icon={<Globe className="h-4 w-4" />} title="Cài đặt cơ bản" />
          <div className="space-y-4">
            <Field label="Host">
              <input className="admin-input" value={configForm.HOST ?? ''} onChange={e => set({ HOST: e.target.value })} />
            </Field>
            <Field label="Port">
              <input className="admin-input" type="number" value={configForm.PORT ?? 1110} onChange={e => set({ PORT: +e.target.value })} />
            </Field>
            <Field label="Số Workers" hint="Số tab ChatGPT song song (1–10)">
              <input className="admin-input" type="number" min={1} max={10} value={configForm.NUM_WORKERS ?? 2} onChange={e => set({ NUM_WORKERS: +e.target.value })} />
            </Field>
          </div>
        </div>

        {/* Browser */}
        <div className="admin-panel">
          <SectionHead icon={<Monitor className="h-4 w-4" />} title="Cài đặt Browser" />
          <div className="space-y-4">
            <Field label="Trình duyệt ưu tiên">
              <select className="admin-select" value={configForm.PREFERRED_BROWSER ?? 'chrome'} onChange={e => set({ PREFERRED_BROWSER: e.target.value })}>
                <option value="chrome">Chrome</option>
                <option value="edge">Edge</option>
              </select>
            </Field>
            <Field label="Chat URL">
              <input className="admin-input" value={configForm.CHAT_URL ?? ''} onChange={e => set({ CHAT_URL: e.target.value })} />
            </Field>
            <div className="space-y-2.5 pt-1">
              {([
                ['HIDE_WINDOW',      'Ẩn cửa sổ chat'],
                ['LAUNCH_MINIMIZED', 'Khởi chạy thu nhỏ'],
                ['LAUNCH_OFFSCREEN', 'Offscreen mode'],
              ] as [keyof BridgeConfig, string][]).map(([key, label]) => (
                <label key={key} className="flex items-center gap-2.5 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    className="admin-checkbox"
                    checked={Boolean(configForm[key])}
                    onChange={e => set({ [key]: e.target.checked })}
                  />
                  <span className="text-sm" style={{ color: 'var(--c-text-2)' }}>{label}</span>
                </label>
              ))}
            </div>
          </div>
        </div>

        {/* Streaming */}
        <div className="admin-panel">
          <SectionHead icon={<Cpu className="h-4 w-4" />} title="Streaming timeouts" />
          <div className="space-y-4">
            {([
              ['STREAM_NO_CHANGE_THRESHOLD', 'No-change threshold'],
              ['STREAM_FALLBACK_THRESHOLD',  'Fallback threshold'],
              ['STREAM_MAX_TIMEOUT',         'Max timeout (ms)'],
              ['STREAM_START_TIMEOUT',       'Start timeout (ms)'],
              ['STREAM_CHECK_INTERVAL',      'Check interval (ms)'],
            ] as [keyof BridgeConfig, string][]).map(([key, label]) => (
              <Field key={key} label={label}>
                <input className="admin-input" type="number"
                  value={(configForm[key] as number) ?? 0}
                  onChange={e => set({ [key]: +e.target.value })} />
              </Field>
            ))}
          </div>
        </div>
      </div>

      {/* Save bar */}
      <div className="flex items-center gap-3 pt-1">
        <button
          className="admin-btn-primary"
          onClick={handleSave}
          disabled={saving || !dirty}
          aria-busy={saving}
          title={!dirty ? 'Không có thay đổi nào cần lưu' : undefined}
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          {saving ? 'Đang lưu…' : 'Lưu cấu hình'}
        </button>
        {dirty && !saving && (
          <p className="text-xs font-medium" style={{ color: 'var(--c-warn)' }}>
            Có thay đổi chưa được lưu
          </p>
        )}
        {!dirty && !saving && (
          <p className="text-xs" style={{ color: 'var(--c-text-4)' }}>
            Cần restart be-bridge để áp dụng thay đổi
          </p>
        )}
      </div>
    </div>
  );
}

