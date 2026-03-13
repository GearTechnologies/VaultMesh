/**
 * Storacha (w3up) storage helpers.
 */
import { create } from "@web3-storage/w3up-client";
import type { Client } from "@web3-storage/w3up-client";

const IPFS_GATEWAY = "https://w3s.link/ipfs";

export type { Client };

/**
 * Initialise a Storacha w3up client, creating a space if one doesn't exist.
 * @param email The email address used to authenticate with w3up.
 */
export async function initStoracha(email: string): Promise<Client> {
  const client = await create();

  try {
    await (client as unknown as { login: (email: string) => Promise<void> }).login(email);
  } catch {
    // If login fails (e.g., in test env), continue with anonymous client
  }

  const spaces = client.spaces();
  if (spaces.length === 0) {
    const space = await client.createSpace("vaultmesh-default");
    await client.setCurrentSpace(space.did() as `did:${string}:${string}`);
  } else {
    await client.setCurrentSpace(spaces[0].did() as `did:${string}:${string}`);
  }

  return client;
}

/**
 * Upload a raw encrypted blob to Storacha.
 * @returns The IPFS CID string.
 */
export async function uploadEncryptedBlob(
  client: Client,
  data: Uint8Array,
  filename: string
): Promise<string> {
  const blob = new Blob([data.buffer as ArrayBuffer], { type: "application/octet-stream" });
  const file = new File([blob], filename);
  const cid = await client.uploadFile(file as unknown as Parameters<typeof client.uploadFile>[0]);
  return cid.toString();
}

/**
 * Retrieve a blob from IPFS via the w3s.link gateway.
 * @param cid IPFS CID string.
 */
export async function retrieveBlob(cid: string): Promise<Uint8Array> {
  const url = `${IPFS_GATEWAY}/${cid}`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to retrieve CID ${cid}: ${response.status} ${response.statusText}`);
  }
  const buffer = await response.arrayBuffer();
  return new Uint8Array(buffer);
}

/**
 * Upload a JSON-serialisable object to Storacha.
 * @returns The IPFS CID string.
 */
export async function uploadJSON(client: Client, obj: unknown): Promise<string> {
  const json = JSON.stringify(obj);
  const data = new TextEncoder().encode(json);
  return uploadEncryptedBlob(client, data, "data.json");
}

/**
 * Retrieve and decrypt a JSON object from IPFS.
 * @param cid       IPFS CID string.
 * @param key       AES-GCM CryptoKey to decrypt the blob.
 * @returns         The parsed JSON object.
 */
export async function retrieveJSON<T>(cid: string, key: CryptoKey): Promise<T> {
  const { decrypt } = await import("../crypto/aes.js");

  const raw = await retrieveBlob(cid);

  // Format: [12-byte IV][ciphertext]
  const iv = raw.slice(0, 12);
  const ciphertext = raw.slice(12);
  const plaintext = await decrypt(ciphertext, iv, key);
  return JSON.parse(plaintext) as T;
}

/**
 * List all uploads in the current Storacha space.
 */
export async function listUploads(
  client: Client
): Promise<Array<{ cid: string; name: string; uploadedAt: Date }>> {
  const results: Array<{ cid: string; name: string; uploadedAt: Date }> = [];

  const { results: items } = await client.capability.upload.list();
  for (const item of items) {
    results.push({
      cid: item.root.toString(),
      name: item.root.toString(),
      uploadedAt: new Date(item.insertedAt),
    });
  }

  return results;
}
