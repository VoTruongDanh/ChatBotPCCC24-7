export default async function chatRoutes(fastify, options) {
  const BRIDGE_URL = options.bridgeUrl || 'http://127.0.0.1:1122';
  const BRIDGE_API_KEY = options.bridgeApiKey || '';

  // Helper to add auth header if configured
  const getHeaders = () => {
    const headers = { 'Content-Type': 'application/json' };
    if (BRIDGE_API_KEY) {
      headers['X-Bridge-API-Key'] = BRIDGE_API_KEY;
    }
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
        headers: getHeaders(),
        body: JSON.stringify({ prompt, messages })
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

    // SSE headers
    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*'
    });

    try {
      // Lấy rules từ service
      const { getActiveRules } = await import('../services/rules.service.mjs');
      const rules = getActiveRules();

      const response = await fetch(`${BRIDGE_URL}/internal/bridge/chat/stream`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ prompt, messages, rules })
      });

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        reply.raw.write(chunk);
      }

      reply.raw.end();
    } catch (err) {
      fastify.log.error(err);
      reply.raw.write(`data: ${JSON.stringify({ error: 'Bridge không khả dụng' })}\n\n`);
      reply.raw.end();
    }
  });

  // POST /api/reset - Reset chat session
  fastify.post('/reset', async (request, reply) => {
    try {
      const response = await fetch(`${BRIDGE_URL}/internal/bridge/reset-temp-chat`, {
        method: 'POST',
        headers: getHeaders()
      });

      const data = await response.json();
      return reply.send(data);
    } catch (err) {
      fastify.log.error(err);
      return reply.status(502).send({ error: 'Bridge không khả dụng' });
    }
  });
}
