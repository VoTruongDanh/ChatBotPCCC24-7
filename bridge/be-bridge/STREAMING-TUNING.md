# Hướng Dẫn Tinh Chỉnh Streaming Detection

## Tổng Quan

Be-bridge sử dụng các tham số có thể cấu hình để phát hiện khi ChatGPT hoàn tất streaming response. Bạn có thể điều chỉnh các tham số này trong file `.env` để tối ưu cho trường hợp sử dụng của mình.

## Các Tham Số Cấu Hình

### 1. `STREAM_NO_CHANGE_THRESHOLD` (mặc định: 10)

**Mô tả:** Số lần check liên tiếp mà text không thay đổi trước khi coi như streaming đã hoàn tất.

**Cách tính thời gian:** `STREAM_NO_CHANGE_THRESHOLD × STREAM_CHECK_INTERVAL`
- Mặc định: 10 × 200ms = 2 giây

**Khi nào tăng:**
- Response bị cắt sớm (thiếu nội dung cuối)
- ChatGPT có xu hướng dừng giữa câu rồi tiếp tục

**Khi nào giảm:**
- Muốn response nhanh hơn
- ChatGPT của bạn trả lời rất nhanh và ổn định

**Ví dụ:**
```bash
# Dừng nhanh hơn (1.5 giây)
STREAM_NO_CHANGE_THRESHOLD=7

# Chắc chắn hơn (3 giây)
STREAM_NO_CHANGE_THRESHOLD=15
```

---

### 2. `STREAM_FALLBACK_THRESHOLD` (mặc định: 25)

**Mô tả:** Số lần check text không đổi để kích hoạt fallback timeout, bỏ qua `generating` flag.

**Mục đích:** Xử lý trường hợp ChatGPT UI mới không có selector đúng để phát hiện trạng thái generating.

**Cách tính thời gian:** `STREAM_FALLBACK_THRESHOLD × STREAM_CHECK_INTERVAL`
- Mặc định: 25 × 200ms = 5 giây

**Khi nào tăng:**
- Response dài bị cắt sớm
- ChatGPT có xu hướng dừng lâu giữa các đoạn

**Khi nào giảm:**
- Muốn response nhanh hơn khi `isGenerating()` không hoạt động
- Chấp nhận rủi ro cắt sớm để đổi lấy tốc độ

**Ví dụ:**
```bash
# Fallback nhanh hơn (3 giây)
STREAM_FALLBACK_THRESHOLD=15

# Fallback chậm hơn (10 giây)
STREAM_FALLBACK_THRESHOLD=50
```

---

### 3. `STREAM_MAX_TIMEOUT` (mặc định: 120000)

**Mô tả:** Thời gian tối đa (milliseconds) cho toàn bộ quá trình streaming.

**Mục đích:** Ngăn worker bị treo mãi mãi nếu có lỗi.

**Khi nào tăng:**
- Response rất dài (>2 phút)
- ChatGPT trả lời chậm

**Khi nào giảm:**
- Muốn fail fast khi có vấn đề
- Response thường ngắn

**Ví dụ:**
```bash
# Timeout ngắn hơn (1 phút)
STREAM_MAX_TIMEOUT=60000

# Timeout dài hơn (5 phút)
STREAM_MAX_TIMEOUT=300000
```

---

### 4. `STREAM_START_TIMEOUT` (mặc định: 10000)

**Mô tả:** Thời gian tối đa (milliseconds) đợi ChatGPT bắt đầu trả lời.

**Mục đích:** Phát hiện sớm khi ChatGPT không phản hồi.

**Khi nào tăng:**
- ChatGPT thường mất >10s để bắt đầu trả lời
- Mạng chậm

**Khi nào giảm:**
- Muốn fail fast
- ChatGPT thường trả lời ngay

**Ví dụ:**
```bash
# Timeout ngắn (5 giây)
STREAM_START_TIMEOUT=5000

# Timeout dài (30 giây)
STREAM_START_TIMEOUT=30000
```

---

### 5. `STREAM_CHECK_INTERVAL` (mặc định: 200)

**Mô tả:** Khoảng thời gian (milliseconds) giữa các lần check text.

**Ảnh hưởng:**
- Giá trị nhỏ = check thường xuyên hơn = phát hiện nhanh hơn nhưng tốn CPU
- Giá trị lớn = check ít hơn = tiết kiệm CPU nhưng phát hiện chậm hơn

**Khi nào giảm:**
- Muốn streaming mượt mà hơn
- CPU đủ mạnh

**Khi nào tăng:**
- Muốn tiết kiệm CPU
- Không cần streaming quá mượt

**Ví dụ:**
```bash
# Check nhanh hơn (100ms)
STREAM_CHECK_INTERVAL=100

# Check chậm hơn (500ms)
STREAM_CHECK_INTERVAL=500
```

---

## Các Preset Khuyến Nghị

### Preset 1: Nhanh & Aggressive (cho response ngắn)
```bash
STREAM_NO_CHANGE_THRESHOLD=5
STREAM_FALLBACK_THRESHOLD=15
STREAM_MAX_TIMEOUT=60000
STREAM_START_TIMEOUT=5000
STREAM_CHECK_INTERVAL=150
```

### Preset 2: Cân Bằng (mặc định)
```bash
STREAM_NO_CHANGE_THRESHOLD=10
STREAM_FALLBACK_THRESHOLD=25
STREAM_MAX_TIMEOUT=120000
STREAM_START_TIMEOUT=10000
STREAM_CHECK_INTERVAL=200
```

### Preset 3: An Toàn & Conservative (cho response dài)
```bash
STREAM_NO_CHANGE_THRESHOLD=15
STREAM_FALLBACK_THRESHOLD=50
STREAM_MAX_TIMEOUT=300000
STREAM_START_TIMEOUT=20000
STREAM_CHECK_INTERVAL=250
```

### Preset 4: Tiết Kiệm CPU
```bash
STREAM_NO_CHANGE_THRESHOLD=10
STREAM_FALLBACK_THRESHOLD=20
STREAM_MAX_TIMEOUT=120000
STREAM_START_TIMEOUT=10000
STREAM_CHECK_INTERVAL=500
```

---

## Cách Test & Tinh Chỉnh

### Bước 1: Xác định vấn đề

**Response bị cắt sớm:**
- Tăng `STREAM_NO_CHANGE_THRESHOLD`
- Tăng `STREAM_FALLBACK_THRESHOLD`

**Response chậm (đợi lâu sau khi ChatGPT trả lời xong):**
- Giảm `STREAM_NO_CHANGE_THRESHOLD`
- Giảm `STREAM_FALLBACK_THRESHOLD`
- Giảm `STREAM_CHECK_INTERVAL`

**Worker bị treo:**
- Giảm `STREAM_MAX_TIMEOUT`
- Giảm `STREAM_START_TIMEOUT`

### Bước 2: Điều chỉnh từng tham số

1. Bắt đầu với preset phù hợp
2. Test với nhiều loại message (ngắn, dài, code, văn bản)
3. Xem log để hiểu hành vi:
   ```
   [Worker] Đang đợi: generating=false, noChangeCount=10, textLength=205
   [Worker] Stream hoàn tất: không còn generate và text ổn định
   ```
4. Điều chỉnh dần dần (mỗi lần 20-30%)

### Bước 3: Verify

Test với các trường hợp:
- Message ngắn (1-2 câu)
- Message dài (nhiều đoạn văn)
- Code blocks
- Lists và tables
- Message có emoji

---

## Debug Log

Để hiểu rõ hơn về hành vi streaming, xem log của worker:

```bash
# Log mỗi 5 lần check
[Worker] Đang đợi: generating=true, noChangeCount=5, textLength=150

# Khi dừng bình thường
[Worker] Stream hoàn tất: không còn generate và text ổn định

# Khi dừng bằng fallback
[Worker] Stream hoàn tất: text ổn định quá lâu (5.0s), bỏ qua generating flag
```

**Phân tích:**
- `generating=true` → `isGenerating()` vẫn phát hiện đang generate
- `generating=false` → ChatGPT đã hoàn tất
- `noChangeCount` → Số lần text không đổi
- `textLength` → Độ dài response hiện tại

---

## Lưu Ý Quan Trọng

1. **Không có giá trị hoàn hảo:** Mỗi môi trường khác nhau (tốc độ mạng, ChatGPT version, loại content) cần tham số khác nhau.

2. **Trade-off:** Luôn có sự đánh đổi giữa tốc độ và độ chắc chắn. Tham số aggressive có thể cắt sớm, tham số conservative có thể chậm.

3. **Monitor log:** Luôn theo dõi log để hiểu hành vi và điều chỉnh phù hợp.

4. **Test kỹ:** Test với nhiều loại message trước khi deploy production.

5. **Fallback là quan trọng:** `STREAM_FALLBACK_THRESHOLD` là safety net khi `isGenerating()` không hoạt động với ChatGPT UI mới.
