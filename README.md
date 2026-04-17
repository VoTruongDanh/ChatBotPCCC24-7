# PCCC Consult Web

Hệ thống tư vấn Phòng cháy chữa cháy sử dụng AI Chat.

## Kiến trúc

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   UI        │────▶│  be-main    │────▶│  be-bridge  │
│  Next.js 15 │     │  Fastify    │     │  Puppeteer  │
│  Port 3000  │     │  Port 3001  │     │  Port 1122  │
└─────────────┘     └─────────────┘     └─────────────┘
                                               │
                                               ▼
                                        ┌─────────────┐
                                        │  ChatGPT    │
                                        │  Browser    │
                                        └─────────────┘
```

## Cài đặt

```bash
npm install
```

## Cấu hình

```bash
cp apps/be-bridge/.env.example apps/be-bridge/.env
cp apps/be-main/.env.example apps/be-main/.env
cp apps/ui/.env.example apps/ui/.env.local
```

## Chạy Development

```bash
# Tất cả services
npm run dev

# Hoặc riêng lẻ
npm run dev:bridge   # Port 1122
npm run dev:main     # Port 3001
npm run dev:ui       # Port 3000
```

## API Endpoints

### be-bridge (Port 1122)

| Endpoint | Method | Mô tả |
|----------|--------|-------|
| `/ping` | GET | Health check |
| `/health` | GET | Trạng thái workers |
| `/internal/bridge/chat` | POST | Chat non-streaming |
| `/internal/bridge/chat/stream` | POST | Chat SSE streaming |
| `/internal/bridge/reset-temp-chat` | POST | Reset session |

### be-main (Port 3001)

| Endpoint | Method | Mô tả |
|----------|--------|-------|
| `/health` | GET | Health check |
| `/api/chat` | POST | Proxy chat |
| `/api/chat/stream` | POST | Proxy chat SSE |
| `/api/reset` | POST | Reset session |

## Docker

```bash
cd apps/be-main
docker-compose up -d
```

## Yêu cầu

- Node.js 18+
- Chrome hoặc Edge (Windows)
