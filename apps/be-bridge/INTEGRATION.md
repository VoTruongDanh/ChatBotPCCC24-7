# be-bridge Integration Guide

## Overview

`be-bridge` là service trung gian giao tiếp với ChatGPT qua browser automation. Service này được thiết kế để dễ tích hợp vào các hệ thống khác.

## Authentication

### API Key

Tất cả requests (trừ `/ping` và `/health`) yêu cầu API key trong header:

```
X-Bridge-API-Key: your-secure-api-key
```

Cấu hình trong `.env`:
```bash
BRIDGE_API_KEY=your-secure-api-key-here
```

Nếu không cấu hình `BRIDGE_API_KEY`, authentication sẽ bị tắt (không khuyến nghị cho production).

## API Reference

### Health Check

```http
GET /ping
GET /health
```

Response:
```json
{
  "status": "ok",
  "workers": 2,
  "available": 1,
  "generating": 1,
  "authEnabled": true
}
```

### Chat (Non-streaming)

```http
POST /internal/bridge/chat
Content-Type: application/json
X-Bridge-API-Key: your-api-key

{
  "prompt": "Câu hỏi của bạn",
  "messages": [
    {"role": "user", "content": "Câu hỏi"}
  ]
}
```

Response:
```json
{
  "response": "Câu trả lời từ ChatGPT",
  "workerId": "abc12345"
}
```

### Chat (Streaming)

```http
POST /internal/bridge/chat/stream
Content-Type: application/json
X-Bridge-API-Key: your-api-key

{
  "prompt": "Câu hỏi của bạn",
  "messages": [...],
  "rules": [
    {
      "type": "system",
      "content": "Bạn là trợ lý AI..."
    },
    {
      "type": "context",
      "content": "Kiến thức chuyên môn..."
    },
    {
      "type": "instruction",
      "content": "Hướng dẫn trả lời..."
    }
  ]
}
```

Response (SSE):
```
data: {"delta": "Phần"}
data: {"delta": " text"}
data: {"delta": " mới"}
data: {"done": true, "response": "Phần text mới"}
```

### Reset Session

```http
POST /internal/bridge/reset-temp-chat
X-Bridge-API-Key: your-api-key
```

## Rules Structure

Rules được sử dụng để inject context vào prompt trước khi gửi đến ChatGPT:

```typescript
interface Rule {
  id: string;
  name: string;
  type: 'system' | 'context' | 'instruction';
  content: string;
  priority: number; // 1-10, lower = higher priority
  active: boolean;
}
```

### Rule Types

- **system**: Định nghĩa vai trò của AI (VD: "Bạn là chuyên gia PCCC")
- **context**: Cung cấp kiến thức chuyên môn (VD: quy định, tiêu chuẩn)
- **instruction**: Hướng dẫn cách trả lời (VD: "Trả lời ngắn gọn, chính xác")

### Prompt Building

Khi gửi rules, be-bridge sẽ build prompt theo format:

```
=== VAI TRÒ ===
[system rules sorted by priority]

=== KIẾN THỨC PCCC ===
[context rules sorted by priority]

=== HƯỚNG DẪN ===
[instruction rules sorted by priority]

=== CÂU HỎI ===
[user message]
```

## Integration Example

### Node.js

```javascript
const BRIDGE_URL = 'http://localhost:1122';
const API_KEY = 'your-api-key';

async function chat(prompt, rules = []) {
  const response = await fetch(`${BRIDGE_URL}/internal/bridge/chat/stream`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Bridge-API-Key': API_KEY
    },
    body: JSON.stringify({ prompt, rules })
  });

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let result = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    const chunk = decoder.decode(value);
    const lines = chunk.split('\n');

    for (const line of lines) {
      if (line.startsWith('data: ')) {
        const data = JSON.parse(line.slice(6));
        if (data.delta) result += data.delta;
        if (data.done) return data.response;
      }
    }
  }

  return result;
}
```

### Python

```python
import requests
import json

BRIDGE_URL = 'http://localhost:1122'
API_KEY = 'your-api-key'

def chat(prompt, rules=[]):
    headers = {
        'Content-Type': 'application/json',
        'X-Bridge-API-Key': API_KEY
    }
    
    data = {
        'prompt': prompt,
        'rules': rules
    }
    
    response = requests.post(
        f'{BRIDGE_URL}/internal/bridge/chat/stream',
        headers=headers,
        json=data,
        stream=True
    )
    
    result = ''
    for line in response.iter_lines():
        if line:
            line = line.decode('utf-8')
            if line.startswith('data: '):
                data = json.loads(line[6:])
                if 'delta' in data:
                    result += data['delta']
                if data.get('done'):
                    return data['response']
    
    return result
```

## Error Handling

### Error Response Format

```json
{
  "error": "Error message"
}
```

### Common Errors

| Status | Error | Description |
|--------|-------|-------------|
| 401 | Missing API key | No `X-Bridge-API-Key` header |
| 401 | Invalid API key | API key doesn't match |
| 400 | Thiếu prompt hoặc messages | Request body missing required fields |
| 503 | Không có worker sẵn sàng | All workers are busy |
| 500 | Internal error | Browser or ChatGPT error |

## Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `HOST` | 127.0.0.1 | Server host |
| `PORT` | 1122 | Server port |
| `BRIDGE_API_KEY` | - | API key for authentication |
| `NUM_WORKERS` | 2 | Number of browser instances |
| `CHAT_URL` | https://chatgpt.com/?temporary-chat=true | ChatGPT URL |
| `STREAM_MAX_TIMEOUT` | 120000 | Max streaming timeout (ms) |

## Requirements

- Node.js 18+
- Chrome hoặc Edge (Windows)
- ChatGPT account (logged in)
