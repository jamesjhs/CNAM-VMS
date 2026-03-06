/**
 * Password hashing and verification using Node.js built-in crypto (scrypt).
 * No external dependencies required.
 */

import { scrypt, randomBytes, timingSafeEqual } from 'crypto';
import { promisify } from 'util';

const scryptAsync = promisify(scrypt);

const SALT_BYTES = 16;
const KEY_LENGTH = 64;
const SEPARATOR = '.';

/**
 * Hash a plaintext password with scrypt.
 * Returns "hex-hash.hex-salt".
 */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(SALT_BYTES).toString('hex');
  const hash = (await scryptAsync(password, salt, KEY_LENGTH)) as Buffer;
  return `${hash.toString('hex')}${SEPARATOR}${salt}`;
}

/**
 * Verify a plaintext password against a stored hash.
 */
export async function verifyPassword(
  password: string,
  storedHash: string,
): Promise<boolean> {
  const parts = storedHash.split(SEPARATOR);
  if (parts.length !== 2) return false;
  const [hashHex, salt] = parts;
  try {
    const incoming = (await scryptAsync(password, salt, KEY_LENGTH)) as Buffer;
    const stored = Buffer.from(hashHex, 'hex');
    if (incoming.length !== stored.length) return false;
    return timingSafeEqual(incoming, stored);
  } catch {
    return false;
  }
}
