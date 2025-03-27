/**
 * Cross-runtime compatible crypto functions
 * Provides consistent crypto functions that work in both Node.js and Bun
 */

/**
 * Simple crypto utility functions that don't depend on Node.js crypto
 */

/**
 * Generate a random ID for database records
 */
export function generateUUID(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let id = '';
  for (let i = 0; i < 21; i++) {
    id += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return id;
}

/**
 * Generate random bytes and return as hex string
 */
export function randomHex(size: number): string {
  const hexChars = '0123456789abcdef';
  let result = '';
  for (let i = 0; i < size * 2; i++) {
    result += hexChars.charAt(Math.floor(Math.random() * hexChars.length));
  }
  return result;
} 