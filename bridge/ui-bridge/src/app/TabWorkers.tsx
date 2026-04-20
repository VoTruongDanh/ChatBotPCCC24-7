'use client';
import { Plus, Trash2, Loader2, Inbox, Users, Monitor } from 'lucide-react';
import type { Worker } from './types';

interface Props {
  workers: Worker[];
  browserRunning: boolean;
  addingWorker: boolean;
  removingWorker: boolean;
  browserAction: 'show' | 'hide' | null;
  onAdd: () => void;
  onRemove: () => void;
  onShowBrowser: () => void;
  onHideBrowser: () => void;
}

export default function TabWorkers({
  workers, browserRunning, addingWorker, removingWorker, browserAction,
  onAdd, onRemove, onShowBrowser, onHideBrowser,
}: Props) {
  const idle = workers.filter(w => !w.busy).length;
  const busy = workers.filter(w => w.busy).length;

  return (
    <div className="space-y-6">
      <div>
        <p className="admin-section-title"><Users className="h-4 w-4" />Quản lý Workers</p>
        <p className="admin-section-desc">Mỗi worker = một tab ChatGPT trong Puppeteer</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Tổng', value: workers.length, color: 'var(--c-text)' },
          { label: 'Sẵn sàng', value: idle, color: 'var(--c-success)' },
          { label: 'Đang xử lý', value: busy, color: 'var(--c-warn)' },
        ].map(({ label, value, color }) => (
          <div key={label} className="admin-metric text-center items-center">
            <p className="text-3xl font-bold tabular" style={{ color }}>{value}</p>
            <p className="text-xs" style={{ color: 'var(--c-text-3)' }}>{label}</p>
          </div>
        ))}
      </div>

      {/* Browser control */}
      <div className="admin-panel flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <p className="admin-section-title"><Monitor className="h-4 w-4" />Cửa sổ Puppeteer</p>
          <div className="flex items-center gap-2 mt-1.5">
            <span className={`admin-dot ${browserRunning ? 'admin-dot-success' : 'admin-dot-neutral'}`} />
            <span className="text-xs" style={{ color: 'var(--c-text-3)' }}>
              {browserRunning ? 'Browser đang mở' : 'Chưa báo / đã đóng'}
            </span>
          </div>
        </div>
        <div className="flex gap-2 shrink-0">
          <button
            className="admin-btn-primary"
            disabled={browserAction !== null}
            aria-busy={browserAction === 'show'}
            onClick={onShowBrowser}
          >
            {browserAction === 'show' ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Hiện cửa sổ
          </button>
          <button
            className="admin-btn-secondary"
            disabled={browserAction !== null}
            aria-busy={browserAction === 'hide'}
            onClick={onHideBrowser}
          >
            {browserAction === 'hide' ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Thu nhỏ / ẩn
          </button>
        </div>
      </div>

      {/* Controls */}
      <div className="flex gap-2">
        <button className="admin-btn-primary" onClick={onAdd} disabled={addingWorker} aria-busy={addingWorker}
          style={{ background: 'var(--c-success)' }}>
          {addingWorker ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          {addingWorker ? 'Đang thêm…' : 'Thêm worker'}
        </button>
        <button className="admin-btn-danger" onClick={onRemove}
          disabled={idle === 0 || removingWorker} aria-busy={removingWorker}>
          {removingWorker ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
          {removingWorker ? 'Đang gỡ…' : 'Gỡ worker rảnh'}
        </button>
      </div>

      {/* Worker list */}
      <div>
        <p className="text-xs font-semibold mb-3" style={{ color: 'var(--c-text-3)' }}>
          DANH SÁCH WORKERS ({workers.length})
        </p>
        {workers.length === 0 ? (
          <div className="admin-empty">
            <Inbox className="h-9 w-9 mb-3" style={{ color: 'var(--c-text-4)' }} />
            <p className="text-sm font-semibold" style={{ color: 'var(--c-text-2)' }}>Không có worker trong pool</p>
            <p className="text-xs mt-1" style={{ color: 'var(--c-text-3)' }}>Kiểm tra be-bridge đã khởi động thành công.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {workers.map(w => (
              <div key={w.id} className="admin-row">
                <span className={`admin-dot ${w.busy ? 'admin-dot-warn' : 'admin-dot-success'}`} />
                <span className="font-mono text-xs flex-1" style={{ color: 'var(--c-text-2)' }}>
                  worker-{w.id}
                </span>
                <span className={w.busy ? 'admin-badge-warn' : 'admin-badge-success'}>
                  {w.busy ? 'Đang xử lý' : 'Sẵn sàng'}
                </span>
                {w.lastActivity && (
                  <span className="text-xs hidden sm:inline" style={{ color: 'var(--c-text-4)' }}>
                    {new Date(w.lastActivity).toLocaleTimeString('vi-VN')}
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
