/**
 * Simple crypto utilities that work across all runtimes
 * Does not depend on Node.js crypto or Web Crypto API
 */

/**
 * Generate a random ID for database records
 * @returns A random 21-character string
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
 * @param size Number of bytes to generate
 * @returns Hex string of random bytes
 */
export function randomBytes(size: number): string {
  const hexChars = '0123456789abcdef';
  let result = '';
  for (let i = 0; i < size * 2; i++) {
    result += hexChars.charAt(Math.floor(Math.random() * hexChars.length));
  }
  return result;
}

/**
 * Generate a random ID with specified length
 * @param length Length of the ID in bytes (actual string will be 2x this length)
 * @returns Random hex string
 */
export function generateId(length: number = 8): string {
  return randomBytes(length);
}

/**
 * Simple hash function that works across all environments
 * Note: This is NOT cryptographically secure - only for basic hashing purposes
 * @param data Data to hash
 * @returns Simple hash string
 */
export async function createHash(data: string): Promise<string> {
  // Simple string hash function
  let hash = 0;
  for (let i = 0; i < data.length; i++) {
    const char = data.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  
  // Convert to hex string
  const hashHex = Math.abs(hash).toString(16).padStart(8, '0');
  return hashHex;
}

/**
 * Simple hash implementation for API compatibility
 * Creates a Hashable-like object with update() and digest() methods 
 * for compatibility with Node.js crypto API
 */
export function createHashObject(algorithm = 'sha256') {
  // Hold the data to be hashed
  let data = '';
  
  return {
    // Update the hash with new data
    update(input: string | Buffer | ArrayBuffer | Uint8Array): any {
      // Convert input to string
      if (typeof input === 'string') {
        data += input;
      } else if (input instanceof Buffer) {
        data += input.toString();
      } else if (input instanceof ArrayBuffer || input instanceof Uint8Array) {
        const view = new Uint8Array(input);
        for (let i = 0; i < view.length; i++) {
          data += String.fromCharCode(view[i]);
        }
      }
      
      // Return this for chaining
      return this;
    },
    
    // Finalize the hash and get the digest
    digest(encoding: 'hex' | 'base64' = 'hex'): string {
      // Simple hash implementation using string manipulation
      let hash = 0;
      for (let i = 0; i < data.length; i++) {
        hash = ((hash << 5) - hash) + data.charCodeAt(i);
        hash = hash & hash; // Convert to 32bit integer
      }
      
      // Convert to required format
      const hashHex = Math.abs(hash).toString(16).padStart(8, '0');
      
      if (encoding === 'base64') {
        try {
          // Try to use btoa if available (browsers)
          return btoa(hashHex);
        } catch (e) {
          // Fallback for environments without btoa
          return Buffer.from(hashHex).toString('base64');
        }
      }
      
      // Default to hex
      return hashHex;
    }
  };
} 