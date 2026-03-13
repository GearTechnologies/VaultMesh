/**
 * Lit Protocol Access Control Conditions builder and encrypt/decrypt helpers.
 */
import { getLit } from "./client.js";

// Minimal type re-exports to avoid deep Lit SDK imports in callers
export type AccessControlConditions = Array<Record<string, unknown>>;
export interface AuthSig {
  sig: string;
  derivedVia: string;
  signedMessage: string;
  address: string;
}

const LIT_CHAIN = "ethereum";

/**
 * Build an ACC that only allows the owner address to decrypt.
 */
export function buildVaultEntryACC(ownerAddress: string): AccessControlConditions {
  return [
    {
      conditionType: "evmBasic",
      contractAddress: "",
      standardContractType: "",
      chain: LIT_CHAIN,
      method: "",
      parameters: [":userAddress"],
      returnValueTest: {
        comparator: "=",
        value: ownerAddress.toLowerCase(),
      },
    },
  ];
}

/**
 * Build an ACC that allows either the owner OR a specific grantee to decrypt.
 */
export function buildSharedACC(
  ownerAddress: string,
  granteeAddress: string
): AccessControlConditions {
  return [
    {
      conditionType: "evmBasic",
      contractAddress: "",
      standardContractType: "",
      chain: LIT_CHAIN,
      method: "",
      parameters: [":userAddress"],
      returnValueTest: {
        comparator: "=",
        value: ownerAddress.toLowerCase(),
      },
    },
    { operator: "or" },
    {
      conditionType: "evmBasic",
      contractAddress: "",
      standardContractType: "",
      chain: LIT_CHAIN,
      method: "",
      parameters: [":userAddress"],
      returnValueTest: {
        comparator: "=",
        value: granteeAddress.toLowerCase(),
      },
    },
  ];
}

/**
 * Encrypt a plaintext string using Lit Protocol with the given ACC.
 */
export async function encryptToLit(
  plaintext: string,
  acc: AccessControlConditions
): Promise<{ ciphertext: string; dataToEncryptHash: string }> {
  const { LitNodeClient } = await import("@lit-protocol/lit-node-client");
  const { encryptString } = await import("@lit-protocol/lit-node-client");

  const client = await getLit();
  const result = await (client as unknown as {
    encryptString: (params: {
      dataToEncrypt: string;
      accessControlConditions: AccessControlConditions;
    }) => Promise<{ ciphertext: string; dataToEncryptHash: string }>;
  }).encryptString({
    dataToEncrypt: plaintext,
    accessControlConditions: acc,
  });

  return result;
}

/**
 * Decrypt ciphertext using Lit Protocol, validating the ACC.
 */
export async function decryptFromLit(
  ciphertext: string,
  dataToEncryptHash: string,
  acc: AccessControlConditions,
  authSig: AuthSig
): Promise<string> {
  const client = await getLit();

  const result = await (client as unknown as {
    decryptString: (params: {
      ciphertext: string;
      dataToEncryptHash: string;
      accessControlConditions: AccessControlConditions;
      authSig: AuthSig;
      chain: string;
    }) => Promise<{ decryptedString: string }>;
  }).decryptString({
    ciphertext,
    dataToEncryptHash,
    accessControlConditions: acc,
    authSig,
    chain: LIT_CHAIN,
  });

  return result.decryptedString;
}
