/**
 * Zama FHE consent query engine.
 * Uses mock mode for hackathon demo — same API surface as real FHE.
 */
import { ethers } from "ethers";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface UserProfile {
  age: number;
  country: string;
  interests: string[];
}

export interface CohortQuery {
  minAge: number;
  maxAge: number;
  country: string;
  interest: string;
}

export interface CohortResult {
  matchCount: number;
  queryHash: string;
  timestamp: number;
}

export interface EncryptedProfile {
  encryptedAge: Uint8Array;
  encryptedCountry: Uint8Array;
  encryptedInterests: Uint8Array[];
  // Plaintext copy preserved in mock mode (never sent to advertisers)
  _mockPlaintext: UserProfile;
}

// ─── Mock FHE helpers ────────────────────────────────────────────────────────

function mockEncryptNumber(n: number): Uint8Array {
  // In real mode, this would call fhevm.encrypt32(n)
  const buf = new Uint8Array(4);
  new DataView(buf.buffer).setUint32(0, n, false);
  return buf;
}

function mockEncryptString(s: string): Uint8Array {
  return new TextEncoder().encode(s);
}

function mockDecryptNumber(enc: Uint8Array): number {
  return new DataView(enc.buffer, enc.byteOffset, enc.byteLength).getUint32(0, false);
}

function mockDecryptString(enc: Uint8Array): string {
  return new TextDecoder().decode(enc);
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * FHE-encrypt a user profile.
 * MOCK MODE: wraps plaintext in typed arrays — real FHE requires a gateway.
 */
export async function encryptProfile(profile: UserProfile): Promise<EncryptedProfile> {
  return {
    encryptedAge: mockEncryptNumber(profile.age),
    encryptedCountry: mockEncryptString(profile.country),
    encryptedInterests: profile.interests.map(mockEncryptString),
    _mockPlaintext: profile,
  };
}

/**
 * Run a cohort query over FHE-encrypted profiles.
 * Only returns an aggregate count — individual profiles are never revealed.
 */
export async function runCohortQuery(
  encryptedProfiles: EncryptedProfile[],
  query: CohortQuery
): Promise<CohortResult> {
  // In mock mode we operate on plaintexts, but the API mirrors real FHE usage.
  let matchCount = 0;

  for (const ep of encryptedProfiles) {
    const age = mockDecryptNumber(ep.encryptedAge);
    const country = mockDecryptString(ep.encryptedCountry);
    const interests = ep.encryptedInterests.map(mockDecryptString);

    const ageMatch = age >= query.minAge && age <= query.maxAge;
    const countryMatch = country.toLowerCase() === query.country.toLowerCase();
    const interestMatch = interests.some(
      (i) => i.toLowerCase() === query.interest.toLowerCase()
    );

    if (ageMatch && countryMatch && interestMatch) {
      matchCount++;
    }
  }

  const queryHash = ethers.keccak256(
    ethers.toUtf8Bytes(JSON.stringify({ query, timestamp: Date.now() }))
  );

  return {
    matchCount,
    queryHash,
    timestamp: Date.now(),
  };
}

/**
 * Record user consent on-chain via the ConsentRegistry contract.
 * @returns Transaction hash.
 */
export async function logConsentOnChain(
  dataType: string,
  requester: string,
  allowed: boolean,
  signer: ethers.Signer
): Promise<string> {
  const consentRegistryAddress = (globalThis as unknown as { __ENV__?: { VITE_CONSENT_REGISTRY_ADDRESS?: string } })
    ?.__ENV__?.VITE_CONSENT_REGISTRY_ADDRESS;

  if (!consentRegistryAddress) {
    throw new Error("VITE_CONSENT_REGISTRY_ADDRESS not configured");
  }

  const abi = [
    "function setConsent(bytes32 dataType, address requester, bool allowed) external",
  ];
  const contract = new ethers.Contract(consentRegistryAddress, abi, signer);
  const dataTypeHash = ethers.keccak256(ethers.toUtf8Bytes(dataType));
  const tx = await contract.setConsent(dataTypeHash, requester, allowed);
  await tx.wait();
  return tx.hash;
}
