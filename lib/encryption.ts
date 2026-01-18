import { randomBytes, createCipheriv, createDecipheriv } from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const TAG_LENGTH = 16;

// Get encryption key from environment variable
function getEncryptionKey(): Buffer {
  const key = process.env.ENCRYPTION_KEY;
  if (!key) {
    throw new Error('ENCRYPTION_KEY environment variable is not set');
  }
  // Key should be 32 bytes for AES-256
  if (key.length !== 32) {
    throw new Error('ENCRYPTION_KEY must be exactly 32 characters');
  }
  return Buffer.from(key, 'utf-8');
}

export interface EncryptedData {
  ciphertext: string;
  iv: string;
  tag: string;
}

/**
 * Encrypt a plaintext string using AES-256-GCM
 */
export function encrypt(plaintext: string): EncryptedData {
  const key = getEncryptionKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);

  let ciphertext = cipher.update(plaintext, 'utf-8', 'base64');
  ciphertext += cipher.final('base64');

  const tag = cipher.getAuthTag();

  return {
    ciphertext,
    iv: iv.toString('base64'),
    tag: tag.toString('base64'),
  };
}

/**
 * Decrypt encrypted data using AES-256-GCM
 */
export function decrypt(encryptedData: EncryptedData): string {
  const key = getEncryptionKey();
  const iv = Buffer.from(encryptedData.iv, 'base64');
  const tag = Buffer.from(encryptedData.tag, 'base64');
  const ciphertext = Buffer.from(encryptedData.ciphertext, 'base64');

  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);

  let plaintext = decipher.update(ciphertext);
  plaintext = Buffer.concat([plaintext, decipher.final()]);

  return plaintext.toString('utf-8');
}

/**
 * Encrypt a token and return a JSON string for database storage
 */
export function encryptToken(token: string): string {
  const encrypted = encrypt(token);
  return JSON.stringify(encrypted);
}

/**
 * Decrypt a token from its JSON string format
 */
export function decryptToken(encryptedJson: string): string {
  const encrypted: EncryptedData = JSON.parse(encryptedJson);
  return decrypt(encrypted);
}

/**
 * Check if a string appears to be an encrypted token (JSON format)
 */
export function isEncrypted(value: string): boolean {
  try {
    const parsed = JSON.parse(value);
    return (
      typeof parsed === 'object' &&
      parsed !== null &&
      'ciphertext' in parsed &&
      'iv' in parsed &&
      'tag' in parsed
    );
  } catch {
    return false;
  }
}
