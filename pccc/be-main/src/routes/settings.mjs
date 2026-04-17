/**
 * Settings routes for admin panel
 */

export default async function settingsRoutes(fastify, options) {
  const BRIDGE_URL = options.bridgeUrl || 'http://127.0.0.1:1122';
  const BRIDGE_API_KEY = options.bridgeApiKey || '';

  // GET /api/settings - Get current settings (read-only)
  fastify.get('/settings', async (request, reply) => {
    return {
      bridge: {
        url: BRIDGE_URL,
        hasApiKey: BRIDGE_API_KEY.length > 0
      },
      server: {
        version: '1.0.0',
        nodeVersion: process.version,
        platform: process.platform
      }
    };
  });

  // GET /api/settings/bridge-status - Check bridge connection
  fastify.get('/settings/bridge-status', async (request, reply) => {
    try {
      const headers = {};
      if (BRIDGE_API_KEY) {
        headers['X-Bridge-API-Key'] = BRIDGE_API_KEY;
      }

      const response = await fetch(`${BRIDGE_URL}/health`, {
        method: 'GET',
        headers
      });

      if (!response.ok) {
        return {
          connected: false,
          error: `Bridge returned ${response.status}`
        };
      }

      const data = await response.json();
      return {
        connected: true,
        ...data
      };
    } catch (err) {
      return {
        connected: false,
        error: err.message
      };
    }
  });
}
