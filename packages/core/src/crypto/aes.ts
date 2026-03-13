/**
 * AES-256-GCM encryption/decryption using the Web Crypto API.
 * Works in both browser and Node.js environments via globalThis.crypto.
 */

const ALGORITHM = "AES-GCM";
const KEY_LENGTH = 256;
const IV_LENGTH = 12; // 96-bit IV recommended for GCM

/**
 * Generate a new 256-bit AES-GCM CryptoKey.
 */
export async function generateVaultKey(): Promise<CryptoKey> {
  return globalThis.crypto.subtle.generateKey(
    { name: ALGORITHM, length: KEY_LENGTH },
    true,
    ["encrypt", "decrypt"]
  );
}

/**
 * Export a CryptoKey to raw bytes.
 */
export async function exportKey(key: CryptoKey): Promise<Uint8Array> {
  const raw = await globalThis.crypto.subtle.exportKey("raw", key);
  return new Uint8Array(raw);
}

/**
 * Import raw bytes as an AES-GCM CryptoKey.
 */
export async function importKey(raw: Uint8Array): Promise<CryptoKey> {
  return globalThis.crypto.subtle.importKey(
    "raw",
    raw as Uint8Array<ArrayBuffer>,
    { name: ALGORITHM },
    true,
    ["encrypt", "decrypt"]
  );
}

/**
 * Encrypt a plaintext string with AES-256-GCM.
 * Returns the ciphertext and the random IV used.
 */
export async function encrypt(
  plaintext: string,
  key: CryptoKey
): Promise<{ ciphertext: Uint8Array; iv: Uint8Array }> {
  const encoder = new TextEncoder();
  const iv = globalThis.crypto.getRandomValues(new Uint8Array(IV_LENGTH));
  const encoded = encoder.encode(plaintext);

  const encrypted = await globalThis.crypto.subtle.encrypt(
    { name: ALGORITHM, iv },
    key,
    encoded
  );

  return { ciphertext: new Uint8Array(encrypted), iv };
}

/**
 * Decrypt ciphertext bytes back to a plaintext string.
 */
export async function decrypt(
  ciphertext: Uint8Array,
  iv: Uint8Array,
  key: CryptoKey
): Promise<string> {
  const decrypted = await globalThis.crypto.subtle.decrypt(
    { name: ALGORITHM, iv: iv as Uint8Array<ArrayBuffer> },
    key,
    ciphertext as Uint8Array<ArrayBuffer>
  );
  return new TextDecoder().decode(decrypted);
}
