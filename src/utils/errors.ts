export class AppError extends Error {
  public readonly code: string;
  public readonly statusCode: number;
  public readonly isOperational: boolean;

  constructor(
    message: string,
    code: string,
    statusCode: number = 500,
    isOperational: boolean = true
  ) {
    super(message);
    this.code = code;
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    Error.captureStackTrace(this, this.constructor);
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string, identifier?: string) {
    super(
      identifier ? `${resource} not found: ${identifier}` : `${resource} not found`,
      'NOT_FOUND',
      404
    );
  }
}

export class UnauthorizedError extends AppError {
  constructor(message: string = 'Unauthorized') {
    super(message, 'UNAUTHORIZED', 401);
  }
}

export class ForbiddenError extends AppError {
  constructor(message: string = 'Forbidden') {
    super(message, 'FORBIDDEN', 403);
  }
}

export class ValidationError extends AppError {
  public readonly details: Record<string, string>;

  constructor(message: string, details: Record<string, string> = {}) {
    super(message, 'VALIDATION_ERROR', 400);
    this.details = details;
  }
}

export class ConflictError extends AppError {
  constructor(message: string) {
    super(message, 'CONFLICT', 409);
  }
}

export class RateLimitError extends AppError {
  public readonly retryAfter: number;

  constructor(retryAfter: number = 1) {
    super('Rate limit exceeded', 'RATE_LIMIT_EXCEEDED', 429);
    this.retryAfter = retryAfter;
  }
}

export class TaskAssignmentError extends AppError {
  constructor(message: string) {
    super(message, 'TASK_ASSIGNMENT_ERROR', 400);
  }
}

export class VerificationError extends AppError {
  constructor(message: string = 'Result verification failed') {
    super(message, 'VERIFICATION_FAILED', 400);
  }
}

// Error response formatter
export function formatError(error: Error): { success: false; error: { code: string; message: string; details?: Record<string, string> } } {
  if (error instanceof AppError) {
    const response: { success: false; error: { code: string; message: string; details?: Record<string, string> } } = {
      success: false,
      error: {
        code: error.code,
        message: error.message,
      },
    };

    if (error instanceof ValidationError && Object.keys(error.details).length > 0) {
      response.error.details = error.details;
    }

    return response;
  }

  // Unknown error - don't expose details in production
  return {
    success: false,
    error: {
      code: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred',
    },
  };
}
