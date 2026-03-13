/**
 * W3C DID document builder and social graph management.
 */
import type { Client } from "@web3-storage/w3up-client";
import { uploadJSON, retrieveBlob } from "../storage/storacha.js";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface Contact {
  name: string;
  walletAddress: string;
  didUrl?: string;
  addedAt: number;
}

export interface DIDDocument {
  "@context": string[];
  id: string;
  verificationMethod: Array<{
    id: string;
    type: string;
    controller: string;
    publicKeyHex: string;
  }>;
  authentication: string[];
  service: Array<{
    id: string;
    type: string;
    serviceEndpoint: string;
  }>;
  vaultmesh?: {
    contacts: Contact[];
    createdAt: number;
    updatedAt: number;
  };
}

// ─── DID builder ─────────────────────────────────────────────────────────────

/**
 * Create a W3C-compliant DID document for the given owner.
 */
export function createDIDDocument(params: {
  ownerAddress: string;
  contacts: Contact[];
  publicKey: string;
}): DIDDocument {
  const { ownerAddress, contacts, publicKey } = params;
  const did = `did:pkh:eip155:1:${ownerAddress.toLowerCase()}`;
  const now = Date.now();

  return {
    "@context": [
      "https://www.w3.org/ns/did/v1",
      "https://w3id.org/security/suites/secp256k1-2019/v1",
    ],
    id: did,
    verificationMethod: [
      {
        id: `${did}#controller`,
        type: "EcdsaSecp256k1VerificationKey2019",
        controller: did,
        publicKeyHex: publicKey,
      },
    ],
    authentication: [`${did}#controller`],
    service: [
      {
        id: `${did}#vaultmesh`,
        type: "VaultMeshService",
        serviceEndpoint: "https://vaultmesh.io",
      },
    ],
    vaultmesh: {
      contacts,
      createdAt: now,
      updatedAt: now,
    },
  };
}

/**
 * Serialise a DID document to a JSON-LD string.
 */
export function exportDIDDocument(doc: DIDDocument): string {
  return JSON.stringify(doc, null, 2);
}

/**
 * Upload a DID document to Storacha/IPFS and return the CID.
 */
export async function uploadDIDDocument(
  doc: DIDDocument,
  storClient: Client
): Promise<string> {
  return uploadJSON(storClient, doc);
}

/**
 * Retrieve and parse contacts from a DID document stored on IPFS.
 */
export async function importContacts(didDocumentCID: string): Promise<Contact[]> {
  const raw = await retrieveBlob(didDocumentCID);
  const text = new TextDecoder().decode(raw);
  const doc = JSON.parse(text) as DIDDocument;
  return doc.vaultmesh?.contacts ?? [];
}
