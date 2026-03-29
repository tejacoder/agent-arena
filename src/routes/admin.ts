import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { taskService } from '../services/taskService.js';
import { rateLimitMiddleware } from '../middleware/rateLimit.js';
import { CreateTaskSchema } from '../types/index.js';
import { formatError, ValidationError, NotFoundError } from '../utils/errors.js';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

// Admin API key - in production, use proper admin authentication
const ADMIN_API_KEY = process.env.ADMIN_API_KEY || 'dev-admin-key';

/**
 * Simple admin authentication middleware
 */
function adminAuthMiddleware(
  request: any,
  reply: any,
  done: (err?: Error) => void
): void {
  const authHeader = request.headers['x-admin-key'];

  if (authHeader !== ADMIN_API_KEY) {
    reply.code(403).send({
      success: false,
      error: {
        code: 'FORBIDDEN',
        message: 'Admin access required',
      },
    });
    return;
  }

  done();
}

/**
 * Register admin routes
 */
export async function adminRoutes(fastify: FastifyInstance): Promise<void> {
  /**
   * POST /admin/tasks
   * Create a new task (admin only)
   */
  fastify.post('/admin/tasks', {
    preHandler: [rateLimitMiddleware, adminAuthMiddleware],
    handler: async (request, reply) => {
      try {
        // Validate input
        const parseResult = CreateTaskSchema.safeParse(request.body);
        if (!parseResult.success) {
          const issues = parseResult.error.issues.map(
            (i) => `${i.path.join('.')}: ${i.message}`
          );
          throw new ValidationError('Invalid input', { issues: issues.join(', ') });
        }

        const task = taskService.createTask(parseResult.data);

        reply.code(201).send({
          success: true,
          data: task,
          message: 'Task created successfully',
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
   * GET /admin/tasks
   * List all tasks (admin only)
   */
  fastify.get('/admin/tasks', {
    preHandler: [rateLimitMiddleware, adminAuthMiddleware],
    handler: async (request, reply) => {
      try {
        const tasks = taskService.listTasks();

        reply.send({
          success: true,
          data: tasks,
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
   * DELETE /admin/tasks/:id
   * Deactivate a task (admin only)
   */
  fastify.delete('/admin/tasks/:id', {
    preHandler: [rateLimitMiddleware, adminAuthMiddleware],
    handler: async (request, reply) => {
      try {
        const { id } = request.params as { id: string };

        taskService.deactivateTask(id);

        reply.send({
          success: true,
          message: 'Task deactivated successfully',
        });
      } catch (error) {
        if (error instanceof NotFoundError) {
          reply.code(404).send(formatError(error));
        } else if (error instanceof Error) {
          reply.code(400).send(formatError(error));
        } else {
          throw error;
        }
      }
    },
  });

  /**
   * POST /admin/seed
   * Generate 100 tasks (admin only)
   * Useful for fresh deployments
   */
  fastify.post('/admin/seed', {
    preHandler: [rateLimitMiddleware, adminAuthMiddleware],
    handler: async (request, reply) => {
      try {
        // Run the generate tasks script
        const { stdout, stderr } = await execAsync('node dist/scripts/generate-100-tasks.js');
        
        if (stderr && !stderr.includes('ExperimentalWarning')) {
          console.error('Seed error:', stderr);
        }

        reply.send({
          success: true,
          message: 'Tasks generated successfully',
          output: stdout,
        });
      } catch (error) {
        console.error('Seed execution error:', error);
        reply.code(500).send({
          success: false,
          error: {
            code: 'SEED_ERROR',
            message: 'Failed to generate tasks',
          },
        });
      }
    },
  });
}
