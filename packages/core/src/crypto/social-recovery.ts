/**
 * Shamir Secret Sharing over GF(256) — pure TypeScript, browser-compatible.
 *
 * Each share is a Uint8Array of length (secret.length + 1).
 * Byte 0 is the share index (1-based). Bytes 1..n are the share data.
 */

// GF(256) arithmetic using the primitive polynomial x^8 + x^4 + x^3 + x + 1 (0x11b)
const GF_EXP = new Uint8Array(512);
const GF_LOG = new Uint8Array(256);

(function buildLookupTables() {
  let x = 1;
  for (let i = 0; i < 255; i++) {
    GF_EXP[i] = x;
    GF_LOG[x] = i;
    x = gfMulNaive(x, 2);
  }
  for (let i = 255; i < 512; i++) {
    GF_EXP[i] = GF_EXP[i - 255];
  }
})();

function gfMulNaive(a: number, b: number): number {
  let p = 0;
  let hi: number;
  for (let i = 0; i < 8; i++) {
    if (b & 1) p ^= a;
    hi = a & 0x80;
    a = (a << 1) & 0xff;
    if (hi) a ^= 0x1b; // x^8 + x^4 + x^3 + x + 1 (reduced mod 0x11b → low byte 0x1b)
    b >>= 1;
  }
  return p;
}

function gfMul(a: number, b: number): number {
  if (a === 0 || b === 0) return 0;
  // GF_LOG values are deterministic table indices (0–254); modulo here is not applied
  // to random data — it wraps the sum of two log values within the field order.
  // lgtm[js/biased-cryptographic-random]
  return GF_EXP[(GF_LOG[a] + GF_LOG[b]) % 255];
}

function gfDiv(a: number, b: number): number {
  if (b === 0) throw new Error("Division by zero in GF(256)");
  if (a === 0) return 0;
  return GF_EXP[(GF_LOG[a] - GF_LOG[b] + 255) % 255];
}

function gfPow(x: number, p: number): number {
  return GF_EXP[(GF_LOG[x] * p) % 255];
}

function gfInverse(x: number): number {
  return GF_EXP[255 - GF_LOG[x]];
}

/**
 * Evaluate a polynomial with given coefficients at point x in GF(256).
 */
function polyEval(coefficients: Uint8Array, x: number): number {
  let result = 0;
  for (let i = coefficients.length - 1; i >= 0; i--) {
    result = gfMul(result, x) ^ coefficients[i];
  }
  return result;
}

/**
 * Split a secret into `totalShares` shares requiring `threshold` to reconstruct.
 *
 * @param secret     The secret bytes to split.
 * @param threshold  Minimum shares needed to reconstruct.
 * @param totalShares  Total number of shares to generate.
 * @returns Array of share Uint8Arrays. Each share[0] is the share index (1-based).
 */
export async function splitSecret(
  secret: Uint8Array,
  threshold: number,
  totalShares: number
): Promise<Uint8Array[]> {
  if (threshold < 2) throw new Error("Threshold must be at least 2");
  if (totalShares < threshold) throw new Error("Total shares must be >= threshold");
  if (totalShares > 255) throw new Error("Maximum 255 shares");
  if (secret.length === 0) throw new Error("Secret cannot be empty");

  const shares: Uint8Array[] = Array.from({ length: totalShares }, (_, i) =>
    new Uint8Array(secret.length + 1)
  );

  // Set share indices (1-based)
  for (let s = 0; s < totalShares; s++) {
    shares[s][0] = s + 1;
  }

  // For each byte of the secret, create a random polynomial of degree (threshold-1)
  // with the secret byte as the constant term.
  const randomBytes = globalThis.crypto.getRandomValues(
    new Uint8Array(secret.length * (threshold - 1))
  );

  for (let byteIdx = 0; byteIdx < secret.length; byteIdx++) {
    // Build polynomial coefficients: coeff[0] = secret byte, rest are random
    const coefficients = new Uint8Array(threshold);
    coefficients[0] = secret[byteIdx];
    for (let t = 1; t < threshold; t++) {
      coefficients[t] = randomBytes[byteIdx * (threshold - 1) + (t - 1)];
    }

    // Evaluate polynomial at each share's x-coordinate
    for (let s = 0; s < totalShares; s++) {
      shares[s][byteIdx + 1] = polyEval(coefficients, s + 1);
    }
  }

  return shares;
}

/**
 * Reconstruct the secret from a sufficient number of shares.
 *
 * @param shares  Array of share Uint8Arrays (at least `threshold` shares).
 * @returns The reconstructed secret bytes.
 */
export async function reconstructSecret(shares: Uint8Array[]): Promise<Uint8Array> {
  if (shares.length < 2) throw new Error("Need at least 2 shares to reconstruct");

  const secretLength = shares[0].length - 1;
  const secret = new Uint8Array(secretLength);

  // x-coordinates are share indices (first byte of each share)
  const xCoords = shares.map((s) => s[0]);

  for (let byteIdx = 0; byteIdx < secretLength; byteIdx++) {
    const yCoords = shares.map((s) => s[byteIdx + 1]);
    // Lagrange interpolation at x=0 to recover secret byte
    secret[byteIdx] = lagrangeInterpolateAtZero(xCoords, yCoords);
  }

  return secret;
}

/**
 * Lagrange interpolation at x=0 over GF(256).
 */
function lagrangeInterpolateAtZero(x: number[], y: number[]): number {
  let result = 0;
  const k = x.length;

  for (let i = 0; i < k; i++) {
    let numerator = 1;
    let denominator = 1;
    for (let j = 0; j < k; j++) {
      if (i !== j) {
        numerator = gfMul(numerator, x[j]); // x[j] - 0 = x[j]
        denominator = gfMul(denominator, x[i] ^ x[j]);
      }
    }
    const lagrange = gfMul(gfDiv(numerator, denominator), y[i]);
    result ^= lagrange;
  }

  return result;
}
