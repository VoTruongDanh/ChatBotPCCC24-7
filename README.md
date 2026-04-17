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


## Luồng hoạt động

### Bước 1: Người dùng hỏi
```
User: "Quy định về bình chữa cháy là gì?"
```

### Bước 2: UI gửi request
```
UI → POST /api/chat/stream
Body: { prompt: "Quy định về bình chữa cháy là gì?" }
```

### Bước 3: be-main xử lý
```
be-main nhận request
    ↓
Lấy rules từ rules.json
    ↓
Forward đến be-bridge với rules
```

### Bước 4: be-bridge build prompt
```
=== VAI TRÒ ===
Bạn là chuyên gia tư vấn PCCC

=== KIẾN THỨC PCCC ===
[Quy định, tiêu chuẩn PCCC...]

=== HƯỚNG DẪN ===
Trả lời ngắn gọn, chính xác

=== CÂU HỎI ===
Quy định về bình chữa cháy là gì?
```

### Bước 5: Worker gửi đến ChatGPT
```
Worker (browser instance)
    ↓
Tìm ô nhập tin nhắn trên ChatGPT
    ↓
Nhập prompt → Enter
    ↓
Đợi ChatGPT trả lời
```

### Bước 6: Streaming response
```
ChatGPT bắt đầu viết: "Theo quy định..."
    ↓
Worker đọc từng phần: "Theo", " quy", " định"...
    ↓
Gửi SSE event mỗi lần có text mới:
    data: {"delta": "Theo"}
    data: {"delta": " quy"}
    data: {"delta": " định"}
```

### Bước 7: UI hiển thị real-time
```
UI nhận SSE stream
    ↓
Hiển thị từng chữ: "Theo quy định..."
    ↓
Nhận event done: {"done": true, "response": "..."}
    ↓
Hoàn thành
```

### Sơ đồ tuần tự

```
┌──────┐         ┌─────────┐         ┌──────────┐         ┌─────────┐
│ User │         │   UI    │         │ be-main  │         │be-bridge│
└──┬───┘         └────┬────┘         └────┬─────┘         └────┬────┘
   │                  │                   │                    │
   │ Nhập câu hỏi     │                   │                    │
   │─────────────────>│                   │                    │
   │                  │                   │                    │
   │                  │ POST /chat/stream │                    │
   │                  │──────────────────>│                    │
   │                  │                   │                    │
   │                  │                   │ Forward + rules    │
   │                  │                   │───────────────────>│
   │                  │                   │                    │
   │                  │                   │                    │ Build prompt
   │                  │                   │                    │──────┐
   │                  │                   │                    │      │
   │                  │                   │                    │<─────┘
   │                  │                   │                    │
   │                  │                   │                    │ Gửi ChatGPT
   │                  │                   │                    │──────┐
   │                  │                   │                    │      │
   │                  │                   │                    │<─────┘
   │                  │                   │                    │
   │                  │                   │    SSE stream      │
   │                  │                   │<───────────────────│
   │                  │                   │  {"delta": "..."}  │
   │                  │                   │                    │
   │                  │  SSE stream       │                    │
   │                  │<──────────────────│                    │
   │                  │ {"delta": "..."}  │                    │
   │                  │                   │                    │
   │ Hiển thị text    │                   │                    │
   │<─────────────────│                   │                    │
   │                  │                   │                    │
```


## Authentication

### API Key giữa be-main và be-bridge

Để bảo mật communication giữa be-main và be-bridge, cần cấu hình API key:

1. Tạo API key ngẫu nhiên (VD: sử dụng `openssl rand -hex 32`)
2. Cấu hình trong cả 2 file `.env`:

**apps/be-main/.env:**
```bash
BRIDGE_API_KEY=your-secure-api-key-here
```

**apps/be-bridge/.env:**
```bash
BRIDGE_API_KEY=your-secure-api-key-here
```

Nếu không cấu hình `BRIDGE_API_KEY`, authentication sẽ bị tắt (không khuyến nghị cho production).

### Headers

be-main tự động thêm header `X-Bridge-API-Key` khi gọi be-bridge.

## Tích hợp be-bridge vào hệ thống khác

Xem hướng dẫn chi tiết tại: [apps/be-bridge/INTEGRATION.md](apps/be-bridge/INTEGRATION.md)

**Tóm tắt:**
- API Key authentication qua header `X-Bridge-API-Key`
- Rules structure rõ ràng với 3 loại: `system`, `context`, `instruction`
- SSE streaming response
- Type definitions trong `apps/be-bridge/src/types.mjs`

