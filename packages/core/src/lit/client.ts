/**
 * Singleton LitNodeClient with exponential-backoff reconnect.
 */
import { LitNodeClient } from "@lit-protocol/lit-node-client";
import { LitNetwork } from "@lit-protocol/constants";

const LIT_NETWORK = (globalThis as unknown as { process?: { env?: { VITE_LIT_NETWORK?: string } } })
  ?.process?.env?.VITE_LIT_NETWORK ?? LitNetwork.DatilTest;

let _client: LitNodeClient | null = null;
let _connectPromise: Promise<LitNodeClient> | null = null;

const MAX_RETRIES = 5;
const BASE_DELAY_MS = 1000;

async function connectWithRetry(retries = 0): Promise<LitNodeClient> {
  const client = new LitNodeClient({
    litNetwork: LIT_NETWORK as LitNetwork,
    debug: false,
  });

  try {
    await client.connect();
    return client;
  } catch (err) {
    if (retries >= MAX_RETRIES) {
      throw new Error(`Failed to connect to Lit Network after ${MAX_RETRIES} retries: ${err}`);
    }
    const delay = BASE_DELAY_MS * Math.pow(2, retries);
    await new Promise((r) => setTimeout(r, delay));
    return connectWithRetry(retries + 1);
  }
}

/**
 * Get (or lazily create) the singleton LitNodeClient.
 * Handles reconnection with exponential backoff.
 */
export async function getLit(): Promise<LitNodeClient> {
  if (_client?.ready) return _client;

  if (_connectPromise) return _connectPromise;

  _connectPromise = connectWithRetry().then((c) => {
    _client = c;
    _connectPromise = null;
    return c;
  });

  return _connectPromise;
}

/** The lazily-initialised Lit client singleton (may be null until first call to getLit()). */
export let litClient: LitNodeClient | null = null;
getLit()
  .then((c) => {
    litClient = c;
  })
  .catch(() => {
    // Will be retried on next getLit() call
  });
