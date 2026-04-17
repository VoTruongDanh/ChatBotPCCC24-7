# Hướng dẫn chạy dự án

## Cấu trúc dự án

```
.
├── apps/
│   ├── be-bridge/      # Bridge backend service (port 1122)
│   ├── be-main/        # Main API backend (port 6969)
│   ├── ui/             # Main frontend (port 3000)
│   └── ui-bridge/      # Bridge admin frontend (port 3002)
├── package.json        # Root package.json
├── turbo.json          # Turbo configuration
└── HOW-TO-RUN.md       # File này
```

## Cách 1: Chạy tất cả services cùng lúc (Khuyên dùng)

```bash
# Từ thư mục root
npm run dev
```

Lệnh này sẽ chạy đồng thời 4 services:
- **be-bridge**: http://localhost:1122 (Bridge Backend API)
- **be-main**: http://localhost:6969 (Main Backend API)
- **ui**: http://localhost:3000 (Main Frontend)
- **ui-bridge**: http://localhost:3002 (Bridge Admin Frontend)

## Cách 2: Chạy từng service riêng biệt

### Terminal 1: be-bridge (Bridge Backend)
```bash
npm run dev:bridge
# hoặc
cd apps/be-bridge && npm run dev
```

### Terminal 2: be-main (Main Backend)
```bash
npm run dev:main
# hoặc
cd apps/be-main && npm run dev
```

### Terminal 3: ui (Main Frontend)
```bash
npm run dev:ui
# hoặc
cd apps/ui && npm run dev
```

### Terminal 4: ui-bridge (Bridge Admin Frontend)
```bash
npm run dev:ui-bridge
# hoặc
cd apps/ui-bridge && npm run dev
```

## Truy cập ứng dụng

### Main Frontend (UI)
- **Trang chủ**: http://localhost:3000
- **Admin Rules**: http://localhost:3000/admin

### Bridge Admin Dashboard (ui-bridge)
- **Admin Dashboard**: http://localhost:3002
- Quản lý cấu hình be-bridge
- Quản lý API keys
- Quản lý workers
- Theo dõi trạng thái hệ thống

### Backend APIs
- **be-bridge**: http://localhost:1122
  - Health: http://localhost:1122/health
  - Admin API: http://localhost:1122/admin/*
  
- **be-main**: http://localhost:6969
  - Health: http://localhost:6969/health
  - API: http://localhost:6969/api/*

## Kiểm tra services đang chạy

```bash
# Kiểm tra be-bridge
curl http://localhost:1122/ping

# Kiểm tra be-main
curl http://localhost:6969/health

# Kiểm tra UI
curl http://localhost:3000

# Kiểm tra ui-bridge
curl http://localhost:3002
```

## Bridge Admin Dashboard (ui-bridge)

### Truy cập
Mở trình duyệt và truy cập: **http://localhost:3002**

### Tính năng
1. **Quản lý Cấu hình**: Thay đổi host, port, số lượng workers, browser settings
2. **Quản lý API Keys**: Tạo, kích hoạt, xóa API keys cho be-main
3. **Quản lý Workers**: Thêm/xóa workers, xem trạng thái
4. **Theo dõi Trạng thái**: Uptime, memory, worker stats

### Default Admin Key
- Key mặc định: `bridge_admin_default_key`
- Được tạo tự động khi be-bridge khởi động
- Lưu trong memory (không persist sau restart)

### Tạo API Key cho be-main
1. Truy cập http://localhost:3002
2. Chuyển sang tab "API Keys"
3. Nhập tên key và nhấn "Tạo Key"
4. Copy key được tạo
5. Thêm vào file `apps/be-main/.env`:
   ```env
   BRIDGE_API_KEY=<key_vừa_tạo>
   ```

## Build cho production

```bash
# Build tất cả
npm run build

# Build chỉ UI
npm run build:ui

# Build chỉ ui-bridge
npm run build:ui-bridge
```

## Start production

```bash
# Start tất cả
npm run start

# Start từng service
npm run start:bridge
npm run start:main
npm run start:ui
npm run start:ui-bridge
```

## Khắc phục sự cố

### Lỗi "Port already in use"
```bash
# Windows - Tìm process sử dụng port
netstat -ano | findstr :1122
netstat -ano | findstr :6969
netstat -ano | findstr :3000
netstat -ano | findstr :3002

# Kill process (thay PID bằng số process)
taskkill /PID <PID> /F
```

### Lỗi "Module not found"
```bash
# Cài đặt lại dependencies
npm install

# Hoặc cài đặt cho từng app
cd apps/be-bridge && npm install
cd apps/be-main && npm install
cd apps/ui && npm install
cd apps/ui-bridge && npm install
```

### Lỗi "Cannot connect to be-bridge"
1. Kiểm tra be-bridge có đang chạy không
2. Truy cập http://localhost:1122/ping để kiểm tra
3. Kiểm tra file `.env` trong `apps/ui-bridge/`

### Lỗi "Admin dashboard not found"
1. Kiểm tra ui-bridge có đang chạy không
2. Truy cập http://localhost:3002 để kiểm tra
3. Kiểm tra file `.env` trong `apps/ui-bridge/`

## Lưu ý quan trọng

1. **Chrome/Edge**: be-bridge yêu cầu Chrome hoặc Edge được cài đặt
2. **Environment files**: Đảm bảo có file `.env` trong mỗi thư mục app
3. **First run**: Lần đầu chạy sẽ mất thời gian để tải dependencies
4. **Hot reload**: Tất cả services hỗ trợ hot reload khi thay đổi code

## Development workflow

1. **Start services**: `npm run dev`
2. **Open browser**: 
   - Main UI: http://localhost:3000
   - Bridge Admin: http://localhost:3002
3. **Code changes**: Tự động reload
4. **Check logs**: Xem terminal để debug
5. **Stop services**: `Ctrl+C` trong terminal

## Ports Summary

| Service | Port | URL | Description |
|---------|------|-----|-------------|
| be-bridge | 1122 | http://localhost:1122 | Bridge Backend API |
| be-main | 6969 | http://localhost:6969 | Main Backend API |
| ui | 3000 | http://localhost:3000 | Main Frontend |
| ui-bridge | 3002 | http://localhost:3002 | Bridge Admin Frontend |