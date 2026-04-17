# Configuration Management System

## Tổng quan

Hệ thống quản lý config tập trung với **single source of truth** ở root `.env`.

## Cấu trúc

```
.
├── .env                          # ⭐ Single source of truth
├── .env.example                  # Template
├── config/
│   ├── index.js                  # Master config
│   ├── bridge.config.js          # Bridge system config
│   └── main.config.js            # Main system config
├── scripts/
│   └── sync-config.mjs           # Sync script
└── apps/
    ├── be-bridge/.env            # Auto-generated
    ├── be-main/.env              # Auto-generated
    ├── ui/.env                   # Auto-generated
    └── ui-bridge/.env            # Auto-generated
```

## Workflow

### 1. Chỉnh sửa config

**Chỉ chỉnh sửa file root `.env`**:

```bash
# Edit root .env
nano .env

# hoặc
code .env
```

### 2. Sync config sang apps

```bash
npm run config:sync
```

Output:
```
🔄 Syncing configuration from root .env...

✅ be-bridge       → apps/be-bridge/.env
✅ be-main         → apps/be-main/.env
✅ ui              → apps/ui/.env
✅ ui-bridge       → apps/ui-bridge/.env

✅ Synced 4/4 apps
```

### 3. Xem config hiện tại

```bash
# Xem tất cả config
npm run config

# Xem config bridge
npm run config:bridge

# Xem config main
npm run config:main
```

### 4. Kiểm tra config

```bash
npm run check-config
```

## Config Structure

### Root .env

```env
# ============================================
# BRIDGE SYSTEM
# ============================================
BRIDGE_HOST=127.0.0.1
BRIDGE_PORT=1122
BRIDGE_API_KEY=ACvxG%YkCOu7D+Pe
BRIDGE_ADMIN_API_KEY=bridge_admin_default_key
BRIDGE_NUM_WORKERS=2
...

# ============================================
# MAIN SYSTEM
# ============================================
MAIN_HOST=127.0.0.1
MAIN_PORT=6969
BRIDGE_URL=http://localhost:1122
...
```

### Config Modules

#### config/bridge.config.js
```javascript
const config = {
  backend: { ... },    // be-bridge config
  frontend: { ... },   // ui-bridge config
  backendUrl: '...',   // Computed
  frontendUrl: '...',  // Computed
};
```

#### config/main.config.js
```javascript
const config = {
  backend: { ... },    // be-main config
  frontend: { ... },   // ui config
  backendUrl: '...',   // Computed
  frontendUrl: '...',  // Computed
};
```

#### config/index.js
```javascript
const config = {
  bridge: bridgeConfig,
  main: mainConfig,
  allServices: { ... },
  validatePorts() { ... },
};
```

## Sử dụng trong code

### Backend (Node.js)

```javascript
// be-bridge/src/config.mjs
import bridgeConfig from '../../config/bridge.config.js';

export const HOST = bridgeConfig.backend.host;
export const PORT = bridgeConfig.backend.port;
export const NUM_WORKERS = bridgeConfig.backend.numWorkers;
```

### Frontend (Next.js)

```javascript
// ui-bridge/src/app/page.tsx
const BRIDGE_API_URL = process.env.NEXT_PUBLIC_BRIDGE_API_URL;
const ADMIN_API_KEY = process.env.NEXT_PUBLIC_ADMIN_API_KEY;
```

## Lợi ích

### ✅ Single Source of Truth
- Chỉ cần chỉnh sửa 1 file `.env` ở root
- Không còn config phân tán

### ✅ Đồng bộ tự động
- Script sync tự động tạo `.env` cho từng app
- Đảm bảo consistency

### ✅ Validation
- Validate config khi load
- Kiểm tra port conflicts
- Kiểm tra required fields

### ✅ Type Safety
- Config modules có structure rõ ràng
- Computed properties
- Easy to use trong code

### ✅ Environment Support
- Development
- Production
- Staging
- Custom environments

## Best Practices

### 1. Luôn sync sau khi edit

```bash
# Edit
nano .env

# Sync
npm run config:sync

# Verify
npm run check-config
```

### 2. Không edit app .env trực tiếp

❌ **Không làm**:
```bash
nano apps/be-bridge/.env
```

✅ **Làm**:
```bash
nano .env
npm run config:sync
```

### 3. Commit .env.example, không commit .env

```gitignore
# .gitignore
.env
apps/*/.env

# Keep examples
!.env.example
!apps/*/.env.example
```

### 4. Sử dụng config modules trong code

❌ **Không làm**:
```javascript
const port = process.env.BRIDGE_PORT || 1122;
```

✅ **Làm**:
```javascript
import bridgeConfig from '../../config/bridge.config.js';
const port = bridgeConfig.backend.port;
```

## Migration từ hệ thống cũ

### Bước 1: Backup
```bash
cp apps/be-bridge/.env apps/be-bridge/.env.backup
cp apps/be-main/.env apps/be-main/.env.backup
```

### Bước 2: Copy values vào root .env
```bash
# Manually copy values from app .env files to root .env
```

### Bước 3: Sync
```bash
npm run config:sync
```

### Bước 4: Verify
```bash
npm run check-config
npm run dev
```

## Troubleshooting

### Config không sync

```bash
# Check root .env exists
ls -la .env

# Run sync with verbose
node scripts/sync-config.mjs
```

### Port conflicts

```bash
# Check ports
npm run config

# Look for "Ports validation: FAILED"
```

### Missing variables

```bash
# Check validation
npm run config:bridge
npm run config:main
```

## Scripts Reference

| Script | Description |
|--------|-------------|
| `npm run config` | Xem tất cả config |
| `npm run config:bridge` | Xem bridge config |
| `npm run config:main` | Xem main config |
| `npm run config:sync` | Sync root .env → apps |
| `npm run check-config` | Kiểm tra config |

## Liên kết

- [Root .env](./.env)
- [Config Modules](./config/)
- [Sync Script](./scripts/sync-config.mjs)
- [HOW-TO-RUN.md](./HOW-TO-RUN.md)