export default async function chatRoutes(fastify, options) {
  const BRIDGE_URL = options.bridgeUrl || 'http://127.0.0.1:1110';
  const getBridgeApiKey = options.getBridgeApiKey || (() => '');

  const buildServicePackagesRule = async () => {
    const { getServicePackagesData } = await import('../services/service-packages.service.mjs');
    const serviceData = getServicePackagesData();

    if (!serviceData.packages.length && !serviceData.additionalServices.length) {
      return null;
    }

    const packageLines = serviceData.packages.map((pkg) => {
      const recommendMark = pkg.recommended ? ' [recommend]' : '';
      return `- ${pkg.name}${recommendMark}: gia ${pkg.price}, thoi luong ${pkg.duration}, tinh nang ${pkg.features.join('; ')}`;
    });

    const additionalServiceLines = serviceData.additionalServices.map((service) => (
      `- ${service.title}: ${service.price}. Mo ta: ${service.description}`
    ));

    return {
      id: 'dynamic-service-packages',
      type: 'context',
      priority: 999,
      active: true,
      name: 'Du lieu goi dich vu hien tai',
      content: [
        'Duoi day la du lieu goi dich vu PCCC hien tai, phai uu tien dung du lieu nay khi tu van:',
        'GOI DICH VU:',
        ...packageLines,
        'DICH VU BO SUNG:',
        ...additionalServiceLines,
        'Neu nguoi dung muon chon goi, hay de xuat goi phu hop theo nhu cau va quy mo. Khong tu tao bang gia ngoai du lieu nay.'
      ].join('\n')
    };
  };

  const buildSiteSalesRule = async () => {
    const { getSiteSalesContext } = await import('../services/site-sales-context.service.mjs');
    const siteContext = getSiteSalesContext();

    if (!siteContext) {
      return null;
    }

    return {
      id: 'dynamic-site-sales-context',
      type: 'context',
      priority: 998,
      active: true,
      name: 'Thong tin web va boi canh sale',
      content: [
        `Thuong hieu: ${siteContext.brandName || 'PCCC Consult'}`,
        `Thi truong: ${siteContext.market || ''}`,
        `Giong dieu thuong hieu: ${(siteContext.brandVoice || []).join(', ')}`,
        `Dich vu cot loi: ${(siteContext.coreOffers || []).join('; ')}`,
        `Muc tieu sale: ${(siteContext.salesGoals || []).join('; ')}`,
        `CTA co the dung: ${(siteContext.contactCtas || []).join('; ')}`,
        'Cac trang web chinh:',
        ...((siteContext.websitePages || []).map((page) => `- ${page.path}: ${page.title}. Muc dich: ${page.intent}`)),
        'Ghi chu sale:',
        ...((siteContext.salesNotes || []).map((note) => `- ${note}`))
      ].join('\n')
    };
  };

  const buildPageContextRule = (pageContext) => {
    if (!pageContext || typeof pageContext !== 'object') {
      return null;
    }

    const path = typeof pageContext.path === 'string' ? pageContext.path : '';
    const title = typeof pageContext.title === 'string' ? pageContext.title : '';
    const source = typeof pageContext.source === 'string' ? pageContext.source : '';
    const intent = typeof pageContext.intent === 'string' ? pageContext.intent : '';

    if (!path && !title && !source && !intent) {
      return null;
    }

    return {
      id: 'dynamic-page-context',
      type: 'context',
      priority: 997,
      active: true,
      name: 'Ngu canh gui tin hien tai',
      content: [
        'Nguoi dung dang chat voi boi canh sau:',
        path ? `- Path: ${path}` : '',
        title ? `- Ten trang: ${title}` : '',
        source ? `- Nguon gui: ${source}` : '',
        intent ? `- Muc dich trang: ${intent}` : '',
        'Can toi uu tra loi va huong sale theo boi canh nay.'
      ].filter(Boolean).join('\n')
    };
  };

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
    const { prompt, messages, sessionId, image, pageContext } = request.body || {};

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
      const servicePackagesRule = await buildServicePackagesRule();
      const siteSalesRule = await buildSiteSalesRule();
      const pageContextRule = buildPageContextRule(pageContext);
      const mergedRules = [
        ...rules,
        ...(servicePackagesRule ? [servicePackagesRule] : []),
        ...(siteSalesRule ? [siteSalesRule] : []),
        ...(pageContextRule ? [pageContextRule] : [])
      ];

      fastify.log.info(`[chat/stream] Forwarding to bridge with ${mergedRules.length} rules`);

      const response = await fetch(`${BRIDGE_URL}/internal/bridge/chat/stream`, {
        method: 'POST',
        headers: getHeaders(sessionId),
        body: JSON.stringify({ prompt, rules: mergedRules, sessionId, image })
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
