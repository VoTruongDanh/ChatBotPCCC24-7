# Config Management

Hệ thống quản lý config module-based với 2 file .env độc lập.

## 📁 Cấu trúc

```
bridge/.env          # Config cho bridge module
pccc/.env            # Config cho pccc module
```

Mỗi module .env sẽ tự động sync sang app .env files.

## 🔧 Workflow

### 1. Edit Module Config

```bash
# Bridge module
nano bridge/.env

# PCCC module
nano pccc/.env
```

### 2. Sync to Apps

```bash
npm run config:sync
```

Output:
```
✅ be-bridge  → bridge/be-bridge/.env
✅ ui-bridge  → bridge/ui-bridge/.env
✅ be-main    → pccc/be-main/.env
✅ ui         → pccc/ui/.env
```

### 3. Verify

```bash
# Check synced files
cat bridge/be-bridge/.env
cat pccc/be-main/.env
```

## 🔑 Config Variables

### Bridge Module (`bridge/.env`)

```env
# Backend
BRIDGE_HOST=127.0.0.1
BRIDGE_PORT=1122
BRIDGE_API_KEY=your_key
BRIDGE_ADMIN_API_KEY=admin_key
BRIDGE_NUM_WORKERS=2
BRIDGE_PREFERRED_BROWSER=chrome

# Frontend
UI_BRIDGE_PORT=3002
NEXT_PUBLIC_BRIDGE_API_URL=http://localhost:1122
NEXT_PUBLIC_ADMIN_API_KEY=admin_key
```

### PCCC Module (`pccc/.env`)

```env
# Backend
MAIN_HOST=127.0.0.1
MAIN_PORT=6969
BRIDGE_URL=http://localhost:1122
BRIDGE_API_KEY=your_key

# Frontend
UI_PORT=3000
NEXT_PUBLIC_API_URL=http://localhost:6969
```

## ✅ Best Practices

1. **Single Source**: Chỉ edit module .env, không edit app .env trực tiếp
2. **Always Sync**: Sau khi edit, luôn chạy `npm run config:sync`
3. **Same API Key**: `BRIDGE_API_KEY` phải giống nhau ở bridge và pccc
4. **Version Control**: Commit `.env.example`, không commit `.env`

## 🔒 Security

- Module `.env` files trong `.gitignore`
- API keys không được hardcode trong code
- Sử dụng `.env.example` làm template

## 📚 Xem thêm

- [QUICK-START.md](QUICK-START.md) - Quick setup
- [HOW-TO-RUN.md](HOW-TO-RUN.md) - Development guide