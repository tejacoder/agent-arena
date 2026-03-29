import crypto from 'crypto';
import bcrypt from 'bcryptjs';

const SALT_ROUNDS = 12;
const API_KEY_PREFIX = 'aa_';
const API_KEY_LENGTH = 48;

/**
 * Generate a cryptographically secure API key
 * Format: aa_<48 random hex chars>
 */
export function generateApiKey(): string {
  const randomBytes = crypto.randomBytes(API_KEY_LENGTH / 2);
  const hexString = randomBytes.toString('hex');
  return `${API_KEY_PREFIX}${hexString}`;
}

/**
 * Hash an API key using bcrypt
 */
export async function hashApiKey(apiKey: string): Promise<string> {
  return bcrypt.hash(apiKey, SALT_ROUNDS);
}

/**
 * Verify an API key against its hash
 */
export async function verifyApiKey(apiKey: string, hash: string): Promise<boolean> {
  return bcrypt.compare(apiKey, hash);
}

/**
 * Generate a unique ID with optional prefix
 */
export function generateId(prefix: string): string {
  const timestamp = Date.now().toString(36);
  const random = crypto.randomBytes(6).toString('hex');
  return `${prefix}_${timestamp}${random}`;
}

/**
 * Check if a string looks like a valid API key format
 */
export function isValidApiKeyFormat(apiKey: string): boolean {
  return (
    apiKey.startsWith(API_KEY_PREFIX) &&
    apiKey.length === API_KEY_PREFIX.length + API_KEY_LENGTH &&
    /^[a-f0-9]+$/.test(apiKey.slice(API_KEY_PREFIX.length))
  );
}
