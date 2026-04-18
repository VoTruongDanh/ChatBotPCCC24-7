'use client';

import { useEffect, useState } from 'react';
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
  Monitor
} from 'lucide-react';

const BRIDGE_API_URL = process.env.NEXT_PUBLIC_BRIDGE_API_URL || 'http://localhost:1122';
const ADMIN_API_KEY = process.env.NEXT_PUBLIC_ADMIN_API_KEY || 'bridge_admin_default_key';

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

export default function BridgeAdminPage() {
  const [activeTab, setActiveTab] = useState<'config' | 'keys' | 'workers' | 'status'>('config');
  const [config, setConfig] = useState<BridgeConfig | null>(null);
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [status, setStatus] = useState<SystemStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [showApiKey, setShowApiKey] = useState<string | null>(null);
  const [newKeyName, setNewKeyName] = useState('');
  const [configForm, setConfigForm] = useState<Partial<BridgeConfig>>({});
  const [browserRunning, setBrowserRunning] = useState(false);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 10000);
    return () => clearInterval(interval);
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);

      const headers = {
        'X-Admin-API-Key': ADMIN_API_KEY,
        'Content-Type': 'application/json'
      };

      const [configRes, keysRes, workersRes, statusRes, browserRes] = await Promise.all([
        fetch(`${BRIDGE_API_URL}/admin/config`, { headers }).catch(() => null),
        fetch(`${BRIDGE_API_URL}/admin/keys`, { headers }).catch(() => null),
        fetch(`${BRIDGE_API_URL}/admin/workers`, { headers }).catch(() => null),
        fetch(`${BRIDGE_API_URL}/admin/status`, { headers }).catch(() => null),
        fetch(`${BRIDGE_API_URL}/admin/browser`, { headers }).catch(() => null)
      ]);

      if (configRes?.ok) {
        const configData = await configRes.json();
        setConfig(configData.config);
        setConfigForm(configData.config);
      }

      if (keysRes?.ok) {
        const keysData = await keysRes.json();
        setApiKeys(keysData.keys || []);
      }

      if (workersRes?.ok) {
        const workersData = await workersRes.json();
        setWorkers(workersData.workers || []);
      }

      if (browserRes?.ok) {
        const browserData = await browserRes.json();
        setBrowserRunning(browserData.running);
      }

      if (statusRes?.ok) {
        const statusData = await statusRes.json();
        setStatus(statusData);
      }
    } catch (err) {
      setError('Không thể kết nối đến be-bridge admin API');
      console.error('Fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveConfig = async () => {
    try {
      const headers = {
        'X-Admin-API-Key': ADMIN_API_KEY,
        'Content-Type': 'application/json'
      };

      const res = await fetch(`${BRIDGE_API_URL}/admin/config`, {
        method: 'PUT',
        headers,
        body: JSON.stringify(configForm)
      });

      if (res.ok) {
        setSuccessMessage('Cấu hình đã được lưu thành công');
        setTimeout(() => setSuccessMessage(null), 3000);
        fetchData();
      } else {
        const errorData = await res.json();
        setError(`Lỗi: ${errorData.error}`);
      }
    } catch (err) {
      setError('Không thể lưu cấu hình');
    }
  };

  const handleGenerateKey = async () => {
    if (!newKeyName.trim()) {
      setError('Vui lòng nhập tên cho key');
      return;
    }

    try {
      const headers = {
        'X-Admin-API-Key': ADMIN_API_KEY,
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
        setSuccessMessage('API key mới đã được tạo');
        setTimeout(() => setSuccessMessage(null), 3000);
      }
    } catch (err) {
      setError('Không thể tạo API key');
    }
  };

  const handleDeleteKey = async (keyId: string) => {
    if (!confirm('Bạn có chắc chắn muốn xóa API key này?')) return;

    try {
      const headers = {
        'X-Admin-API-Key': ADMIN_API_KEY,
        'Content-Type': 'application/json'
      };

      const res = await fetch(`${BRIDGE_API_URL}/admin/keys/${keyId}`, {
        method: 'DELETE',
        headers
      });

      if (res.ok) {
        setApiKeys(apiKeys.filter(key => key.id !== keyId));
        setSuccessMessage('API key đã được xóa');
        setTimeout(() => setSuccessMessage(null), 3000);
      }
    } catch (err) {
      setError('Không thể xóa API key');
    }
  };

  
  const handleShowBrowser = async () => {
    try {
      const headers = {
        'X-Admin-API-Key': ADMIN_API_KEY,
        'Content-Type': 'application/json'
      };

      const res = await fetch(`${BRIDGE_API_URL}/admin/browser`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ action: 'show' })
      });

      if (res.ok) {
        setSuccessMessage('?? hi?n c?a s? ChatGPT');
        setTimeout(() => setSuccessMessage(null), 3000);
        fetchData();
      }
    } catch (err) {
      setError('Kh?ng th? hi?n c?a s? ChatGPT');
    }
  };

  const handleHideBrowser = async () => {
    try {
      const headers = {
        'X-Admin-API-Key': ADMIN_API_KEY,
        'Content-Type': 'application/json'
      };

      const res = await fetch(`${BRIDGE_API_URL}/admin/browser`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ action: 'hide' })
      });

      if (res.ok) {
        setSuccessMessage('?? ?n c?a s? ChatGPT');
        setTimeout(() => setSuccessMessage(null), 3000);
        fetchData();
      }
    } catch (err) {
      setError('Kh?ng th? ?n c?a s? ChatGPT');
    }
  };

const handleToggleKey = async (keyId: string, active: boolean) => {
    try {
      const headers = {
        'X-Admin-API-Key': ADMIN_API_KEY,
        'Content-Type': 'application/json'
      };

      const res = await fetch(`${BRIDGE_API_URL}/admin/keys/${keyId}`, {
        method: 'PUT',
        headers,
        body: JSON.stringify({ active: !active })
      });

      if (res.ok) {
        fetchData();
      }
    } catch (err) {
      setError('Không thể cập nhật trạng thái key');
    }
  };

  const handleAddWorker = async () => {
    try {
      const headers = {
        'X-Admin-API-Key': ADMIN_API_KEY,
        'Content-Type': 'application/json'
      };

      const res = await fetch(`${BRIDGE_API_URL}/admin/workers`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ count: 1 })
      });

      if (res.ok) {
        setSuccessMessage('Worker mới đã được thêm');
        setTimeout(() => setSuccessMessage(null), 3000);
        fetchData();
      }
    } catch (err) {
      setError('Không thể thêm worker');
    }
  };

  const handleRemoveWorker = async () => {
    try {
      const headers = {
        'X-Admin-API-Key': ADMIN_API_KEY,
        'Content-Type': 'application/json'
      };

      const res = await fetch(`${BRIDGE_API_URL}/admin/workers`, {
        method: 'DELETE',
        headers,
        body: JSON.stringify({ count: 1 })
      });

      if (res.ok) {
        setSuccessMessage('Worker đã được xóa');
        setTimeout(() => setSuccessMessage(null), 3000);
        fetchData();
      }
    } catch (err) {
      setError('Không thể xóa worker');
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

  if (loading && !config) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Đang tải dữ liệu...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
                <Server className="h-8 w-8 text-red-600" />
                be-bridge Admin Dashboard
              </h1>
              <p className="text-gray-600 mt-2">
                Quản lý cấu hình, API keys, workers và theo dõi trạng thái hệ thống
              </p>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={fetchData}
                className="flex items-center gap-2 px-4 py-2 bg-white border rounded-lg hover:bg-gray-50"
              >
                <RefreshCw className="h-4 w-4" />
                Refresh
              </button>
            </div>
          </div>
        </div>

        {/* Messages */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-red-700">{error}</p>
          </div>
        )}
        
        {successMessage && (
          <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
            <p className="text-green-700">{successMessage}</p>
          </div>
        )}

        {/* Tabs */}
        <div className="mb-8">
          <div className="flex flex-wrap gap-2 border-b">
            <button
              onClick={() => setActiveTab('config')}
              className={`px-4 py-3 font-medium rounded-t-lg flex items-center gap-2 ${
                activeTab === 'config'
                  ? 'bg-white border border-b-0 text-red-600'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <Settings className="h-4 w-4" />
              Cấu hình
            </button>
            <button
              onClick={() => setActiveTab('keys')}
              className={`px-4 py-3 font-medium rounded-t-lg flex items-center gap-2 ${
                activeTab === 'keys'
                  ? 'bg-white border border-b-0 text-red-600'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <Key className="h-4 w-4" />
              API Keys
            </button>
            <button
              onClick={() => setActiveTab('workers')}
              className={`px-4 py-3 font-medium rounded-t-lg flex items-center gap-2 ${
                activeTab === 'workers'
                  ? 'bg-white border border-b-0 text-red-600'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <Users className="h-4 w-4" />
              Workers
            </button>
            <button
              onClick={() => setActiveTab('status')}
              className={`px-4 py-3 font-medium rounded-t-lg flex items-center gap-2 ${
                activeTab === 'status'
                  ? 'bg-white border border-b-0 text-red-600'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <Activity className="h-4 w-4" />
              Trạng thái
            </button>
          </div>
        </div>

        {/* Tab Content */}
        <div className="bg-white rounded-xl shadow-lg p-6">
          {/* Config Tab */}
          {activeTab === 'config' && config && (
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
                    <label className="block text-sm font-medium mb-1">Host</label>
                    <input
                      type="text"
                      value={configForm.HOST || ''}
                      onChange={e => setConfigForm({...configForm, HOST: e.target.value})}
                      className="w-full px-3 py-2 border rounded-lg"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium mb-1">Port</label>
                    <input
                      type="number"
                      value={configForm.PORT || 1122}
                      onChange={e => setConfigForm({...configForm, PORT: parseInt(e.target.value)})}
                      className="w-full px-3 py-2 border rounded-lg"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium mb-1">Số lượng Workers</label>
                    <input
                      type="number"
                      min="1"
                      max="10"
                      value={configForm.NUM_WORKERS || 2}
                      onChange={e => setConfigForm({...configForm, NUM_WORKERS: parseInt(e.target.value)})}
                      className="w-full px-3 py-2 border rounded-lg"
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
                    <label className="block text-sm font-medium mb-1">Trình duyệt ưu tiên</label>
                    <select
                      value={configForm.PREFERRED_BROWSER || 'chrome'}
                      onChange={e => setConfigForm({...configForm, PREFERRED_BROWSER: e.target.value})}
                      className="w-full px-3 py-2 border rounded-lg"
                    >
                      <option value="chrome">Chrome</option>
                      <option value="edge">Edge</option>
                    </select>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium mb-1">Chat URL</label>
                    <input
                      type="text"
                      value={configForm.CHAT_URL || ''}
                      onChange={e => setConfigForm({...configForm, CHAT_URL: e.target.value})}
                      className="w-full px-3 py-2 border rounded-lg"
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
                    <label className="block text-sm font-medium mb-1">No Change Threshold</label>
                    <input
                      type="number"
                      value={configForm.STREAM_NO_CHANGE_THRESHOLD || 10}
                      onChange={e => setConfigForm({...configForm, STREAM_NO_CHANGE_THRESHOLD: parseInt(e.target.value)})}
                      className="w-full px-3 py-2 border rounded-lg"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium mb-1">Fallback Threshold</label>
                    <input
                      type="number"
                      value={configForm.STREAM_FALLBACK_THRESHOLD || 25}
                      onChange={e => setConfigForm({...configForm, STREAM_FALLBACK_THRESHOLD: parseInt(e.target.value)})}
                      className="w-full px-3 py-2 border rounded-lg"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium mb-1">Max Timeout (ms)</label>
                    <input
                      type="number"
                      value={configForm.STREAM_MAX_TIMEOUT || 120000}
                      onChange={e => setConfigForm({...configForm, STREAM_MAX_TIMEOUT: parseInt(e.target.value)})}
                      className="w-full px-3 py-2 border rounded-lg"
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
                      className="w-full px-3 py-2 border rounded-lg font-mono"
                      placeholder="Nhập API key mới (để trống để giữ nguyên)"
                    />
                  </div>
                  <button
                    onClick={() => setShowApiKey(showApiKey === 'bridge' ? null : 'bridge')}
                    className="px-3 py-2 border rounded-lg"
                  >
                    {showApiKey === 'bridge' ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                <p className="text-sm text-gray-500 mt-2">
                  API key này được be-main sử dụng để xác thực với be-bridge
                </p>
              </div>

              {/* Save Button */}
              <div className="pt-6 border-t">
                <button
                  onClick={handleSaveConfig}
                  className="flex items-center gap-2 px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700"
                >
                  <Save className="h-4 w-4" />
                  Lưu cấu hình
                </button>
                <p className="text-sm text-gray-500 mt-2">
                  Lưu ý: Thay đổi cấu hình sẽ yêu cầu khởi động lại be-bridge
                </p>
              </div>
            </div>
          )}

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
                    className="flex-1 px-3 py-2 border rounded-lg"
                  />
                  <button
                    onClick={handleGenerateKey}
                    className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
                  >
                    <Plus className="h-4 w-4" />
                    Tạo Key
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
                            onClick={() => setShowApiKey(showApiKey === key.id ? null : key.id)}
                            className="px-3 py-1 text-sm border rounded"
                          >
                            {showApiKey === key.id ? 'Ẩn' : 'Hiện'}
                          </button>
                          <button
                            onClick={() => handleToggleKey(key.id, key.active)}
                            className="px-3 py-1 text-sm border rounded"
                          >
                            {key.active ? 'Vô hiệu hóa' : 'Kích hoạt'}
                          </button>
                          <button
                            onClick={() => handleDeleteKey(key.id)}
                            className="px-3 py-1 text-sm bg-red-100 text-red-700 rounded hover:bg-red-200"
                          >
                            <Trash2 className="h-4 w-4" />
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
                    <p className="text-center text-gray-500 py-8">
                      Chưa có API key nào. Hãy tạo key đầu tiên.
                    </p>
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

              {/* Worker Controls */}
              <div className="flex gap-4">
                <button
                  onClick={handleAddWorker}
                  className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                >
                  <Plus className="h-4 w-4" />
                  Thêm Worker
                </button>
                <button
                  onClick={handleRemoveWorker}
                  disabled={workers?.filter(w => !w.busy).length === 0}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg ${
                    workers?.filter(w => !w.busy).length === 0
                      ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                      : 'bg-red-600 text-white hover:bg-red-700'
                  }`}
                >
                  <Trash2 className="h-4 w-4" />
                  Xóa Worker
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
                    <p className="text-center text-gray-500 py-8">
                      Không có worker nào đang hoạt động
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Status Tab */}
          {activeTab === 'status' && status && (
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
          )}
        </div>

        {/* Footer */}
        <div className="mt-8 text-center text-gray-500 text-sm">
          <p>be-bridge Admin Dashboard • {new Date().toLocaleString('vi-VN')}</p>
          <p className="mt-1">Kết nối đến: {BRIDGE_API_URL}</p>
        </div>
      </div>
    </div>
  );
}