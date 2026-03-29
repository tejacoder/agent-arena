import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import { initSchema } from './models/db.js';
import { formatError, AppError } from './utils/errors.js';
import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

// Import routes
import { agentRoutes } from './routes/agent.js';
import { authRoutes } from './routes/auth.js';
import { taskRoutes } from './routes/task.js';
import { leaderboardRoutes } from './routes/leaderboard.js';
import { adminRoutes } from './routes/admin.js';

const PORT = parseInt(process.env.PORT || '3000', 10);
const HOST = process.env.HOST || '0.0.0.0';

async function buildServer() {
  const fastify = Fastify({
    logger: {
      level: process.env.LOG_LEVEL || 'info',
    },
  });

  // Security plugins
  await fastify.register(helmet);
  await fastify.register(cors, {
    origin: process.env.CORS_ORIGIN || '*',
  });

  // Initialize database schema
  initSchema();
  fastify.log.info('Database initialized');

  // Health check endpoint (no auth)
  fastify.get('/health', async () => ({
    success: true,
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: '0.1.0',
  }));

  // Serve SKILL.md documentation
  fastify.get('/SKILL.md', async (request, reply) => {
    try {
      const __filename = fileURLToPath(import.meta.url);
      const __dirname = dirname(__filename);
      const skillPath = join(__dirname, '..', 'docs', 'API_SKILL.md');
      const content = readFileSync(skillPath, 'utf-8');
      reply.type('text/markdown').send(content);
    } catch (error) {
      reply.code(404).send({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'SKILL.md not found',
        },
      });
    }
  });

  // Register routes
  await fastify.register(agentRoutes, { prefix: '' });
  await fastify.register(authRoutes, { prefix: '' });
  await fastify.register(taskRoutes, { prefix: '' });
  await fastify.register(leaderboardRoutes, { prefix: '' });
  await fastify.register(adminRoutes, { prefix: '' });

  // Global error handler
  fastify.setErrorHandler((error, request, reply) => {
    fastify.log.error(error);

    if (error instanceof AppError) {
      reply.code(error.statusCode).send(formatError(error));
      return;
    }

    // Handle Zod validation errors
    if (error.name === 'ZodError') {
      reply.code(400).send({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid input data',
        },
      });
      return;
    }

    // Unknown errors
    reply.code(500).send(formatError(error));
  });

  // 404 handler
  fastify.setNotFoundHandler((request, reply) => {
    reply.code(404).send({
      success: false,
      error: {
        code: 'NOT_FOUND',
        message: `Route ${request.method} ${request.url} not found`,
      },
    });
  });

  return fastify;
}

async function start() {
  try {
    const server = await buildServer();

    await server.listen({ port: PORT, host: HOST });

    server.log.info(`Agent Arena v0.1.0 running on http://${HOST}:${PORT}`);
  } catch (err) {
    console.error('Error starting server:', err);
    process.exit(1);
  }
}

// Start the server
start();

// Export for testing
export { buildServer };
