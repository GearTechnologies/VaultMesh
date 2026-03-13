/**
 * Lit Protocol social recovery: distribute and collect vault key shares.
 */
import { getLit } from "./client.js";
import { buildVaultEntryACC, type AuthSig } from "./access-control.js";
import { splitSecret, reconstructSecret } from "../crypto/social-recovery.js";
import type { Client } from "@web3-storage/w3up-client";
import { uploadEncryptedBlob, retrieveBlob } from "../storage/storacha.js";

export interface GuardianShare {
  guardianAddress: string;
  shareCID: string;
  shareIndex: number;
}

/**
 * Split the vault key and distribute encrypted shares to guardian addresses.
 * Each share is encrypted to its guardian's Lit ACC and stored on Storacha.
 *
 * @returns Array of GuardianShare records (store these in identity state).
 */
export async function distributeKeyShares(params: {
  vaultKeyBytes: Uint8Array;
  guardianAddresses: string[];
  threshold: number;
  storClient: Client;
}): Promise<GuardianShare[]> {
  const { vaultKeyBytes, guardianAddresses, threshold, storClient } = params;

  const shares = await splitSecret(vaultKeyBytes, threshold, guardianAddresses.length);
  const client = await getLit();

  const guardianShares: GuardianShare[] = [];

  for (let i = 0; i < guardianAddresses.length; i++) {
    const guardian = guardianAddresses[i];
    const share = shares[i];
    const acc = buildVaultEntryACC(guardian);

    // Encrypt the share bytes using Lit
    const { ciphertext, dataToEncryptHash } = await (client as unknown as {
      encryptString: (params: {
        dataToEncrypt: string;
        accessControlConditions: typeof acc;
      }) => Promise<{ ciphertext: string; dataToEncryptHash: string }>;
    }).encryptString({
      dataToEncrypt: JSON.stringify({ shareData: Array.from(share) }),
      accessControlConditions: acc,
    });

    // Store the encrypted share on Storacha
    const payload = new TextEncoder().encode(JSON.stringify({ ciphertext, dataToEncryptHash, acc }));
    const cid = await uploadEncryptedBlob(storClient, payload, `share-${guardian}.json`);

    guardianShares.push({ guardianAddress: guardian, shareCID: cid, shareIndex: i + 1 });
  }

  return guardianShares;
}

/**
 * Collect and reconstruct the vault key from guardian shares.
 * Each guardian must provide their AuthSig to decrypt their share.
 */
export async function collectAndReconstruct(params: {
  guardianShares: GuardianShare[];
  authSigs: Record<string, AuthSig>; // guardianAddress → authSig
  threshold: number;
}): Promise<Uint8Array> {
  const { guardianShares, authSigs, threshold } = params;
  const client = await getLit();

  const decryptedShares: Uint8Array[] = [];

  for (const gs of guardianShares) {
    const authSig = authSigs[gs.guardianAddress];
    if (!authSig) continue;

    const payload = await retrieveBlob(gs.shareCID);
    const { ciphertext, dataToEncryptHash, acc } = JSON.parse(new TextDecoder().decode(payload));

    const { decryptedString } = await (client as unknown as {
      decryptString: (params: {
        ciphertext: string;
        dataToEncryptHash: string;
        accessControlConditions: unknown;
        authSig: AuthSig;
        chain: string;
      }) => Promise<{ decryptedString: string }>;
    }).decryptString({
      ciphertext,
      dataToEncryptHash,
      accessControlConditions: acc,
      authSig,
      chain: "ethereum",
    });

    const parsed = JSON.parse(decryptedString);
    decryptedShares.push(new Uint8Array(parsed.shareData));

    if (decryptedShares.length >= threshold) break;
  }

  if (decryptedShares.length < threshold) {
    throw new Error(`Need at least ${threshold} shares, got ${decryptedShares.length}`);
  }

  return reconstructSecret(decryptedShares);
}
