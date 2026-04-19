'use client';
import { RefreshCw, Activity } from 'lucide-react';
import type { SystemStatus } from './types';
import { formatBytes, formatUptime, memPct } from './utils';

interface Props {
  status: SystemStatus | null;
  onRefresh: () => void;
}

function ProgressBar({ pct, color = 'var(--c-accent)' }: { pct: number; color?: string }) {
  const c = pct > 85 ? 'var(--c-danger)' : pct > 65 ? 'var(--c-warn)' : color;
  return (
    <div className="admin-progress-bar">
      <div className="admin-progress-bar-fill" style={{ width: `${pct}%`, background: c }} />
    </div>
  );
}

function StatRow({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="flex items-center justify-between gap-4 py-2" style={{ borderBottom: '1px solid var(--c-border)' }}>
      <span className="text-sm" style={{ color: 'var(--c-text-3)' }}>{label}</span>
      <span className="text-sm font-medium tabular" style={{ color: 'var(--c-text)' }}>
        {value}
        {sub && <span className="ml-1.5 text-xs" style={{ color: 'var(--c-text-4)' }}>{sub}</span>}
      </span>
    </div>
  );
}

export default function TabStatus({ status, onRefresh }: Props) {
  if (!status) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4 text-center">
        <p className="text-sm font-semibold" style={{ color: 'var(--c-text-2)' }}>Chưa có dữ liệu trạng thái</p>
        <p className="text-xs" style={{ color: 'var(--c-text-3)' }}>Kiểm tra kết nối tới be-bridge và Admin API Key.</p>
        <button className="admin-btn-secondary" onClick={onRefresh}>
          <RefreshCw className="h-4 w-4" /> Thử lại
        </button>
      </div>
    );
  }

  const { system, bridge, admin } = status;
  const heapPct = memPct(system.memory.heapUsed, system.memory.heapTotal);
  const rssPct  = memPct(system.memory.rss, system.memory.rss + system.memory.external + 50 * 1024 * 1024);
  const workerBusyPct = bridge.workers.total ? Math.round((bridge.workers.busy / bridge.workers.total) * 100) : 0;

  return (
    <div className="space-y-6">
      <div>
        <p className="admin-section-title"><Activity className="h-4 w-4" />Giám sát hệ thống</p>
        <p className="admin-section-desc">Snapshot realtime từ /admin/status</p>
      </div>

      <div className="grid gap-5 md:grid-cols-2">
        {/* System info */}
        <div className="admin-panel">
          <p className="text-xs font-semibold mb-3" style={{ color: 'var(--c-text-3)' }}>HỆ THỐNG</p>
          <div>
            <StatRow label="Uptime"    value={formatUptime(system.uptime)} />
            <StatRow label="Platform"  value={system.platform} />
            <StatRow label="Node.js"   value={system.nodeVersion} />
            <StatRow label="RSS"       value={formatBytes(system.memory.rss)} />
            <StatRow label="Heap used" value={formatBytes(system.memory.heapUsed)} sub={`/ ${formatBytes(system.memory.heapTotal)}`} />
            <StatRow label="External"  value={formatBytes(system.memory.external)} />
          </div>
        </div>

        {/* Bridge info */}
        <div className="admin-panel">
          <p className="text-xs font-semibold mb-3" style={{ color: 'var(--c-text-3)' }}>BRIDGE</p>
          <div>
            <StatRow label="Listen"      value={`${bridge.host}:${bridge.port}`} />
            <StatRow label="Browser"     value={bridge.config.preferredBrowser} />
            <StatRow label="Ẩn cửa sổ"  value={bridge.config.hideWindow ? 'Có' : 'Không'} />
            <StatRow label="API Keys"    value={`${admin.activeKeys} active / ${admin.keysCount} total`} />
          </div>
        </div>
      </div>

      {/* Memory bars */}
      <div className="admin-panel space-y-5">
        <p className="text-xs font-semibold" style={{ color: 'var(--c-text-3)' }}>BỘ NHỚ</p>

        <div className="space-y-1.5">
          <div className="flex justify-between text-xs">
            <span style={{ color: 'var(--c-text-3)' }}>Heap used</span>
            <span className="tabular font-medium" style={{ color: 'var(--c-text-2)' }}>
              {formatBytes(system.memory.heapUsed)} / {formatBytes(system.memory.heapTotal)} · {heapPct}%
            </span>
          </div>
          <ProgressBar pct={heapPct} />
        </div>

        <div className="space-y-1.5">
          <div className="flex justify-between text-xs">
            <span style={{ color: 'var(--c-text-3)' }}>RSS (process)</span>
            <span className="tabular font-medium" style={{ color: 'var(--c-text-2)' }}>
              {formatBytes(system.memory.rss)} · {rssPct}%
            </span>
          </div>
          <ProgressBar pct={rssPct} color="var(--c-info)" />
        </div>
      </div>

      {/* Worker gauges */}
      <div className="admin-panel space-y-5">
        <p className="text-xs font-semibold" style={{ color: 'var(--c-text-3)' }}>WORKERS</p>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
          {[
            { label: 'Tổng',       value: bridge.workers.total,      color: 'var(--c-text)' },
            { label: 'Sẵn sàng',   value: bridge.workers.available,  color: 'var(--c-success)' },
            { label: 'Bận',        value: bridge.workers.busy,       color: 'var(--c-warn)' },
            { label: 'Generating', value: bridge.workers.generating, color: 'var(--c-danger)' },
          ].map(({ label, value, color }) => (
            <div key={label} className="admin-metric items-center">
              <p className="text-2xl font-bold tabular" style={{ color }}>{value}</p>
              <p className="text-xs" style={{ color: 'var(--c-text-3)' }}>{label}</p>
            </div>
          ))}
        </div>

        <div className="space-y-1.5">
          <div className="flex justify-between text-xs">
            <span style={{ color: 'var(--c-text-3)' }}>Tải workers</span>
            <span className="tabular font-medium" style={{ color: 'var(--c-text-2)' }}>
              {bridge.workers.busy}/{bridge.workers.total} · {workerBusyPct}%
            </span>
          </div>
          <ProgressBar pct={workerBusyPct} color="var(--c-accent)" />
        </div>
      </div>
    </div>
  );
}
