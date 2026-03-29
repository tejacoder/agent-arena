import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { taskService } from '../services/taskService.js';
import { runService } from '../services/runService.js';
import { authMiddleware, requireAuth } from '../middleware/auth.js';
import { rateLimitMiddleware } from '../middleware/rateLimit.js';
import { SubmitTaskSchema } from '../types/index.js';
import { formatError, ValidationError, AppError } from '../utils/errors.js';

/**
 * Register task routes
 */
export async function taskRoutes(fastify: FastifyInstance): Promise<void> {
  /**
   * POST /task/request
   * Request a new task assignment
   */
  fastify.post('/task/request', {
    preHandler: [rateLimitMiddleware, authMiddleware],
    handler: async (request, reply) => {
      try {
        requireAuth(request);

        const assignment = taskService.requestTaskAssignment(request.agent.id);

        reply.send({
          success: true,
          data: {
            assignment_id: assignment.assignment.id,
            task: {
              id: assignment.task.id,
              type: assignment.task.type,
              payload: assignment.task.payload,
              deadline_ms: assignment.task.deadline_ms,
              base_score: assignment.task.base_score,
            },
            assigned_at: assignment.assignment.assigned_at,
            deadline_at: assignment.deadline_at,
          },
        });
      } catch (error) {
        if (error instanceof AppError) {
          reply.code(error.statusCode).send(formatError(error));
        } else if (error instanceof Error) {
          reply.code(400).send(formatError(error));
        } else {
          throw error;
        }
      }
    },
  });

  /**
   * POST /task/submit
   * Submit task result
   */
  fastify.post('/task/submit', {
    preHandler: [rateLimitMiddleware, authMiddleware],
    handler: async (request, reply) => {
      try {
        requireAuth(request);

        // Validate input
        const parseResult = SubmitTaskSchema.safeParse(request.body);
        if (!parseResult.success) {
          const issues = parseResult.error.issues.map(
            (i) => `${i.path.join('.')}: ${i.message}`
          );
          throw new ValidationError('Invalid input', { issues: issues.join(', ') });
        }

        const result = runService.submitTaskResult(
          request.agent.id,
          parseResult.data
        );

        reply.send({
          success: true,
          data: {
            run_id: result.run.id,
            score: result.score,
            verified: result.verified,
            speed_factor: result.speed_factor,
            status: result.run.status,
          },
        });
      } catch (error) {
        if (error instanceof AppError) {
          reply.code(error.statusCode).send(formatError(error));
        } else if (error instanceof Error) {
          reply.code(400).send(formatError(error));
        } else {
          throw error;
        }
      }
    },
  });
}
