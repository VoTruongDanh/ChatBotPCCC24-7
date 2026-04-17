# Troubleshooting - PCCC Consult UI

## Vấn đề: Nút "Dịch vụ" không click được

### Nguyên nhân có thể:
1. **Browser cache** - Trình duyệt đang cache phiên bản cũ
2. **Next.js chưa compile** - Trang mới chưa được build
3. **JavaScript error** - Có lỗi trong console

### Giải pháp:

#### 1. Hard Refresh Browser
**Windows/Linux:**
- Chrome/Edge: `Ctrl + Shift + R` hoặc `Ctrl + F5`
- Firefox: `Ctrl + Shift + R`

**Mac:**
- Chrome/Edge: `Cmd + Shift + R`
- Firefox: `Cmd + Shift + R`

#### 2. Mở Incognito/Private Window
- Chrome: `Ctrl + Shift + N`
- Firefox: `Ctrl + Shift + P`
- Edge: `Ctrl + Shift + N`

#### 3. Clear Browser Cache
1. Mở DevTools: `F12`
2. Right-click vào nút Refresh
3. Chọn "Empty Cache and Hard Reload"

#### 4. Kiểm tra Console Errors
1. Mở DevTools: `F12`
2. Tab "Console"
3. Xem có lỗi màu đỏ không
4. Nếu có lỗi, copy và báo lại

#### 5. Restart Next.js Dev Server
```bash
# Stop server (Ctrl+C trong terminal)
# Sau đó chạy lại:
npm run dev
```

#### 6. Xóa .next cache
```bash
# Stop server trước
rm -rf apps/ui/.next
npm run dev
```

---

## Vấn đề: Trang /dich-vu trả về 404

### Kiểm tra:
1. File `apps/ui/src/app/dich-vu/page.tsx` có tồn tại không?
2. Server có đang chạy không?
3. Port 3000 có bị chiếm không?

### Giải pháp:
```bash
# Kiểm tra file tồn tại
ls apps/ui/src/app/dich-vu/page.tsx

# Restart server
npm run dev

# Kiểm tra port
netstat -ano | findstr :3000
```

---

## Vấn đề: Link không hoạt động (full page reload)

### Nguyên nhân:
Đang dùng `<a href>` thay vì Next.js `<Link>`

### Giải pháp:
```tsx
// ❌ Sai - full page reload
<a href="/dich-vu">Dịch vụ</a>

// ✅ Đúng - client-side navigation
import Link from 'next/link';
<Link href="/dich-vu">Dịch vụ</Link>
```

---

## Vấn đề: Styling không hiển thị đúng

### Kiểm tra:
1. Tailwind CSS có compile không?
2. File `postcss.config.js` đúng format chưa?
3. File `tailwind.config.js` có cấu hình content paths chưa?

### Giải pháp:
```bash
# Xóa cache và rebuild
rm -rf apps/ui/.next
npm run dev
```

---

## Vấn đề: TypeScript errors

### Kiểm tra:
```bash
# Check TypeScript errors
cd apps/ui
npx tsc --noEmit
```

### Giải pháp:
- Sửa lỗi TypeScript theo message
- Hoặc tạm thời ignore: `// @ts-ignore`

---

## Debug Tips

### 1. Xem Network Requests
1. F12 → Network tab
2. Click nút "Dịch vụ"
3. Xem request nào được gửi
4. Status code là gì? (200 = OK, 404 = Not Found)

### 2. Xem React DevTools
1. Cài extension: React Developer Tools
2. F12 → Components tab
3. Xem component tree
4. Kiểm tra props và state

### 3. Xem Next.js Logs
```bash
# Terminal đang chạy npm run dev
# Xem log compile và errors
```

### 4. Test trực tiếp URL
Mở browser và gõ trực tiếp:
```
http://localhost:3000/dich-vu
```

Nếu trang hiển thị → Link có vấn đề
Nếu 404 → Trang chưa tồn tại

---

## Liên hệ Support

Nếu vẫn không giải quyết được:
1. Chụp screenshot lỗi
2. Copy console errors
3. Copy terminal logs
4. Mô tả chi tiết bước đã thử
