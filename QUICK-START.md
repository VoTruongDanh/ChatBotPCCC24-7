# Quick Start - PCCC Consult Web

## Khởi động dự án

### 1. Kill processes cũ (nếu có lỗi EADDRINUSE)
```bash
# Windows PowerShell
taskkill /F /IM node.exe
taskkill /F /IM chrome.exe
```

### 2. Chạy dev server
```bash
npm run dev
```

Đợi ~30 giây để:
- UI (Next.js) khởi động ở port 3000
- BE-Main (Fastify) khởi động ở port 3001
- BE-Bridge (Puppeteer) khởi động ở port 1122 và launch Chrome

### 3. Mở trình duyệt

**Trang chủ (Chat AI):**
```
http://localhost:3000
```

**Trang dịch vụ:**
```
http://localhost:3000/dich-vu
```

---

## Cấu trúc dự án

```
pccc-consult-web/
├── apps/
│   ├── ui/                 # Next.js 15 frontend
│   │   ├── src/
│   │   │   ├── app/
│   │   │   │   ├── page.tsx           # Trang chủ (Chat)
│   │   │   │   └── dich-vu/
│   │   │   │       └── page.tsx       # Trang dịch vụ
│   │   │   └── components/
│   │   │       └── Navigation.tsx     # Nav component
│   │   └── PAGES.md                   # Hướng dẫn trang
│   │
│   ├── be-main/            # Fastify API server
│   │   └── src/
│   │       └── index.mjs
│   │
│   └── be-bridge/          # Puppeteer ChatGPT bridge
│       ├── src/
│       │   ├── master.mjs
│       │   ├── worker.mjs
│       │   └── config.mjs
│       └── STREAMING-TUNING.md        # Hướng dẫn tinh chỉnh
│
└── package.json            # Root workspace
```

---

## Các trang hiện có

| Trang | URL | Mô tả |
|-------|-----|-------|
| Trang chủ | `/` | Chat AI với streaming response |
| Dịch vụ | `/dich-vu` | 4 gói dịch vụ PCCC + dịch vụ bổ sung |

---

## Troubleshooting

### Lỗi: EADDRINUSE (Port đang được sử dụng)

**Giải pháp:**
```bash
# Kill tất cả node processes
taskkill /F /IM node.exe

# Kill Chrome (nếu cần)
taskkill /F /IM chrome.exe

# Chạy lại
npm run dev
```

### Lỗi: Nút "Dịch vụ" không click được

**Giải pháp:**
1. Hard refresh browser: `Ctrl + Shift + R`
2. Hoặc mở Incognito: `Ctrl + Shift + N`
3. Hoặc clear cache trong DevTools (F12)

### Lỗi: Trang /dich-vu trả về 404

**Kiểm tra:**
```bash
# File có tồn tại không?
ls apps/ui/src/app/dich-vu/page.tsx

# Server có chạy không?
curl http://localhost:3000/dich-vu
```

---

## Development

### Thêm trang mới

1. Tạo folder và file:
```bash
mkdir apps/ui/src/app/ten-trang
# Tạo file page.tsx trong folder đó
```

2. Copy template từ `dich-vu/page.tsx`

3. Cập nhật Navigation component

Xem chi tiết: `apps/ui/PAGES.md`

### Tinh chỉnh streaming

Chỉnh sửa file `apps/be-bridge/.env`:
```bash
STREAM_NO_CHANGE_THRESHOLD=10
STREAM_FALLBACK_THRESHOLD=25
STREAM_MAX_TIMEOUT=120000
```

Xem chi tiết: `apps/be-bridge/STREAMING-TUNING.md`

---

## URLs quan trọng

- **UI:** http://localhost:3000
- **API:** http://localhost:3001
- **Bridge:** http://localhost:1122
- **Health check:** http://localhost:3001/health

---

## Lệnh hữu ích

```bash
# Chạy dev
npm run dev

# Build production
npm run build

# Kiểm tra TypeScript
cd apps/ui && npx tsc --noEmit

# Xóa cache Next.js
rm -rf apps/ui/.next

# Kiểm tra port đang dùng
netstat -ano | findstr :3000
```

---

## Ghi chú

- **Streaming detection:** Đã được tối ưu với fallback timeout 5s
- **Navigation:** Dùng Next.js Link component cho client-side routing
- **Styling:** Tailwind CSS với gradient màu PCCC (red-orange-yellow)
- **Mock data:** Gói dịch vụ trong `apps/ui/src/app/dich-vu/page.tsx`
