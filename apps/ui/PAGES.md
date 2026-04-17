# Cấu Trúc Trang Web PCCC Consult

## Các Trang Hiện Có

### 1. Trang Chủ (`/`)
**File:** `src/app/page.tsx`

**Tính năng:**
- Hero section với video background
- Chat interface với AI
- Real-time streaming response
- Connection status indicator
- Message history

**URL:** http://localhost:3000

---

### 2. Trang Dịch Vụ (`/dich-vu`)
**File:** `src/app/dich-vu/page.tsx`

**Tính năng:**
- 4 gói dịch vụ chính:
  - **Gói Cơ Bản** (5.000.000đ) - Màu xanh dương
  - **Gói Tiêu Chuẩn** (12.000.000đ) - Màu đỏ (PHỔ BIẾN)
  - **Gói Cao Cấp** (25.000.000đ) - Màu cam
  - **Gói Doanh Nghiệp** (Liên hệ) - Màu tím

- 4 dịch vụ bổ sung:
  - Kiểm định PCCC
  - Đào tạo PCCC
  - Bảo trì hệ thống
  - Tư vấn pháp lý

- FAQ section
- CTA section với nút liên hệ

**URL:** http://localhost:3000/dich-vu

---

## Cách Thêm Trang Mới

### Bước 1: Tạo folder và file
```bash
# Ví dụ: Tạo trang "Quy định"
mkdir -p apps/ui/src/app/quy-dinh
touch apps/ui/src/app/quy-dinh/page.tsx
```

### Bước 2: Tạo component
```tsx
'use client';

export default function QuyDinhPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-red-50 via-orange-50 to-yellow-50">
      {/* Navigation */}
      <nav className="bg-white/80 backdrop-blur-md shadow-sm">
        {/* Copy nav từ dich-vu/page.tsx */}
      </nav>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-6 py-16">
        <h1 className="text-5xl font-bold text-gray-900 mb-6">
          Quy Định PCCC
        </h1>
        {/* Nội dung trang */}
      </div>
    </div>
  );
}
```

### Bước 3: Cập nhật navigation
Thêm link vào navigation ở tất cả các trang:
```tsx
<Link href="/quy-dinh" className="text-gray-700 hover:text-red-600 font-medium">
  Quy định
</Link>
```

---

## Styling Guidelines

### Colors
- **Primary:** Red (#DC2626, red-600)
- **Secondary:** Orange (#F97316, orange-500)
- **Accent:** Yellow (#FBBF24, yellow-400)
- **Background:** Gradient from-red-50 via-orange-50 to-yellow-50

### Typography
- **Headings:** Font-bold, text-gray-900
- **Body:** text-gray-600 hoặc text-gray-700
- **Links:** hover:text-red-600

### Components
- **Cards:** bg-white rounded-xl shadow-md hover:shadow-xl
- **Buttons:** bg-gradient-to-r from-red-500 to-orange-500
- **Badges:** rounded-full với màu tương ứng

---

## Mock Data

### Gói Dịch Vụ
Dữ liệu mock trong `dich-vu/page.tsx`:
- 4 gói chính với giá, tính năng, màu sắc
- 4 dịch vụ bổ sung với icon, mô tả, giá

### Cách Cập Nhật
1. Mở file `apps/ui/src/app/dich-vu/page.tsx`
2. Tìm array `packages` hoặc `additionalServices`
3. Thêm/sửa/xóa items theo format có sẵn

**Ví dụ thêm gói mới:**
```tsx
{
  id: 'vip',
  name: 'Gói VIP',
  price: '50.000.000đ',
  duration: 'Một lần',
  color: 'green',
  features: [
    'Tính năng 1',
    'Tính năng 2',
    // ...
  ]
}
```

---

## Navigation Structure

```
/                    → Trang chủ (Chat AI)
/dich-vu            → Dịch vụ & Gói cước
/quy-dinh           → (Chưa có) Quy định PCCC
/ho-so              → (Chưa có) Hồ sơ mẫu
/lien-he            → (Chưa có) Liên hệ
```

---

## Development

### Chạy dev server
```bash
npm run dev
```

### Build production
```bash
npm run build
```

### Xem trang
- Trang chủ: http://localhost:3000
- Dịch vụ: http://localhost:3000/dich-vu

---

## Notes

- Tất cả trang đều dùng `'use client'` vì có interactive elements
- Navigation sticky top-0 để luôn hiển thị
- Responsive design với breakpoints md: và lg:
- Hover effects và transitions cho UX tốt hơn
