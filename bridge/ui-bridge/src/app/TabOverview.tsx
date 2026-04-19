'use client';
import { Inbox, RefreshCw, Server, Key, Shield, Monitor } from 'lucide-react';
import type { ApiKey, Worker, SystemStatus } from './types';
import { formatUptime, formatBytes } from './utils';

interface Props {
  workers: Worker[];
  apiKeys: ApiKey[];
  status: SystemStatus | null;
  browserRunning: boolean;
  loading: boolean;
  onRefresh: () => void;
}

function MetricSkeleton() {
  return (
    <div className="admin-metric">
      <div className="admin-skeleton h-3 w-20 mb-3" />
      <div className="admin-skeleton h-8 w-14" />
      <div className="admin-skeleton h-3 w-28 mt-2" />
    </div>
  );
}

export default function TabOverview({ workers, apiKeys, status, browserRunning, loading, onRefresh }: Props) {
  if (loading) {
    return (
      <div className="space-y-6">
        <div className="admin-skeleton h-6 w-48" />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[1,2,3,4].map(i => <MetricSkeleton key={i} />)}
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="admin-skeleton h-40" />
          <div className="admin-skeleton h-40" />
        </div>
      </div>
    );
  }

  const idle = workers.filter(w => !w.busy).length;
  const busy = workers.filter(w => w.busy).length;

  return (
    <div className="space-y-6">
      <div>
        <p className="admin-section-title"><Server className="h-4 w-4" />Tổng quan vận hành</p>
        <p className="admin-section-desc">Chỉ số tổng hợp từ be-bridge · tự động làm mới mỗi 10s</p>
      </div>

      {/* Metric cards */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="admin-metric">
          <p className="admin-label" style={{marginBottom:0}}>Workers</p>
          <p className="text-3xl font-bold tabular" style={{color:'var(--c-text)'}}>{workers.length}</p>
          <p className="text-xs mt-1" style={{color:'var(--c-text-3)'}}>
            <span style={{color:'var(--c-success)'}}>●</span> {idle} rảnh &nbsp;
            <span style={{color:'var(--c-warn)'}}>●</span> {busy} bận
          </p>
        </div>

        <div className="admin-metric">
          <p className="admin-label" style={{marginBottom:0}}><Key className="inline h-3 w-3 mr-1" />API Keys</p>
          <p className="text-3xl font-bold tabular" style={{color:'var(--c-text)'}}>{apiKeys.length}</p>
          <p className="text-xs mt-1" style={{color:'var(--c-text-3)'}}>
            {apiKeys.filter(k => k.active).length} active · {apiKeys.filter(k => !k.active).length} inactive
          </p>
        </div>

        <div className="admin-metric">
          <p className="admin-label" style={{marginBottom:0}}><Shield className="inline h-3 w-3 mr-1" />Xác thực</p>
          <p className="text-lg font-bold mt-1" style={{color: status?.bridge.authEnabled ? 'var(--c-success)' : 'var(--c-warn)'}}>
            {status ? (status.bridge.authEnabled ? 'Đã bật' : 'Đã tắt') : '—'}
          </p>
          <p className="text-xs mt-1" style={{color:'var(--c-text-3)'}}>Dựa trên API keys active</p>
        </div>

        <div className="admin-metric">
          <p className="admin-label" style={{marginBottom:0}}><Monitor className="inline h-3 w-3 mr-1" />Puppeteer</p>
          <p className="text-lg font-bold mt-1" style={{color: browserRunning ? 'var(--c-success)' : 'var(--c-text-4)'}}>
            {browserRunning ? 'Browser mở' : 'Không xác định'}
          </p>
          <p className="text-xs mt-1" style={{color:'var(--c-text-3)'}}>Theo /admin/browser</p>
        </div>
      </div>

      {/* System + Bridge panels */}
      {status ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="admin-panel">
            <p className="admin-section-title mb-3">Hệ thống</p>
            <dl className="space-y-2.5 text-sm">
              {[
                ['Uptime', formatUptime(status.system.uptime)],
                ['Node.js', status.system.nodeVersion],
                ['Platform', status.system.platform],
                ['RSS', formatBytes(status.system.memory.rss)],
                ['Heap used', formatBytes(status.system.memory.heapUsed)],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between gap-4">
                  <dt style={{color:'var(--c-text-3)'}}>{k}</dt>
                  <dd className="font-medium tabular" style={{color:'var(--c-text)'}}>{v}</dd>
                </div>
              ))}
            </dl>
          </div>

          <div className="admin-panel">
            <p className="admin-section-title mb-3">Bridge</p>
            <dl className="space-y-2.5 text-sm">
              {[
                ['Listen', `${status.bridge.host}:${status.bridge.port}`],
                ['Browser', status.bridge.config.preferredBrowser],
                ['Chat URL', status.bridge.config.chatUrl],
                ['Ẩn cửa sổ', status.bridge.config.hideWindow ? 'Có' : 'Không'],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between gap-4">
                  <dt style={{color:'var(--c-text-3)'}}>{k}</dt>
                  <dd className="font-medium tabular truncate max-w-[180px]" style={{color:'var(--c-text)'}} title={v}>{v}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      ) : (
        <div className="admin-empty">
          <Inbox className="h-10 w-10 mb-3" style={{color:'var(--c-text-4)'}} />
          <p className="text-sm font-semibold" style={{color:'var(--c-text-2)'}}>Chưa có snapshot trạng thái</p>
          <p className="text-xs mt-1 max-w-xs" style={{color:'var(--c-text-3)'}}>
            Kiểm tra kết nối be-bridge và Admin API Key.
          </p>
          <button className="admin-btn-secondary mt-4 text-xs" onClick={onRefresh}>
            <RefreshCw className="h-3.5 w-3.5" /> Thử tải lại
          </button>
        </div>
      )}
    </div>
  );
}
