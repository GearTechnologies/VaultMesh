/**
 * Dead Man's Switch — Lit Action integration.
 */
import type { AuthSig } from "./access-control.js";
import { getLit } from "./client.js";

export interface DeadManSwitchParams {
  heirs: string[];
  intervalDays: number;
  keyShare: string;
  authSig: AuthSig;
  contractAddress: string;
  rpcUrl: string;
  storClient?: unknown;
}

/**
 * Returns the Lit Action JavaScript source code.
 * The action checks if the DeadManSwitch contract is triggered and releases heir shares.
 */
export function createDeadManSwitchAction(): string {
  return `
(async () => {
  const ethers = await import("ethers");

  const CONTRACT_ABI = [
    "function isTriggered() view returns (bool)",
    "function getHeirs() view returns (address[])"
  ];

  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const contract = new ethers.Contract(contractAddress, CONTRACT_ABI, provider);

  const triggered = await contract.isTriggered();
  if (!triggered) {
    Lit.Actions.setResponse({ response: JSON.stringify({ status: "not_triggered" }) });
    return;
  }

  const heirs = await contract.getHeirs();
  const results = {};

  for (const heir of heirs) {
    const acc = [
      {
        conditionType: "evmBasic",
        contractAddress: "",
        standardContractType: "",
        chain: "ethereum",
        method: "",
        parameters: [":userAddress"],
        returnValueTest: { comparator: "=", value: heir.toLowerCase() }
      }
    ];

    try {
      const decrypted = await Lit.Actions.decryptAndCombine({
        accessControlConditions: acc,
        ciphertext: encryptedShares[heir],
        dataToEncryptHash: shareHashes[heir],
        authSig: null,
        chain: "ethereum"
      });
      results[heir] = { status: "released", share: decrypted };
    } catch (e) {
      results[heir] = { status: "error", error: e.message };
    }
  }

  Lit.Actions.setResponse({ response: JSON.stringify({ status: "triggered", results }) });
})();
  `.trim();
}

/**
 * Upload the Lit Action source to IPFS via Storacha and return the CID.
 */
export async function uploadActionToIPFS(source: string): Promise<string> {
  const { create } = await import("@web3-storage/w3up-client");
  const client = await create();
  const blob = new Blob([source], { type: "application/javascript" });
  const file = new File([blob], "dead-man-switch-action.js");
  const cid = await client.uploadFile(file as unknown as Parameters<typeof client.uploadFile>[0]);
  return cid.toString();
}

/**
 * Call the DeadManSwitch contract's checkIn() function.
 */
export async function executeHeartbeat(
  authSig: AuthSig,
  signer: {
    sendTransaction: (tx: { to: string; data: string }) => Promise<{ hash: string; wait: () => Promise<unknown> }>;
  },
  contractAddress: string
): Promise<void> {
  const { ethers } = await import("ethers");
  const iface = new ethers.Interface(["function checkIn() external"]);
  const data = iface.encodeFunctionData("checkIn");
  const tx = await signer.sendTransaction({ to: contractAddress, data });
  await tx.wait();
}

/**
 * Configure the dead man's switch: encrypt the key share for each heir,
 * store the encrypted blobs, and return the Lit Action CID.
 */
export async function configureSwitch(params: DeadManSwitchParams): Promise<string> {
  const { heirs, keyShare } = params;
  const client = await getLit();

  const encryptedShares: Record<string, string> = {};
  const shareHashes: Record<string, string> = {};

  for (const heir of heirs) {
    const acc = [
      {
        conditionType: "evmBasic",
        contractAddress: "",
        standardContractType: "",
        chain: "ethereum",
        method: "",
        parameters: [":userAddress"],
        returnValueTest: { comparator: "=", value: heir.toLowerCase() },
      },
    ];

    const result = await (client as unknown as {
      encryptString: (params: {
        dataToEncrypt: string;
        accessControlConditions: typeof acc;
      }) => Promise<{ ciphertext: string; dataToEncryptHash: string }>;
    }).encryptString({
      dataToEncrypt: keyShare,
      accessControlConditions: acc,
    });

    encryptedShares[heir] = result.ciphertext;
    shareHashes[heir] = result.dataToEncryptHash;
  }

  const actionSource = createDeadManSwitchAction();
  const cid = await uploadActionToIPFS(actionSource);
  return cid;
}
