'use client';

import { useState, useEffect } from 'react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

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

export default function AdminPage() {
  const [rules, setRules] = useState<Rule[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingRule, setEditingRule] = useState<Rule | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    type: 'instruction' as Rule['type'],
    content: '',
    priority: 5,
    active: true
  });

  useEffect(() => {
    fetchRules();
  }, []);

  const fetchRules = async () => {
    try {
      const res = await fetch(`${API_URL}/api/rules`);
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
        ? `${API_URL}/api/rules/${editingRule.id}`
        : `${API_URL}/api/rules`;
      
      const res = await fetch(url, {
        method: editingRule ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
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
      await fetch(`${API_URL}/api/rules/${id}`, { method: 'DELETE' });
      fetchRules();
    } catch (err) {
      console.error('Failed to delete rule:', err);
    }
  };

  const handleToggleActive = async (rule: Rule) => {
    try {
      await fetch(`${API_URL}/api/rules/${rule.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
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

  if (loading) {
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
          <h1 className="text-3xl font-bold text-gray-900">🔧 Quản lý Rules & Prompts</h1>
          <a href="/" className="text-red-600 hover:underline">← Về trang chat</a>
        </div>

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
      </div>
    </div>
  );
}
