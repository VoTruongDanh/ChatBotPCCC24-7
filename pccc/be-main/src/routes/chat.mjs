export default async function chatRoutes(fastify, options) {
  const BRIDGE_URL = options.bridgeUrl || 'http://127.0.0.1:1110';
  const getBridgeApiKey = options.getBridgeApiKey || (() => '');

  const getHeaders = (sessionId = null) => {
    const headers = { 'Content-Type': 'application/json' };
    const key = getBridgeApiKey();
    if (key) headers['X-Bridge-API-Key'] = key;
    if (sessionId) headers['X-Session-Id'] = sessionId;
    return headers;
  };

  const mapBridgeErrorToUserMessage = (bridgeError) => {
    const raw = typeof bridgeError === 'string' ? bridgeError : String(bridgeError || '');
    const lower = raw.toLowerCase();

    if (!raw) return 'Trợ lý AI tạm thời không khả dụng. Vui lòng thử lại.';

    // Keep upload/network error detail so frontend can show exact reason.
    if (lower.includes('files.oaiusercontent.com') || lower.includes('failed upload') || lower.includes('upload ảnh')) {
      return raw;
    }

    if (lower.includes('timeout') || lower.includes('không phản hồi')) {
      return 'ChatGPT đang bận, vui lòng thử lại sau ít phút.';
    }

    return 'Trợ lý AI tạm thời không khả dụng. Vui lòng thử lại.';
  };

  // POST /api/chat - Non-streaming
  fastify.post('/chat', async (request, reply) => {
    const { prompt, messages, sessionId } = request.body || {};

    if (!prompt && (!messages || messages.length === 0)) {
      return reply.status(400).send({ error: 'Thiếu prompt hoặc messages' });
    }

    try {
      const response = await fetch(`${BRIDGE_URL}/internal/bridge/chat`, {
        method: 'POST',
        headers: getHeaders(sessionId),
        body: JSON.stringify({ prompt, messages, sessionId })
      });

      if (!response.ok) {
        const error = await response.text();
        return reply.status(response.status).send({ error });
      }

      const data = await response.json();
      return reply.send(data);
    } catch (err) {
      fastify.log.error(err);
      return reply.status(502).send({ error: 'Bridge không khả dụng' });
    }
  });

  // POST /api/chat/stream - SSE streaming
  fastify.post('/chat/stream', async (request, reply) => {
    const { prompt, messages, sessionId, image } = request.body || {};

    if (!prompt && (!messages || messages.length === 0)) {
      return reply.status(400).send({ error: 'Thiếu prompt hoặc messages' });
    }

    const promptPreview = prompt ? prompt.slice(0, 100) : messages?.map((m) => m.content).join(' ').slice(0, 100);
    fastify.log.info(`[chat/stream] New request - sessionId: ${sessionId?.slice(0, 8)}, prompt: ${promptPreview}...${image ? ' [with image]' : ''}`);

    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'Access-Control-Allow-Origin': '*'
    });

    try {
      const { getActiveRules } = await import('../services/rules.service.mjs');
      const rules = getActiveRules();

      fastify.log.info(`[chat/stream] Forwarding to bridge with ${rules.length} rules`);

      const response = await fetch(`${BRIDGE_URL}/internal/bridge/chat/stream`, {
        method: 'POST',
        headers: getHeaders(sessionId),
        body: JSON.stringify({ prompt, rules, sessionId, image })
      });

      if (!response.ok) {
        reply.raw.write(`data: ${JSON.stringify({ error: 'Trợ lý AI tạm thời không khả dụng. Vui lòng thử lại sau.' })}\n\n`);
        reply.raw.end();
        return;
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (!line.startsWith('data: ')) {
            reply.raw.write(line + '\n');
            continue;
          }

          try {
            const data = JSON.parse(line.slice(6));
            if (data.error) {
              fastify.log.warn({ bridgeError: data.error }, '[bridge-error]');
              const userMsg = mapBridgeErrorToUserMessage(data.error);
              reply.raw.write(`data: ${JSON.stringify({ error: userMsg })}\n\n`);
            } else {
              reply.raw.write(line + '\n');
            }
          } catch {
            reply.raw.write(line + '\n');
          }
        }
      }

      reply.raw.end();
    } catch (err) {
      fastify.log.error(err);
      reply.raw.write(`data: ${JSON.stringify({ error: 'Trợ lý AI tạm thời không khả dụng. Vui lòng thử lại.' })}\n\n`);
      reply.raw.end();
    }
  });

  // POST /api/reset - Reset chat session
  fastify.post('/reset', async (request, reply) => {
    const { sessionId } = request.body || {};

    try {
      const response = await fetch(`${BRIDGE_URL}/internal/bridge/reset-temp-chat`, {
        method: 'POST',
        headers: getHeaders(sessionId),
        body: JSON.stringify({ sessionId })
      });

      const data = await response.json();
      return reply.send(data);
    } catch (err) {
      fastify.log.error(err);
      return reply.status(502).send({ error: 'Bridge không khả dụng' });
    }
  });
}
