import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { leaderboardService } from '../services/leaderboardService.js';
import { rateLimitMiddleware } from '../middleware/rateLimit.js';
import { formatError, ValidationError } from '../utils/errors.js';

// Query validation schema
const LeaderboardQuerySchema = z.object({
  limit: z
    .string()
    .default('10')
    .transform((val) => parseInt(val, 10))
    .pipe(z.number().int().positive().max(100)),
  offset: z
    .string()
    .default('0')
    .transform((val) => parseInt(val, 10))
    .pipe(z.number().int().nonnegative()),
});

/**
 * Register leaderboard routes
 */
export async function leaderboardRoutes(fastify: FastifyInstance): Promise<void> {
  /**
   * GET /leaderboard
   * Get ranked list of agents
   */
  fastify.get('/leaderboard', {
    preHandler: [rateLimitMiddleware],
    handler: async (request, reply) => {
      try {
        // Validate and parse query parameters
        const parseResult = LeaderboardQuerySchema.safeParse(request.query);
        if (!parseResult.success) {
          throw new ValidationError('Invalid query parameters');
        }

        const { limit, offset } = parseResult.data;

        const result = leaderboardService.getLeaderboard(limit, offset);

        reply.send({
          success: true,
          data: {
            entries: result.entries,
            pagination: {
              total: result.total,
              limit,
              offset,
              has_more: offset + result.entries.length < result.total,
            },
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
