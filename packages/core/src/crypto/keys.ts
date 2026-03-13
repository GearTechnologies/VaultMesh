/**
 * Keypair generation and key derivation utilities.
 */

/**
 * Derive an AES-256-GCM CryptoKey from a password using PBKDF2.
 *
 * @param password   User-provided password string.
 * @param salt       Random salt (16+ bytes). Store alongside the encrypted data.
 * @param iterations PBKDF2 iteration count (default 600_000 per NIST guidance).
 */
export async function deriveKeyFromPassword(
  password: string,
  salt: Uint8Array,
  iterations = 600_000
): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const keyMaterial = await globalThis.crypto.subtle.importKey(
    "raw",
    encoder.encode(password) as Uint8Array<ArrayBuffer>,
    "PBKDF2",
    false,
    ["deriveKey"]
  );

  return globalThis.crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: salt as Uint8Array<ArrayBuffer>,
      iterations,
      hash: "SHA-256",
    },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    true,
    ["encrypt", "decrypt"]
  );
}

/**
 * Generate a cryptographically random salt for PBKDF2.
 */
export function generateSalt(length = 16): Uint8Array {
  return globalThis.crypto.getRandomValues(new Uint8Array(length));
}

/**
 * Generate a random 256-bit seed suitable for key material.
 */
export function generateSeed(): Uint8Array {
  return globalThis.crypto.getRandomValues(new Uint8Array(32));
}

/**
 * Convert a Uint8Array to a hex string.
 */
export function toHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Convert a hex string to a Uint8Array.
 */
export function fromHex(hex: string): Uint8Array {
  if (hex.length % 2 !== 0) throw new Error("Invalid hex string");
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

/**
 * Encode Uint8Array to base64url string.
 */
export function toBase64url(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");
}

/**
 * Decode a base64url string to Uint8Array.
 */
export function fromBase64url(b64: string): Uint8Array {
  const padded = b64.replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(padded);
  return new Uint8Array([...raw].map((c) => c.charCodeAt(0)));
}
