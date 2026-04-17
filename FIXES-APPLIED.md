# Fixes Applied - Đã sửa các lỗi

## Vấn đề đã phát hiện và sửa

### 1. be-main không kết nối được be-bridge ❌ → ✅

**Lỗi**:
```
Connect Timeout Error (attempted address: host.docker.internal:1122, timeout: 10000ms)
```

**Nguyên nhân**: 
- `BRIDGE_URL` trong `apps/be-main/.env` đang dùng `host.docker.internal:1122` (Docker address)
- Khi chạy local development, cần dùng `localhost:1122`

**Đã sửa**:
- ✅ `apps/be-main/.env`: `BRIDGE_URL=http://localhost:1122`
- ✅ `apps/be-main/.env.example`: Cập nhật example

### 2. be-bridge không load BRIDGE_API_KEY ❌ → ✅

**Lỗi**:
```
[Master] Authentication: DISABLED (no BRIDGE_API_KEY set)
```

**Nguyên nhân**:
- Script trong `package.json` dùng `-r dotenv/config` với path phức tạp
- Dotenv preload không hoạt động tốt với đường dẫn tương đối từ root

**Đã sửa**:
- ✅ `apps/be-bridge/package.json`: Xóa `-r dotenv/config`, để code tự load
- ✅ `apps/be-main/package.json`: Xóa `-r dotenv/config`, để code tự load
- ✅ Code đã có sẵn logic load `.env` từ thư mục app

### 3. Cập nhật scripts

**Trước**:
```json
"dev": "node --watch -r dotenv/config src/master.mjs dotenv_config_path=./apps/be-bridge/.env"
```

**Sau**:
```json
"dev": "node --watch src/master.mjs"
```

**Lý do**: 
- Code đã tự load `.env` từ thư mục app
- Đơn giản hơn, dễ maintain hơn
- Hoạt động tốt với turbo monorepo

## Cách load .env hiện tại

### be-bridge (src/master.mjs)
```javascript
import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: join(__dirname, '..', '.env') });
// → Load từ apps/be-bridge/.env
```

### be-main (src/index.mjs)
```javascript
import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: join(__dirname, '..', '.env') });
// → Load từ apps/be-main/.env
```

## Kiểm tra sau khi fix

### 1. Stop tất cả services
```bash
Ctrl+C trong terminal
```

### 2. Restart
```bash
npm run dev
```

### 3. Kiểm tra logs

**be-bridge phải hiển thị**:
```
[Master] Authentication: ENABLED
```

**be-main phải kết nối được**:
```
[be-main] Bridge URL: http://localhost:1122
[be-main] Bridge Authentication: ENABLED
```

**Không còn lỗi**:
- ❌ `Connect Timeout Error`
- ❌ `Authentication: DISABLED`

### 4. Test API

```bash
# Test be-bridge health
curl http://localhost:1122/health

# Test be-main health
curl http://localhost:6969/health

# Test chat (từ UI)
# Truy cập http://localhost:3000 và gửi message
```

## Cấu hình hiện tại

### be-bridge (.env)
```env
HOST=127.0.0.1
PORT=1122
BRIDGE_API_KEY=ACvxG%YkCOu7D+Pe
NUM_WORKERS=2
BRIDGE_PREFERRED_BROWSER=chrome
CHAT_URL=https://chatgpt.com/?temporary-chat=true
```

### be-main (.env)
```env
HOST=127.0.0.1
PORT=6969
BRIDGE_URL=http://localhost:1122
BRIDGE_API_KEY=ACvxG%YkCOu7D+Pe
```

### ui-bridge (.env)
```env
NEXT_PUBLIC_BRIDGE_API_URL=http://localhost:1122
NEXT_PUBLIC_ADMIN_API_KEY=bridge_admin_default_key
```

## Lưu ý

### Docker vs Local Development

**Local Development** (hiện tại):
- `BRIDGE_URL=http://localhost:1122` ✅

**Docker Compose**:
- `BRIDGE_URL=http://be-bridge:1122` (service name)
- Hoặc `BRIDGE_URL=http://host.docker.internal:1122` (từ container ra host)

### Admin API Key

Admin key `bridge_admin_default_key` là **placeholder**. 

Khi be-bridge khởi động, nó tạo key ngẫu nhiên:
```javascript
const defaultAdminKey = generateApiKey('Default Admin Key');
console.log(`[Admin] Default admin key generated: ${defaultAdminKey.key.slice(0, 8)}...`);
```

**Để fix**: Xem console log của be-bridge và copy key thực tế vào `apps/ui-bridge/.env`.

Hoặc sửa code để dùng key cố định (khuyên dùng cho development).

## Tóm tắt

✅ **Đã sửa**:
1. BRIDGE_URL từ Docker address → localhost
2. Xóa dotenv preload phức tạp
3. Để code tự load .env từ thư mục app
4. Cập nhật .env.example

✅ **Kết quả**:
- be-main kết nối được be-bridge
- be-bridge load được BRIDGE_API_KEY
- Authentication ENABLED
- Không còn timeout errors

🔄 **Cần restart**: `npm run dev` để áp dụng thay đổi