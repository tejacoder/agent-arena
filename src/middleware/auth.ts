import type { FastifyRequest, FastifyReply, HookHandlerDoneFunction } from 'fastify';
import { agentService } from '../services/agentService.js';
import { UnauthorizedError } from '../utils/errors.js';
import type { Agent, AuthHeaders } from '../types/index.js';

// Extend Fastify request to include agent
declare module 'fastify' {
  interface FastifyRequest {
    agent?: Agent;
  }
}

export interface AuthenticatedRequest extends FastifyRequest {
  agent: Agent;
}

/**
 * Middleware to validate Bearer token and attach agent to request
 */
export async function authMiddleware(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  try {
    // Get authorization header
    const authHeader = request.headers.authorization;
    if (!authHeader) {
      throw new UnauthorizedError('Missing authorization header');
    }

    // Validate Bearer format
    const parts = authHeader.split(' ');
    if (parts.length !== 2 || parts[0] !== 'Bearer') {
      throw new UnauthorizedError('Authorization must be Bearer token');
    }

    const apiKey = parts[1];
    if (!apiKey) {
      throw new UnauthorizedError('Missing API key');
    }

    // Verify API key
    const agent = await agentService.verifyApiKey(apiKey);
    if (!agent) {
      throw new UnauthorizedError('Invalid API key');
    }

    // Attach agent to request
    request.agent = agent;
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      reply.code(401).send({
        success: false,
        error: {
          code: error.code,
          message: error.message,
        },
      });
      return;
    }
    throw error;
  }
}

/**
 * Helper to check if request is authenticated (for TypeScript)
 */
export function requireAuth(request: FastifyRequest): asserts request is AuthenticatedRequest {
  if (!request.agent) {
    throw new UnauthorizedError('Authentication required');
  }
}
