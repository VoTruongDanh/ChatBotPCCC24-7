# ui-bridge

Frontend Admin Dashboard cho be-bridge, được xây dựng với Next.js 15, React 18, TypeScript và Tailwind CSS.

## Tính năng

### 1. Quản lý Cấu hình (Config)
- **Cài đặt cơ bản**: Host, Port, số lượng Workers
- **Cài đặt Browser**: Trình duyệt ưu tiên (Chrome/Edge), Chat URL, ẩn cửa sổ
- **Cài đặt Streaming**: Timeouts, thresholds
- **API Key cho be-main**: Tạo và quản lý API key

### 2. Quản lý API Keys
- Tạo API key mới với tên tùy chỉnh
- Xem danh sách keys đang hoạt động
- Kích hoạt/vô hiệu hóa keys
- Xóa keys không cần thiết
- Hiển thị/ẩn giá trị key (bảo mật)

### 3. Quản lý Workers
- Theo dõi số lượng workers đang hoạt động
- Xem trạng thái từng worker (sẵn sàng/đang xử lý)
- Thêm worker mới vào pool
- Xóa worker khỏi pool (chỉ khi không busy)

### 4. Theo dõi Trạng thái
- **Thông tin hệ thống**: Uptime, memory usage, Node.js version
- **Thông tin Bridge**: Địa chỉ, port, trạng thái xác thực
- **Thông tin Workers**: Số lượng, trạng thái chi tiết
- **Thông tin Admin**: Số lượng API keys

## Cài đặt

### 1. Cài đặt dependencies
```bash
cd apps/ui-bridge
npm install
```

### 2. Cấu hình environment
Tạo file `.env` từ `.env.example`:
```env
# be-bridge API URL
NEXT_PUBLIC_BRIDGE_API_URL=http://localhost:1122

# Admin API Key (default: bridge_admin_default_key)
NEXT_PUBLIC_ADMIN_API_KEY=bridge_admin_default_key
```

## Chạy ứng dụng

### Development
```bash
# Từ root
npm run dev:ui-bridge

# Hoặc từ thư mục ui-bridge
cd apps/ui-bridge
npm run dev
```

### Production
```bash
# Build
npm run build:ui-bridge

# Start
npm run start:ui-bridge
```

## Truy cập

Mở trình duyệt và truy cập: **http://localhost:3002**

## Cấu trúc thư mục

```
apps/ui-bridge/
├── src/
│   └── app/
│       ├── globals.css      # Global styles
│       ├── layout.tsx       # Root layout
│       └── page.tsx         # Main admin dashboard page
├── public/                  # Static files
├── .env                     # Environment variables
├── .env.example             # Environment template
├── package.json             # Dependencies
├── tsconfig.json            # TypeScript config
├── tailwind.config.ts       # Tailwind config
├── postcss.config.js        # PostCSS config
└── next.config.js           # Next.js config
```

## API Endpoints

Dashboard giao tiếp với be-bridge qua các endpoints:

### Admin Endpoints (yêu cầu X-Admin-API-Key header)
- `GET /admin/config` - Lấy cấu hình hiện tại
- `PUT /admin/config` - Cập nhật cấu hình
- `GET /admin/keys` - Lấy danh sách API keys
- `POST /admin/keys` - Tạo API key mới
- `GET /admin/keys/:id` - Lấy thông tin API key
- `PUT /admin/keys/:id` - Cập nhật API key
- `DELETE /admin/keys/:id` - Xóa API key
- `GET /admin/status` - Lấy trạng thái hệ thống
- `GET /admin/workers` - Lấy danh sách workers
- `POST /admin/workers` - Thêm workers
- `DELETE /admin/workers` - Xóa workers

## Công nghệ sử dụng

- **Next.js 15**: React framework
- **React 18**: UI library
- **TypeScript**: Type safety
- **Tailwind CSS**: Styling
- **Lucide React**: Icons

## Bảo mật

### Production recommendations
1. **Đổi admin key mặc định** trong environment
2. **Sử dụng HTTPS** cho production environment
3. **Giới hạn IP truy cập** nếu cần
4. **Không commit API keys** vào repository

## Khắc phục sự cố

### Lỗi "Cannot connect to be-bridge"
1. Kiểm tra be-bridge có đang chạy không
2. Kiểm tra `NEXT_PUBLIC_BRIDGE_API_URL` trong `.env`
3. Kiểm tra CORS settings trong be-bridge

### Lỗi "Missing admin API key"
1. Kiểm tra `NEXT_PUBLIC_ADMIN_API_KEY` trong `.env`
2. Default key: `bridge_admin_default_key`

### Lỗi CORS
1. Đảm bảo be-bridge cho phép origin của ui-bridge
2. Kiểm tra headers trong be-bridge CORS config

## Liên kết
- [be-bridge Source](../be-bridge/)
- [Main UI](../ui/)
- [Root README](../../README.md)