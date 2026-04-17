# How to Run

Chi tiết về development, testing, và deployment.

## 🛠️ Development

### Run All Services

```bash
npm run dev
```

Turbo sẽ chạy tất cả services song song:
- `bridge/be-bridge` - Port 1122
- `bridge/ui-bridge` - Port 3002
- `pccc/be-main` - Port 6969
- `pccc/ui` - Port 3000

### Run Individual Services

```bash
# Bridge backend only
npm run dev:be-bridge

# Bridge admin only
npm run dev:ui-bridge

# PCCC backend only
npm run dev:be-main

# PCCC frontend only
npm run dev:ui
```

### Watch Mode

Tất cả services đều có hot-reload:
- Backend: `--watch` flag
- Frontend: Next.js Fast Refresh

## 🏗️ Build

### Build All

```bash
npm run build
```

### Build Individual

```bash
npm run build:bridge    # ui-bridge only
npm run build:pccc      # ui only
```

Build output:
- Next.js: `.next/` directory
- Static export: `out/` directory (nếu config)

## 🚀 Production

### Start All

```bash
npm run start
```

### Start Individual

Backend services không có start script (chạy trực tiếp):
```bash
# Bridge backend
cd bridge/be-bridge
node src/master.mjs

# PCCC backend
cd pccc/be-main
node src/index.mjs
```

Frontend services:
```bash
# Bridge admin
cd bridge/ui-bridge
npm run start

# PCCC UI
cd pccc/ui
npm run start
```

## 🐳 Docker

### PCCC Backend

```bash
cd pccc/be-main
docker-compose up -d
```

Docker compose sẽ:
- Build image từ Dockerfile
- Expose port 6969
- Mount volumes cho hot-reload

### Custom Docker

```dockerfile
# Example Dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
CMD ["node", "src/index.mjs"]
```

## 🧪 Testing

### Health Checks

```bash
# All services
curl http://localhost:1122/health
curl http://localhost:6969/health
curl http://localhost:3000
curl http://localhost:3002
```

### API Testing

```bash
# Non-streaming chat
curl -X POST http://localhost:6969/api/chat/stream \
  -H "Content-Type: application/json" \
  -d '{"prompt": "Test message"}'

# With rules
curl -X POST http://localhost:6969/api/chat/stream \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "Quy định PCCC?",
    "rules": [
      {"type": "system", "content": "Bạn là chuyên gia PCCC"}
    ]
  }'
```

### Load Testing

```bash
# Install autocannon
npm install -g autocannon

# Test endpoint
autocannon -c 10 -d 30 http://localhost:6969/health
```

## 🔍 Debugging

### Backend Logs

```bash
# Bridge backend
cd bridge/be-bridge
DEBUG=* node src/master.mjs

# PCCC backend
cd pccc/be-main
DEBUG=* node src/index.mjs
```

### Frontend Logs

Next.js logs tự động hiển thị trong terminal.

### Browser DevTools

Bridge backend sử dụng Puppeteer:
```javascript
// Thêm vào worker.mjs để debug
const browser = await puppeteer.launch({
  headless: false,  // Show browser
  devtools: true    // Open DevTools
});
```

## 📊 Monitoring

### Worker Status

```bash
# Check bridge workers
curl http://localhost:1122/health

# Response:
{
  "status": "ok",
  "workers": 2,
  "available": 2,
  "generating": 0
}
```

### Admin Dashboard

Truy cập http://localhost:3002 để xem:
- Worker status
- API keys
- System metrics
- Configuration

## 🔧 Troubleshooting

### Port Conflicts

```bash
# Find process using port
netstat -ano | findstr :1122

# Kill process
taskkill /PID <pid> /F
```

### Worker Crashes

```bash
# Check logs
cd bridge/be-bridge
node src/master.mjs

# Common issues:
# - Chrome not found
# - Port already in use
# - Memory limit
```

### Build Errors

```bash
# Clean build cache
rm -rf bridge/ui-bridge/.next
rm -rf pccc/ui/.next
rm -rf .turbo

# Rebuild
npm run build
```

## 🌍 Environment Variables

### Development

```env
NODE_ENV=development
LOG_LEVEL=debug
```

### Production

```env
NODE_ENV=production
LOG_LEVEL=info
```

### Custom

```env
# Bridge
BRIDGE_NUM_WORKERS=4
BRIDGE_HIDE_WINDOW=true

# PCCC
BRIDGE_TIMEOUT=60000
```

## 📚 Xem thêm

- [README.md](README.md) - Project overview
- [QUICK-START.md](QUICK-START.md) - Quick setup
- [CONFIG-MANAGEMENT.md](CONFIG-MANAGEMENT.md) - Config details
