# ✅ Sẵn sàng chạy!

## Tóm tắt các thay đổi

### 🔧 Đã sửa
1. ✅ **BRIDGE_URL**: Đổi từ `host.docker.internal:1122` → `localhost:1122`
2. ✅ **Dotenv loading**: Xóa preload phức tạp, để code tự load
3. ✅ **Package.json scripts**: Đơn giản hóa scripts
4. ✅ **Configuration check**: Tất cả configs đã đúng

### 📦 Cấu trúc hiện tại

```
apps/
├── be-bridge/      # Backend Bridge (port 1122)
├── be-main/        # Main Backend (port 6969)
├── ui/             # Main Frontend (port 3000)
└── ui-bridge/      # Bridge Admin (port 3002)
```

### 🔑 API Keys

| Service | Key Type | Value | Purpose |
|---------|----------|-------|---------|
| be-bridge | BRIDGE_API_KEY | `ACvxG%YkCOu7D+Pe` | Xác thực be-main |
| be-main | BRIDGE_API_KEY | `ACvxG%YkCOu7D+Pe` | Gọi be-bridge |
| ui-bridge | ADMIN_API_KEY | `1111` | Quản lý be-bridge |

### 🌐 URLs & Connections

```
┌─────────────┐
│     ui      │ http://localhost:3000
│  (Frontend) │
└──────┬──────┘
       │ API calls
       ▼
┌─────────────┐
│   be-main   │ http://localhost:6969
│  (Backend)  │
└──────┬──────┘
       │ Bridge calls (X-Bridge-API-Key)
       ▼
┌─────────────┐
│  be-bridge  │ http://localhost:1122
│  (Bridge)   │
└─────────────┘
       ▲
       │ Admin calls (X-Admin-API-Key)
       │
┌─────────────┐
│  ui-bridge  │ http://localhost:3002
│   (Admin)   │
└─────────────┘
```

## 🚀 Cách chạy

### 1. Kiểm tra cấu hình (Optional)
```bash
npm run check-config
```

### 2. Chạy tất cả services
```bash
npm run dev
```

### 3. Truy cập ứng dụng

| Service | URL | Mô tả |
|---------|-----|-------|
| **Main UI** | http://localhost:3000 | Trang chủ, chat với AI |
| **Main Admin** | http://localhost:3000/admin | Quản lý rules & prompts |
| **Bridge Admin** | http://localhost:3002 | Quản lý be-bridge |
| **be-main API** | http://localhost:6969 | Main backend API |
| **be-bridge API** | http://localhost:1122 | Bridge backend API |

### 4. Kiểm tra health

```bash
# be-bridge
curl http://localhost:1122/health

# be-main
curl http://localhost:6969/health
```

## ✅ Checklist sau khi chạy

### be-bridge logs phải hiển thị:
```
[Master] Khởi tạo 2 workers...
[Master] Sử dụng browser: C:\Program Files\Google\Chrome\Application\chrome.exe
[Master] Đã khởi tạo 2/2 workers thành công
[Master] be-bridge running at http://127.0.0.1:1122
[Master] Authentication: ENABLED ✅
```

### be-main logs phải hiển thị:
```
[be-main] Running at http://127.0.0.1:6969
[be-main] Bridge URL: http://localhost:1122 ✅
[be-main] Bridge Authentication: ENABLED ✅
```

### ui logs phải hiển thị:
```
▲ Next.js 15.0.0
- Local:        http://localhost:3000
✓ Ready in 2.4s
```

### ui-bridge logs phải hiển thị:
```
▲ Next.js 15.0.0
- Local:        http://localhost:3002
✓ Ready in 2.4s
```

## 🧪 Test các tính năng

### 1. Test Main UI Chat
1. Truy cập http://localhost:3000
2. Nhập message và gửi
3. Kiểm tra response từ AI

### 2. Test Bridge Admin
1. Truy cập http://localhost:3002
2. Tab "Cấu hình": Xem cấu hình hiện tại
3. Tab "API Keys": Tạo key mới
4. Tab "Workers": Xem trạng thái workers
5. Tab "Trạng thái": Xem system status

### 3. Test Main Admin
1. Truy cập http://localhost:3000/admin
2. Tạo rule mới
3. Kích hoạt/vô hiệu hóa rules

## 🔧 Troubleshooting

### Lỗi "Port already in use"
```bash
# Windows
netstat -ano | findstr :1122
netstat -ano | findstr :6969
netstat -ano | findstr :3000
netstat -ano | findstr :3002

# Kill process
taskkill /PID <PID> /F
```

### Lỗi "Cannot connect to be-bridge"
1. Kiểm tra be-bridge đang chạy
2. Kiểm tra `BRIDGE_URL=http://localhost:1122` trong be-main/.env
3. Kiểm tra `BRIDGE_API_KEY` khớp nhau

### Lỗi "Authentication: DISABLED"
1. Kiểm tra file `apps/be-bridge/.env` có `BRIDGE_API_KEY`
2. Restart be-bridge

### Lỗi "Module not found"
```bash
npm install
```

## 📚 Documentation

- [HOW-TO-RUN.md](./HOW-TO-RUN.md) - Hướng dẫn chi tiết
- [FIXES-APPLIED.md](./FIXES-APPLIED.md) - Các fix đã áp dụng
- [BRIDGE-SETUP-COMPLETE.md](./BRIDGE-SETUP-COMPLETE.md) - Setup bridge
- [apps/BRIDGE-README.md](./apps/BRIDGE-README.md) - Bridge docs

## 🎉 Kết luận

Tất cả đã sẵn sàng! Chạy `npm run dev` và bắt đầu phát triển.

**Happy coding! 🚀**