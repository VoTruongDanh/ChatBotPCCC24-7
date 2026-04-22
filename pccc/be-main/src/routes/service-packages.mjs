import {
  getServicePackagesData,
  saveServicePackagesData
} from '../services/service-packages.service.mjs';

export default async function servicePackagesRoutes(fastify) {
  fastify.get('/service-packages', async () => {
    const data = getServicePackagesData();
    return {
      ...data,
      totalPackages: data.packages.length,
      totalAdditionalServices: data.additionalServices.length
    };
  });

  fastify.put('/service-packages', async (request, reply) => {
    const { packages, additionalServices } = request.body || {};

    if (!Array.isArray(packages) || !Array.isArray(additionalServices)) {
      return reply.status(400).send({
        error: 'packages và additionalServices phải là array'
      });
    }

    const data = saveServicePackagesData({ packages, additionalServices });
    return { success: true, ...data };
  });
}
