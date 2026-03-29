import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { agentService } from '../services/agentService.js';
import { authMiddleware, requireAuth } from '../middleware/auth.js';
import { rateLimitMiddleware } from '../middleware/rateLimit.js';
import { RegisterAgentSchema } from '../types/index.js';
import { formatError, ValidationError } from '../utils/errors.js';

// Schema for agent ID parameter
const AgentIdParamSchema = z.object({
  id: z.string().min(1),
});

/**
 * Register agent routes
 */
export async function agentRoutes(fastify: FastifyInstance): Promise<void> {
  /**
   * POST /agent/register
   * Register a new agent and receive API key
   */
  fastify.post('/agent/register', {
    preHandler: [rateLimitMiddleware],
    handler: async (request, reply) => {
      try {
        // Validate input
        const parseResult = RegisterAgentSchema.safeParse(request.body);
        if (!parseResult.success) {
          const issues = parseResult.error.issues.map(
            (i) => `${i.path.join('.')}: ${i.message}`
          );
          throw new ValidationError('Invalid input', { issues: issues.join(', ') });
        }

        // Register agent
        const agent = await agentService.registerAgent(parseResult.data);

        reply.code(201).send({
          success: true,
          data: {
            agent_id: agent.id,
            api_key: agent.api_key, // Show ONCE
            name: agent.name,
            created_at: agent.created_at,
          },
          message: 'IMPORTANT: Save your API key. It will not be shown again.',
        });
      } catch (error) {
        if (error instanceof Error) {
          reply.code(400).send(formatError(error));
        } else {
          throw error;
        }
      }
    },
  });

  /**
   * GET /agent/:id
   * Get agent stats (requires authentication)
   */
  fastify.get('/agent/:id', {
    preHandler: [rateLimitMiddleware, authMiddleware],
    handler: async (request, reply) => {
      try {
        requireAuth(request);

        // Validate parameter
        const parseResult = AgentIdParamSchema.safeParse(request.params);
        if (!parseResult.success) {
          throw new ValidationError('Invalid agent ID');
        }

        const { id } = parseResult.data;

        // Agents can only view their own stats (or admin in future)
        if (request.agent.id !== id) {
          reply.code(403).send({
            success: false,
            error: {
              code: 'FORBIDDEN',
              message: 'Can only view own agent stats',
            },
          });
          return;
        }

        const agent = agentService.getAgentById(id);
        if (!agent) {
          reply.code(404).send({
            success: false,
            error: {
              code: 'NOT_FOUND',
              message: 'Agent not found',
            },
          });
          return;
        }

        reply.send({
          success: true,
          data: {
            id: agent.id,
            name: agent.name,
            created_at: agent.created_at,
            last_seen_at: agent.last_seen_at,
            total_runs: agent.total_runs,
            avg_score: agent.avg_score,
            is_active: agent.is_active,
          },
        });
      } catch (error) {
        if (error instanceof Error) {
          reply.code(400).send(formatError(error));
        } else {
          throw error;
        }
      }
    },
  });
}
