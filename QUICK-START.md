# Quick Start Guide

Hướng dẫn cài đặt và chạy nhanh dự án trong 5 phút.

## 📋 Yêu cầu

- Node.js 18+
- Chrome hoặc Edge (Windows)
- npm

## 🚀 Cài đặt

### 1. Clone và Install

```bash
git clone <repo-url>
cd ChatBotPCCC24-7
npm install
```

### 2. Config Module

**Bridge Module:**
```bash
cd bridge
cp .env.example .env
nano .env
```

Cấu hình tối thiểu:
```env
BRIDGE_API_KEY=your_secure_key_here
BRIDGE_ADMIN_API_KEY=admin_key_here
```

**PCCC Module:**
```bash
cd ../pccc
cp .env.example .env
nano .env
```

Cấu hình tối thiểu:
```env
BRIDGE_API_KEY=your_secure_key_here  # Same as bridge
BRIDGE_URL=http://localhost:1122
```

### 3. Sync Config

```bash
cd ..
npm run config:sync
```

### 4. Run

```bash
npm run dev
```

## 🌐 Truy cập

- **PCCC UI**: http://localhost:3000
- **Bridge Admin**: http://localhost:3002
- **be-main API**: http://localhost:6969
- **be-bridge API**: http://localhost:1122

## ✅ Test

```bash
# Health check
curl http://localhost:6969/health
curl http://localhost:1122/health

# Test chat
curl -X POST http://localhost:6969/api/chat/stream \
  -H "Content-Type: application/json" \
  -d '{"prompt": "Xin chào"}'
```

## 🔧 Troubleshooting

**Port đã được sử dụng:**
```bash
# Đổi port trong module .env
nano bridge/.env  # BRIDGE_PORT=1122
nano pccc/.env    # MAIN_PORT=6969
npm run config:sync
```

**Chrome không tìm thấy:**
```bash
# Cài Chrome hoặc đổi sang Edge
nano bridge/.env
# BRIDGE_PREFERRED_BROWSER=edge
npm run config:sync
```

**Config không sync:**
```bash
# Xóa app .env và sync lại
rm bridge/be-bridge/.env bridge/ui-bridge/.env
rm pccc/be-main/.env pccc/ui/.env
npm run config:sync
```

## 📚 Xem thêm

- [README.md](README.md) - Tổng quan dự án
- [CONFIG-MANAGEMENT.md](CONFIG-MANAGEMENT.md) - Chi tiết config
- [HOW-TO-RUN.md](HOW-TO-RUN.md) - Development & deployment
