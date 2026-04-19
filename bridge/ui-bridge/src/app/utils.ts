export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

export function formatUptime(seconds: number): string {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const parts: string[] = [];
  if (d) parts.push(`${d}d`);
  if (h) parts.push(`${h}h`);
  if (m) parts.push(`${m}m`);
  if (s || !parts.length) parts.push(`${s}s`);
  return parts.join(' ');
}

export function memPct(used: number, total: number): number {
  if (!total) return 0;
  return Math.min(100, Math.round((used / total) * 100));
}

export async function safeAdminFetch(
  url: string,
  headers: HeadersInit
): Promise<{ res: Response | null; networkErr?: string }> {
  try {
    const res = await fetch(url, { headers });
    return { res };
  } catch (e) {
    return { res: null, networkErr: e instanceof Error ? e.message : String(e) };
  }
}

export async function readHttpErrorDetail(res: Response): Promise<string> {
  const text = await res.text();
  if (!text.trim()) return '';
  try {
    const j = JSON.parse(text) as { error?: string };
    return (j.error || text).slice(0, 280);
  } catch {
    return text.slice(0, 280);
  }
}
