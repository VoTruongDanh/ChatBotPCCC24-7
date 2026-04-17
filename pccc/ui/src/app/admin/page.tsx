'use client';

import { useState, useEffect } from 'react';

interface Rule {
  id: string;
  name: string;
  type: 'system' | 'context' | 'instruction';
  content: string;
  priority: number;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

interface Settings {
  apiUrl: string;
  apiKey: string;
  bridgeUrl: string;
  bridgeApiKey: string;
}

export default function AdminPage() {
  const [activeTab, setActiveTab] = useState<'rules' | 'settings'>('settings');
  const [rules, setRules] = useState<Rule[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingRule, setEditingRule] = useState<Rule | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<'checking' | 'connected' | 'disconnected'>('checking');
  
  const [settings, setSettings] = useState<Settings>({
    apiUrl: '',
    apiKey: '',
    bridgeUrl: '',
    bridgeApiKey: ''
  });
  
  const [formData, setFormData] = useState({
    name: '',
    type: 'instruction' as Rule['type'],
    content: '',
    priority: 5,
    active: true
  });

  useEffect(() => {
    // Load settings from localStorage
    const savedSettings = localStorage.getItem('admin-settings');
    if (savedSettings) {
      const parsed = JSON.parse(savedSettings);
      setSettings(parsed);
      checkConnection(parsed.apiUrl, parsed.apiKey);
    } else {
      // Default values
      setSettings({
        apiUrl: 'http://localhost:3001',
        apiKey: '',
        bridgeUrl: 'http://127.0.0.1:1122',
        bridgeApiKey: ''
      });
    }
  }, []);

  // Load bridge settings from API when connected
  useEffect(() => {
    if (connectionStatus === 'connected' && settings.apiUrl) {
      fetchBridgeSettings();
    }
  }, [connectionStatus]);

  const fetchBridgeSettings = async () => {
    try {
      const res = await fetch(`${settings.apiUrl}/api/settings`, {
        headers: getHeaders()
      });
      if (res.ok) {
        const data = await res.json();
        setSettings(prev => ({
          ...prev,
          bridgeUrl: data.bridge?.url || prev.bridgeUrl,
          bridgeApiKey: data.bridge?.hasApiKey ? 'configured' : ''
        }));
      }
    } catch (err) {
      console.error('Failed to fetch bridge settings:', err);
    }
  };

  useEffect(() => {
    if (settings.apiUrl) {
      fetchRules();
    }
  }, [settings.apiUrl, settings.apiKey]);

  const checkConnection = async (apiUrl: string, apiKey: string) => {
    try {
      const headers: Record<string, string> = {};
      if (apiKey) headers['X-Admin-API-Key'] = apiKey;
      
      const res = await fetch(`${apiUrl}/health`, { 
        method: 'GET',
        headers 
      });
      setConnectionStatus(res.ok ? 'connected' : 'disconnected');
    } catch {
      setConnectionStatus('disconnected');
    }
  };

  const saveSettings = () => {
    localStorage.setItem('admin-settings', JSON.stringify(settings));
    checkConnection(settings.apiUrl, settings.apiKey);
    if (settings.apiUrl) {
      fetchRules();
    }
  };

  const getHeaders = () => {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    };
    if (settings.apiKey) {
      headers['X-Admin-API-Key'] = settings.apiKey;
    }
    return headers;
  };

  const fetchRules = async () => {
    try {
      const res = await fetch(`${settings.apiUrl}/api/rules`, {
        headers: getHeaders()
      });
      const data = await res.json();
      setRules(data.rules || []);
    } catch (err) {
      console.error('Failed to fetch rules:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const url = editingRule 
        ? `${settings.apiUrl}/api/rules/${editingRule.id}`
        : `${settings.apiUrl}/api/rules`;
      
      const res = await fetch(url, {
        method: editingRule ? 'PUT' : 'POST',
        headers: getHeaders(),
        body: JSON.stringify(formData)
      });

      if (res.ok) {
        fetchRules();
        resetForm();
      }
    } catch (err) {
      console.error('Failed to save rule:', err);
    }
  };

  const handleEdit = (rule: Rule) => {
    setEditingRule(rule);
    setFormData({
      name: rule.name,
      type: rule.type,
      content: rule.content,
      priority: rule.priority,
      active: rule.active
    });
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Xóa rule này?')) return;
    
    try {
      await fetch(`${settings.apiUrl}/api/rules/${id}`, { 
        method: 'DELETE',
        headers: getHeaders()
      });
      fetchRules();
    } catch (err) {
      console.error('Failed to delete rule:', err);
    }
  };

  const handleToggleActive = async (rule: Rule) => {
    try {
      await fetch(`${settings.apiUrl}/api/rules/${rule.id}`, {
        method: 'PUT',
        headers: getHeaders(),
        body: JSON.stringify({ active: !rule.active })
      });
      fetchRules();
    } catch (err) {
      console.error('Failed to toggle rule:', err);
    }
  };

  const resetForm = () => {
    setEditingRule(null);
    setFormData({ name: '', type: 'instruction', content: '', priority: 5, active: true });
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'system': return '🔵 System';
      case 'context': return '🟢 Context';
      case 'instruction': return '🟡 Instruction';
      default: return type;
    }
  };

  const getStatusBadge = () => {
    switch (connectionStatus) {
      case 'checking':
        return <span className="px-3 py-1 bg-gray-100 text-gray-600 rounded-full text-sm">Đang kiểm tra...</span>;
      case 'connected':
        return <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm">✓ Đã kết nối</span>;
      case 'disconnected':
        return <span className="px-3 py-1 bg-red-100 text-red-700 rounded-full text-sm">✗ Mất kết nối</span>;
    }
  };

  if (loading && !settings.apiUrl) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-xl">Đang tải...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold text-gray-900">🔧 Admin Dashboard</h1>
          <div className="flex items-center gap-4">
            {getStatusBadge()}
            <a href="/" className="text-red-600 hover:underline">← Về trang chat</a>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6">
          <button
            onClick={() => setActiveTab('settings')}
            className={`px-4 py-2 rounded-lg font-medium ${
              activeTab === 'settings' 
                ? 'bg-red-600 text-white' 
                : 'bg-white text-gray-700 hover:bg-gray-100'
            }`}
          >
            ⚙️ Cài đặt
          </button>
          <button
            onClick={() => setActiveTab('rules')}
            className={`px-4 py-2 rounded-lg font-medium ${
              activeTab === 'rules' 
                ? 'bg-red-600 text-white' 
                : 'bg-white text-gray-700 hover:bg-gray-100'
            }`}
          >
            📋 Rules ({rules.length})
          </button>
        </div>

        {/* Settings Tab */}
        {activeTab === 'settings' && (
          <div className="bg-white rounded-xl shadow-lg p-6">
            <h2 className="text-xl font-semibold mb-4">⚙️ Cấu hình kết nối</h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">API URL (be-main)</label>
                <input
                  type="text"
                  value={settings.apiUrl}
                  onChange={e => setSettings({ ...settings, apiUrl: e.target.value })}
                  placeholder="http://localhost:3001"
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-red-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Admin API Key (nếu có)</label>
                <input
                  type="password"
                  value={settings.apiKey}
                  onChange={e => setSettings({ ...settings, apiKey: e.target.value })}
                  placeholder="Để trống nếu không yêu cầu"
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-red-500"
                />
              </div>

              <div className="pt-4 border-t">
                <h3 className="font-medium mb-3">Bridge Configuration (read-only)</h3>
                <div className="bg-gray-50 p-4 rounded-lg space-y-2 text-sm">
                  <p><span className="font-medium">Bridge URL:</span> {settings.bridgeUrl || 'http://127.0.0.1:1122'}</p>
                  <p><span className="font-medium">Bridge API Key:</span> {settings.bridgeApiKey ? '••••••••' : 'Không cấu hình'}</p>
                </div>
              </div>

              <button
                onClick={saveSettings}
                className="w-full bg-red-600 text-white py-2 rounded-lg hover:bg-red-700"
              >
                💾 Lưu cài đặt
              </button>
            </div>
          </div>
        )}

        {/* Rules Tab */}
        {activeTab === 'rules' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Form */}
            <div className="bg-white rounded-xl shadow-lg p-6">
              <h2 className="text-xl font-semibold mb-4">
                {editingRule ? '✏️ Sửa Rule' : '➕ Thêm Rule mới'}
              </h2>
              
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Tên Rule</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-red-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Loại</label>
                  <select
                    value={formData.type}
                    onChange={e => setFormData({ ...formData, type: e.target.value as Rule['type'] })}
                    className="w-full px-3 py-2 border rounded-lg"
                  >
                    <option value="system">System - Vai trò</option>
                    <option value="context">Context - Kiến thức</option>
                    <option value="instruction">Instruction - Hướng dẫn</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Nội dung</label>
                  <textarea
                    value={formData.content}
                    onChange={e => setFormData({ ...formData, content: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg h-32 focus:ring-2 focus:ring-red-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Độ ưu tiên (1-10, nhỏ hơn = cao hơn)</label>
                  <input
                    type="number"
                    min="1"
                    max="10"
                    value={formData.priority}
                    onChange={e => setFormData({ ...formData, priority: parseInt(e.target.value) })}
                    className="w-full px-3 py-2 border rounded-lg"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="active"
                    checked={formData.active}
                    onChange={e => setFormData({ ...formData, active: e.target.checked })}
                    className="w-4 h-4"
                  />
                  <label htmlFor="active" className="text-sm">Kích hoạt</label>
                </div>

                <div className="flex gap-2">
                  <button
                    type="submit"
                    className="flex-1 bg-red-600 text-white py-2 rounded-lg hover:bg-red-700"
                  >
                    {editingRule ? 'Cập nhật' : 'Thêm mới'}
                  </button>
                  {editingRule && (
                    <button
                      type="button"
                      onClick={resetForm}
                      className="px-4 py-2 border rounded-lg hover:bg-gray-100"
                    >
                      Hủy
                    </button>
                  )}
                </div>
              </form>
            </div>

            {/* List */}
            <div className="bg-white rounded-xl shadow-lg p-6">
              <h2 className="text-xl font-semibold mb-4">📋 Danh sách Rules ({rules.length})</h2>
              
              <div className="space-y-3">
                {rules.map(rule => (
                  <div
                    key={rule.id}
                    className={`p-4 rounded-lg border ${rule.active ? 'bg-white' : 'bg-gray-100 opacity-60'}`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-medium">{rule.name}</span>
                          <span className="text-xs px-2 py-0.5 bg-gray-100 rounded">
                            {getTypeLabel(rule.type)}
                          </span>
                          <span className="text-xs text-gray-500">P{rule.priority}</span>
                        </div>
                        <p className="text-sm text-gray-600 line-clamp-2">{rule.content}</p>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2 mt-3 pt-3 border-t">
                      <button
                        onClick={() => handleToggleActive(rule)}
                        className={`px-3 py-1 text-xs rounded-full ${
                          rule.active 
                            ? 'bg-green-100 text-green-700' 
                            : 'bg-gray-200 text-gray-600'
                        }`}
                      >
                        {rule.active ? '✓ Active' : 'Inactive'}
                      </button>
                      <button
                        onClick={() => handleEdit(rule)}
                        className="px-3 py-1 text-xs bg-blue-100 text-blue-700 rounded-full"
                      >
                        ✏️ Sửa
                      </button>
                      <button
                        onClick={() => handleDelete(rule.id)}
                        className="px-3 py-1 text-xs bg-red-100 text-red-700 rounded-full"
                      >
                        🗑️ Xóa
                      </button>
                    </div>
                  </div>
                ))}

                {rules.length === 0 && (
                  <p className="text-center text-gray-500 py-8">Chưa có rule nào</p>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
