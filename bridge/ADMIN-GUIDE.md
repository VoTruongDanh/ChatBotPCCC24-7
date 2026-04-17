# Bridge Admin Guide

Hướng dẫn sử dụng Bridge Admin Dashboard.

## 🌐 Truy cập

**URL**: http://localhost:3002

**Yêu cầu**: Admin API Key (từ `bridge/.env`)

## 🔑 Admin API Key

Admin API Key được cấu hình trong `bridge/.env`:

```env
BRIDGE_ADMIN_API_KEY=your_admin_key_here
```

Key này dùng để xác thực khi truy cập admin dashboard.

## 📊 Dashboard Overview

Dashboard có 4 tabs chính:

### 1. 📈 Status - Trạng thái hệ thống

**Xem:**
- System info (uptime, memory, platform)
- Worker status (total, available, busy)
- Authentication status
- Configuration summary

**Sử dụng:**
- Kiểm tra health của bridge
- Monitor worker availability
- Xem resource usage

### 2. ⚙️ Config - Cấu hình

**Xem và chỉnh sửa:**
- Host & Port
- Number of workers
- Browser settings (Chrome/Edge)
- Window settings (hide, minimize, offscreen)
- Streaming parameters

**Cách sử dụng:**
1. Click tab "Config"
2. Xem current configuration
3. Edit values (nếu cần)
4. Click "Save" để lưu

**Lưu ý:**
- Thay đổi config yêu cầu restart service
- Backup config trước khi thay đổi

### 3. 🔐 API Keys - Quản lý keys

**Chức năng:**
- Xem danh sách API keys
- Tạo key mới
- Active/Deactive keys
- Xóa keys

**Tạo key mới:**
1. Click tab "API Keys"
2. Click "Generate New Key"
3. Nhập tên cho key (VD: "Production Key")
4. Click "Create"
5. **Copy key ngay** (chỉ hiện 1 lần)

**Format key:**
```
bridge_abc123def456...
```

**Sử dụng key:**
```bash
# be-main sử dụng key để kết nối be-bridge
curl -X POST http://localhost:1122/internal/bridge/chat \
  -H "X-Bridge-API-Key: bridge_abc123..." \
  -H "Content-Type: application/json" \
  -d '{"prompt": "Hello"}'
```

**Quản lý keys:**
- **Active**: Key có thể sử dụng
- **Inactive**: Key bị vô hiệu hóa
- **Delete**: Xóa key vĩnh viễn

### 4. 👷 Workers - Quản lý workers

**Xem:**
- Danh sách workers
- Worker ID
- Status (busy/available)
- Last activity

**Thêm workers:**
1. Click tab "Workers"
2. Click "Add Worker"
3. Nhập số lượng (VD: 2)
4. Click "Add"

**Xóa workers:**
1. Click "Remove Worker"
2. Nhập số lượng
3. Click "Remove"

**Lưu ý:**
- Chỉ xóa được workers đang available
- Busy workers không thể xóa

## 🚀 Use Cases

### Case 1: Tăng workers khi traffic cao

**Tình huống**: Nhiều requests đồng thời, workers bận hết

**Giải pháp:**
1. Vào tab "Status" → Xem workers available = 0
2. Vào tab "Workers"
3. Click "Add Worker" → Thêm 2-3 workers
4. Kiểm tra lại tab "Status"

### Case 2: Gen key cho môi trường mới

**Tình huống**: Deploy staging environment, cần key riêng

**Giải pháp:**
1. Vào tab "API Keys"
2. Click "Generate New Key"
3. Tên: "Staging Environment"
4. Copy key
5. Cập nhật vào staging `.env`:
   ```env
   BRIDGE_API_KEY=bridge_new_key_here
   ```

### Case 3: Revoke key bị lộ

**Tình huống**: API key bị leak, cần vô hiệu hóa

**Giải pháp:**
1. Vào tab "API Keys"
2. Tìm key bị leak
3. Click "Deactivate" (hoặc "Delete")
4. Gen key mới
5. Update vào production

### Case 4: Thay đổi browser

**Tình huống**: Đổi từ Chrome sang Edge

**Giải pháp:**
1. Vào tab "Config"
2. Tìm "Preferred Browser"
3. Đổi từ "chrome" → "edge"
4. Click "Save"
5. Restart bridge service:
   ```bash
   npm run dev:be-bridge
   ```

## 🔧 Troubleshooting

### Admin dashboard không load

**Nguyên nhân:**
- be-bridge chưa chạy
- Port 3002 bị chiếm
- Admin API key sai

**Giải pháp:**
```bash
# Check be-bridge
curl http://localhost:1122/health

# Check ui-bridge
curl http://localhost:3002

# Restart
npm run dev:be-bridge
npm run dev:ui-bridge
```

### Không tạo được key

**Nguyên nhân:**
- Admin API key không đúng
- be-bridge không response

**Giải pháp:**
1. Check admin key trong `bridge/.env`
2. Verify key trong browser DevTools → Network
3. Check be-bridge logs

### Workers không tăng

**Nguyên nhân:**
- Chrome/Edge không cài
- Memory không đủ
- Port conflict

**Giải pháp:**
```bash
# Check browser
where chrome
where msedge

# Check memory
# Windows: Task Manager
# Linux: free -h

# Check logs
cd bridge/be-bridge
node src/master.mjs
```

## 📱 API Endpoints

Admin dashboard sử dụng các endpoints sau:

### GET /admin/status
```bash
curl http://localhost:1122/admin/status \
  -H "X-Admin-API-Key: your_admin_key"
```

Response:
```json
{
  "system": {
    "uptime": 3600,
    "memory": {...},
    "platform": "win32"
  },
  "bridge": {
    "workers": {
      "total": 2,
      "available": 2,
      "busy": 0
    }
  }
}
```

### GET /admin/keys
```bash
curl http://localhost:1122/admin/keys \
  -H "X-Admin-API-Key: your_admin_key"
```

### POST /admin/keys
```bash
curl -X POST http://localhost:1122/admin/keys \
  -H "X-Admin-API-Key: your_admin_key" \
  -H "Content-Type: application/json" \
  -d '{"name": "My New Key"}'
```

### GET /admin/workers
```bash
curl http://localhost:1122/admin/workers \
  -H "X-Admin-API-Key: your_admin_key"
```

### POST /admin/workers
```bash
curl -X POST http://localhost:1122/admin/workers \
  -H "X-Admin-API-Key: your_admin_key" \
  -H "Content-Type: application/json" \
  -d '{"count": 2}'
```

## 🔒 Security Best Practices

1. **Đổi admin key mặc định**
   ```env
   # Không dùng
   BRIDGE_ADMIN_API_KEY=bridge_admin_default_key
   
   # Dùng key mạnh
   BRIDGE_ADMIN_API_KEY=bridge_$(openssl rand -hex 32)
   ```

2. **Không expose admin dashboard ra internet**
   - Chỉ bind localhost
   - Dùng VPN/SSH tunnel nếu cần remote access

3. **Rotate keys định kỳ**
   - Gen key mới mỗi 3-6 tháng
   - Deactivate keys cũ

4. **Monitor key usage**
   - Check "Last Used" trong dashboard
   - Xóa keys không dùng

5. **Backup config**
   ```bash
   cp bridge/.env bridge/.env.backup
   ```

## 📚 Xem thêm

- [README.md](../README.md) - Project overview
- [QUICK-START.md](../QUICK-START.md) - Quick setup
- [CONFIG-MANAGEMENT.md](../CONFIG-MANAGEMENT.md) - Config guide
- [HOW-TO-RUN.md](../HOW-TO-RUN.md) - Development guide
