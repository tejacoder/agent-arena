import type { FastifyInstance } from 'fastify';
import { authMiddleware, requireAuth } from '../middleware/auth.js';
import { rateLimitMiddleware } from '../middleware/rateLimit.js';
import { formatError } from '../utils/errors.js';

/**
 * Register auth routes
 */
export async function authRoutes(fastify: FastifyInstance): Promise<void> {
  /**
   * POST /auth/verify
   * Verify that the Bearer token is valid
   */
  fastify.post('/auth/verify', {
    preHandler: [rateLimitMiddleware, authMiddleware],
    handler: async (request, reply) => {
      try {
        requireAuth(request);

        reply.send({
          success: true,
          data: {
            agent_id: request.agent.id,
            name: request.agent.name,
            verified: true,
          },
        });
      } catch (error) {
        if (error instanceof Error) {
          reply.code(401).send(formatError(error));
        } else {
          throw error;
        }
      }
    },
  });
}
