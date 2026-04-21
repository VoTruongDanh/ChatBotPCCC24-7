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
    const { prompt, messages, sessionId } = request.body || {};

    if (!prompt && (!messages || messages.length === 0)) {
      return reply.status(400).send({ error: 'Thiếu prompt hoặc messages' });
    }

    // Log request để debug
    const promptPreview = prompt ? prompt.slice(0, 100) : messages?.map(m => m.content).join(' ').slice(0, 100);
    fastify.log.info(`[chat/stream] New request - sessionId: ${sessionId?.slice(0, 8)}, prompt: ${promptPreview}...`);

    // SSE headers
    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*'
    });

    try {
      const { getActiveRules } = await import('../services/rules.service.mjs');
      const rules = getActiveRules();

      fastify.log.info(`[chat/stream] Forwarding to bridge with ${rules.length} rules`);

      const response = await fetch(`${BRIDGE_URL}/internal/bridge/chat/stream`, {
        method: 'POST',
        headers: getHeaders(sessionId),
        body: JSON.stringify({ prompt, rules, sessionId })
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

        // Parse và filter error messages kỹ thuật
        const lines = chunk.split('\n');
        for (const line of lines) {
          if (!line.startsWith('data: ')) { reply.raw.write(line + '\n'); continue; }
          try {
            const data = JSON.parse(line.slice(6));
            if (data.error) {
              // Log kỹ thuật cho admin, trả về message thân thiện cho user
              fastify.log.warn('[bridge-error]', data.error);
              const userMsg = data.error.includes('Timeout') || data.error.includes('không phản hồi')
                ? 'ChatGPT đang bận, vui lòng thử lại sau ít phút.'
                : 'Trợ lý AI tạm thời không khả dụng. Vui lòng thử lại.';
              reply.raw.write(`data: ${JSON.stringify({ error: userMsg })}\n\n`);
            } else {
              reply.raw.write(line + '\n');
            }
          } catch { reply.raw.write(line + '\n'); }
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
