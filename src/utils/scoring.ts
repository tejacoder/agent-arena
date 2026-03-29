import type { VerificationMethod } from '../types/index.js';

/**
 * Calculate score based on base score, deadline, execution time, and verification
 * Formula: score = base_score * min(deadline_ms / execution_time_ms, 2.0)
 * Returns 0 if not verified or execution time exceeds deadline
 */
export function calculateScore(
  baseScore: number,
  deadlineMs: number,
  executionTimeMs: number,
  isVerified: boolean
): number {
  if (!isVerified) return 0;
  if (executionTimeMs > deadlineMs) return 0;

  // Speed factor: faster = higher multiplier (1.0 - 2.0)
  const speedFactor = deadlineMs / executionTimeMs;
  const clampedFactor = Math.min(speedFactor, 2.0);

  return Math.round(baseScore * clampedFactor);
}

/**
 * Verify a result based on the verification method and expected result
 */
export function verifyResult(
  result: unknown,
  expectedResult: unknown,
  method: VerificationMethod
): boolean {
  switch (method) {
    case 'exact_match':
      return verifyExactMatch(result, expectedResult);

    case 'contains':
      return verifyContains(result, expectedResult);

    case 'range':
      return verifyRange(result, expectedResult);

    default:
      return false;
  }
}

/**
 * Verify exact match (deep equality for objects, strict equality for primitives)
 */
function verifyExactMatch(result: unknown, expected: unknown): boolean {
  if (typeof result !== typeof expected) return false;

  if (result === null || expected === null) {
    return result === expected;
  }

  if (typeof result === 'object' && typeof expected === 'object') {
    const resultObj = result as Record<string, unknown>;
    const expectedObj = expected as Record<string, unknown>;

    const resultKeys = Object.keys(resultObj);
    const expectedKeys = Object.keys(expectedObj);

    if (resultKeys.length !== expectedKeys.length) return false;

    for (const key of expectedKeys) {
      if (!resultKeys.includes(key)) return false;
      if (!verifyExactMatch(resultObj[key], expectedObj[key])) return false;
    }

    return true;
  }

  return result === expected;
}

/**
 * Verify that result contains expected content
 * For strings: checks if result includes expected string
 * For arrays: checks if result array contains expected items
 * For objects: checks if result object contains expected key-value pairs
 */
function verifyContains(result: unknown, expected: unknown): boolean {
  if (typeof result === 'string' && typeof expected === 'string') {
    return result.includes(expected);
  }

  if (Array.isArray(result) && Array.isArray(expected)) {
    return expected.every((item) =>
      result.some((r) => verifyExactMatch(r, item))
    );
  }

  if (
    typeof result === 'object' &&
    result !== null &&
    typeof expected === 'object' &&
    expected !== null
  ) {
    const resultObj = result as Record<string, unknown>;
    const expectedObj = expected as Record<string, unknown>;

    for (const [key, value] of Object.entries(expectedObj)) {
      if (!(key in resultObj)) return false;
      if (typeof value === 'object' && value !== null) {
        if (!verifyContains(resultObj[key], value)) return false;
      } else {
        if (resultObj[key] !== value) return false;
      }
    }

    return true;
  }

  return false;
}

/**
 * Verify that numeric result is within expected range
 * Expected format: { min?: number, max?: number }
 */
function verifyRange(result: unknown, expected: unknown): boolean {
  if (typeof result !== 'number') return false;

  const range = expected as { min?: number; max?: number } | undefined;
  if (!range || typeof range !== 'object') return false;

  if (range.min !== undefined && result < range.min) return false;
  if (range.max !== undefined && result > range.max) return false;

  return true;
}
