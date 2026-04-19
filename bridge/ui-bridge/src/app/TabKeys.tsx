'use client';
import { useState } from 'react';
import { Plus, Trash2, Eye, EyeOff, Copy, Check, Loader2, Inbox, Key } from 'lucide-react';
import type { ApiKey } from './types';

interface Props {
  apiKeys: ApiKey[];
  creating: boolean;
  deletingId: string | null;
  togglingId: string | null;
  newKeyName: string;
  onNewKeyNameChange: (v: string) => void;
  onCreate: () => void;
  onDelete: (id: string) => void;
  onToggle: (id: string, active: boolean) => void;
}

function KeyRow({
  k,
  deleting,
  toggling,
  onDelete,
  onToggle,
}: {
  k: ApiKey;
  deleting: boolean;
  toggling: boolean;
  onDelete: () => void;
  onToggle: () => void;
}) {
  const [show, setShow] = useState(false);
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    await navigator.clipboard.writeText(k.key);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="admin-row flex-col items-start gap-3">
      <div className="flex w-full items-center gap-3">
        <span className={`admin-dot ${k.active ? 'admin-dot-success' : 'admin-dot-neutral'}`} />
        <span className="flex-1 text-sm font-medium truncate" style={{color:'var(--c-text)'}}>{k.name}</span>
        <span className={k.active ? 'admin-badge-success' : 'admin-badge-neutral'}>
          {k.active ? 'Active' : 'Inactive'}
        </span>
        <div className="flex items-center gap-1.5 shrink-0">
          <button className="admin-icon-btn" title={show ? 'Ẩn key' : 'Hiện key'} onClick={() => setShow(v => !v)}>
            {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
          <button className="admin-icon-btn" title="Sao chép" onClick={copy}>
            {copied ? <Check className="h-4 w-4" style={{color:'var(--c-success)'}} /> : <Copy className="h-4 w-4" />}
          </button>
          <button
            className="admin-btn-secondary text-xs px-3 py-1.5"
            disabled={toggling}
            aria-busy={toggling}
            onClick={onToggle}
          >
            {toggling ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
            {k.active ? 'Vô hiệu' : 'Kích hoạt'}
          </button>
          <button
            className="admin-btn-danger text-xs px-2.5 py-1.5"
            disabled={deleting}
            aria-busy={deleting}
            onClick={onDelete}
          >
            {deleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
          </button>
        </div>
      </div>

      {show && (
        <div className="w-full rounded-lg px-3 py-2.5 font-mono text-xs break-all" style={{background:'var(--c-surface-3)', border:'1px solid var(--c-border)', color:'var(--c-text-2)'}}>
          {k.key}
          <p className="mt-1.5 font-sans" style={{color:'var(--c-text-4)'}}>
            Tạo: {new Date(k.createdAt).toLocaleString('vi-VN')}
            {k.lastUsed && ` · Dùng lần cuối: ${new Date(k.lastUsed).toLocaleString('vi-VN')}`}
          </p>
        </div>
      )}
    </div>
  );
}

export default function TabKeys({ apiKeys, creating, deletingId, togglingId, newKeyName, onNewKeyNameChange, onCreate, onDelete, onToggle }: Props) {
  return (
    <div className="space-y-6">
      <div>
        <p className="admin-section-title"><Key className="h-4 w-4" />Quản lý API Keys</p>
        <p className="admin-section-desc">Keys lưu trong RAM bridge · mất khi restart</p>
      </div>

      {/* Create form */}
      <div className="admin-panel">
        <p className="text-xs font-semibold mb-3" style={{color:'var(--c-text-3)'}}>TẠO KEY MỚI</p>
        <div className="flex gap-2">
          <input
            className="admin-input flex-1"
            placeholder="Tên key (vd: Production, be-main)"
            value={newKeyName}
            onChange={e => onNewKeyNameChange(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && onCreate()}
          />
          <button className="admin-btn-primary shrink-0" onClick={onCreate} disabled={creating} aria-busy={creating}>
            {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            {creating ? 'Đang tạo…' : 'Tạo key'}
          </button>
        </div>
      </div>

      {/* List */}
      <div>
        <p className="text-xs font-semibold mb-3" style={{color:'var(--c-text-3)'}}>
          DANH SÁCH ({apiKeys.length})
        </p>
        {apiKeys.length === 0 ? (
          <div className="admin-empty">
            <Inbox className="h-9 w-9 mb-3" style={{color:'var(--c-text-4)'}} />
            <p className="text-sm font-semibold" style={{color:'var(--c-text-2)'}}>Chưa có API key</p>
            <p className="text-xs mt-1" style={{color:'var(--c-text-3)'}}>Tạo key mới ở form phía trên.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {apiKeys.map(k => (
              <KeyRow
                key={k.id}
                k={k}
                deleting={deletingId === k.id}
                toggling={togglingId === k.id}
                onDelete={() => onDelete(k.id)}
                onToggle={() => onToggle(k.id, k.active)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
