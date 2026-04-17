import {
  getAllRules,
  getActiveRules,
  getRuleById,
  createRule,
  updateRule,
  deleteRule
} from '../services/rules.service.mjs';

export default async function rulesRoutes(fastify, options) {
  // GET /api/rules - Liệt kê tất cả rules
  fastify.get('/rules', async (request, reply) => {
    const rules = getAllRules();
    return { rules, total: rules.length };
  });

  // GET /api/rules/active - Lấy rules đang active
  fastify.get('/rules/active', async (request, reply) => {
    const rules = getActiveRules();
    return { rules };
  });

  // GET /api/rules/:id - Lấy rule theo id
  fastify.get('/rules/:id', async (request, reply) => {
    const { id } = request.params;
    const rule = getRuleById(id);
    if (!rule) {
      return reply.status(404).send({ error: 'Không tìm thấy rule' });
    }
    return { rule };
  });

  // POST /api/rules - Tạo rule mới
  fastify.post('/rules', async (request, reply) => {
    const { name, type, content, priority, active } = request.body || {};

    if (!name || !content) {
      return reply.status(400).send({ error: 'Thiếu name hoặc content' });
    }

    const rule = createRule({ name, type, content, priority, active });
    return reply.status(201).send({ rule });
  });

  // PUT /api/rules/:id - Cập nhật rule
  fastify.put('/rules/:id', async (request, reply) => {
    const { id } = request.params;
    const updates = request.body || {};

    const rule = updateRule(id, updates);
    if (!rule) {
      return reply.status(404).send({ error: 'Không tìm thấy rule' });
    }
    return { rule };
  });

  // DELETE /api/rules/:id - Xóa rule
  fastify.delete('/rules/:id', async (request, reply) => {
    const { id } = request.params;
    const deleted = deleteRule(id);
    if (!deleted) {
      return reply.status(404).send({ error: 'Không tìm thấy rule' });
    }
    return { success: true };
  });
}
