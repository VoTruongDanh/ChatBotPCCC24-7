# PCCC Consult Web

Hệ thống tư vấn Phòng cháy chữa cháy sử dụng AI Chat với kiến trúc module độc lập.

## 📦 Cấu trúc Module

```
.
├── bridge/              # Module độc lập - có thể tái sử dụng
│   ├── .env            # Config cho bridge
│   ├── be-bridge/      # Backend (Puppeteer + ChatGPT)
│   └── ui-bridge/      # Admin dashboard
│
├── pccc/               # Module chính - ứng dụng PCCC
│   ├── .env            # Config cho pccc
│   ├── be-main/        # Backend API
│   └── ui/             # Frontend người dùng
│
└── scripts/
    └── sync-config.mjs # Sync config tool
```

## 🏗️ Kiến trúc

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   UI        │────▶│  be-main    │────▶│  be-bridge  │
│  Next.js 15 │     │  Fastify    │     │  Puppeteer  │
│  Port 3000  │     │  Port 6969  │     │  Port 1122  │
└─────────────┘     └─────────────┘     └─────────────┘
                                               │
                                               ▼
                                        ┌─────────────┐
                                        │  ChatGPT    │
                                        │  Browser    │
                                        └─────────────┘
```

## 🚀 Quick Start

```bash
# 1. Install
npm install

# 2. Config (edit module .env files)
nano bridge/.env
nano pccc/.env

# 3. Sync config to apps
npm run config:sync

# 4. Run
npm run dev
```

## 📚 Documentation

- **[QUICK-START.md](QUICK-START.md)** - Hướng dẫn cài đặt và chạy nhanh
- **[CONFIG-MANAGEMENT.md](CONFIG-MANAGEMENT.md)** - Quản lý config module
- **[HOW-TO-RUN.md](HOW-TO-RUN.md)** - Chi tiết về development và deployment
- **[bridge/ADMIN-GUIDE.md](bridge/ADMIN-GUIDE.md)** - Hướng dẫn sử dụng Bridge Admin Dashboard

## 🔑 Ports

| Service | Port | Module |
|---------|------|--------|
| be-bridge | 1110 | bridge |
| ui-bridge | 1111 | bridge |
| be-main | 8888 | pccc |
| ui | 8889 | pccc |

## 🛠️ Tech Stack

**Bridge Module:**
- Backend: Node.js + Puppeteer + Puppeteer-Extra
- Frontend: Next.js 15 + React 18 + Tailwind CSS

**PCCC Module:**
- Backend: Fastify + Node.js
- Frontend: Next.js 15 + React 18 + Tailwind CSS

## 📝 Scripts

```bash
npm run dev              # Run all services
npm run dev:be-bridge    # Bridge backend only
npm run dev:ui-bridge    # Bridge admin only
npm run dev:be-main      # PCCC backend only
npm run dev:ui           # PCCC frontend only
npm run config:sync      # Sync module .env to apps
```

## 🔐 Authentication

Bridge module sử dụng API key authentication:
- `BRIDGE_API_KEY` - Cho be-main kết nối be-bridge
- `BRIDGE_ADMIN_API_KEY` - Cho ui-bridge admin dashboard

## 🌐 API Endpoints

### be-bridge (Port 1122)
- `GET /ping` - Health check
- `GET /health` - Worker status
- `POST /internal/bridge/chat` - Non-streaming chat
- `POST /internal/bridge/chat/stream` - SSE streaming chat
- `POST /internal/bridge/reset-temp-chat` - Reset session

### be-main (Port 6969)
- `GET /health` - Health check
- `POST /api/chat/stream` - Proxy chat with rules
- `POST /api/reset` - Reset session
- `GET /api/rules` - Get PCCC rules
- `PUT /api/rules` - Update rules

## 🔄 Tái sử dụng Bridge Module

Bridge module hoàn toàn độc lập, có thể copy sang dự án khác:

```bash
# Copy module
cp -r bridge/ /path/to/other-project/

# Config
cd /path/to/other-project/bridge
nano .env

# Run
npm install
npm run dev
```

## 📦 Yêu cầu

- Node.js 18+
- Chrome hoặc Edge (Windows)
- npm hoặc yarn

## 📄 License

MIT

