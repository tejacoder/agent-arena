import type { FastifyRequest, FastifyReply } from 'fastify';
import { RateLimitError } from '../utils/errors.js';

interface TokenBucket {
  tokens: number;
  lastRefill: number;
}

interface RateLimitConfig {
  capacity: number;
  refillRate: number; // tokens per second
}

const DEFAULT_CONFIG: RateLimitConfig = {
  capacity: 10,
  refillRate: 1, // 1 token per second
};

// In-memory storage for token buckets
const buckets = new Map<string, TokenBucket>();

/**
 * Get or create a token bucket for a key (agent ID or IP)
 */
function getBucket(key: string, config: RateLimitConfig): TokenBucket {
  const now = Date.now();
  const existing = buckets.get(key);

  if (!existing) {
    const bucket: TokenBucket = {
      tokens: config.capacity,
      lastRefill: now,
    };
    buckets.set(key, bucket);
    return bucket;
  }

  // Refill tokens based on time elapsed
  const timeElapsedMs = now - existing.lastRefill;
  const tokensToAdd = (timeElapsedMs / 1000) * config.refillRate;

  existing.tokens = Math.min(
    config.capacity,
    existing.tokens + tokensToAdd
  );
  existing.lastRefill = now;

  return existing;
}

/**
 * Check if request is allowed and consume a token
 */
function consumeToken(key: string, config: RateLimitConfig): {
  allowed: boolean;
  remaining: number;
  resetTime: number;
} {
  const bucket = getBucket(key, config);

  if (bucket.tokens < 1) {
    // Calculate time until next token is available
    const msPerToken = 1000 / config.refillRate;
    const timeUntilReset = msPerToken - (Date.now() - bucket.lastRefill) % msPerToken;

    return {
      allowed: false,
      remaining: 0,
      resetTime: Date.now() + timeUntilReset,
    };
  }

  bucket.tokens -= 1;

  // Calculate reset time (when bucket will be full)
  const tokensNeeded = config.capacity - bucket.tokens;
  const msToRefill = (tokensNeeded / config.refillRate) * 1000;

  return {
    allowed: true,
    remaining: Math.floor(bucket.tokens),
    resetTime: Date.now() + msToRefill,
  };
}

/**
 * Rate limiting middleware factory
 */
export function createRateLimitMiddleware(config: Partial<RateLimitConfig> = {}) {
  const fullConfig = { ...DEFAULT_CONFIG, ...config };

  return function rateLimitMiddleware(
    request: FastifyRequest,
    reply: FastifyReply,
    done: (err?: Error) => void
  ): void {
    // Use agent ID if authenticated, otherwise use IP
    const key = request.agent?.id || request.ip || 'anonymous';

    const result = consumeToken(key, fullConfig);

    // Set rate limit headers
    reply.header('X-RateLimit-Limit', fullConfig.capacity);
    reply.header('X-RateLimit-Remaining', result.remaining);
    reply.header('X-RateLimit-Reset', Math.ceil(result.resetTime / 1000));

    if (!result.allowed) {
      const retryAfter = Math.ceil((result.resetTime - Date.now()) / 1000);
      reply.header('Retry-After', retryAfter);

      reply.code(429).send({
        success: false,
        error: {
          code: 'RATE_LIMIT_EXCEEDED',
          message: 'Rate limit exceeded. Please slow down.',
        },
      });
      return;
    }

    done();
  };
}

// Default rate limiter
export const rateLimitMiddleware = createRateLimitMiddleware();

// Cleanup old buckets periodically (every 5 minutes)
setInterval(() => {
  const now = Date.now();
  const maxAge = 10 * 60 * 1000; // 10 minutes

  for (const [key, bucket] of buckets.entries()) {
    if (now - bucket.lastRefill > maxAge) {
      buckets.delete(key);
    }
  }
}, 5 * 60 * 1000);
