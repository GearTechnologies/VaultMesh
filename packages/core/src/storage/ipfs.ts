/**
 * IPFS gateway URL helpers.
 */

const DEFAULT_GATEWAY = "https://w3s.link/ipfs";
const FALLBACK_GATEWAY = "https://ipfs.io/ipfs";

/**
 * Convert a CID to a gateway URL.
 */
export function cidToUrl(cid: string, gateway = DEFAULT_GATEWAY): string {
  return `${gateway}/${cid}`;
}

/**
 * Convert a CID to a fallback IPFS.io gateway URL.
 */
export function cidToFallbackUrl(cid: string): string {
  return cidToUrl(cid, FALLBACK_GATEWAY);
}

/**
 * Extract the CID from a gateway URL.
 */
export function urlToCid(url: string): string {
  const match = url.match(/\/ipfs\/([a-zA-Z0-9]+)/);
  if (!match) throw new Error(`Cannot extract CID from URL: ${url}`);
  return match[1];
}

/**
 * Return multiple gateway URLs for the same CID (for redundancy).
 */
export function getCidGateways(cid: string): string[] {
  return [
    `${DEFAULT_GATEWAY}/${cid}`,
    `${FALLBACK_GATEWAY}/${cid}`,
    `https://cloudflare-ipfs.com/ipfs/${cid}`,
  ];
}

/**
 * Fetch a CID, trying multiple gateways in order.
 */
export async function fetchFromIPFS(cid: string): Promise<Uint8Array> {
  const gateways = getCidGateways(cid);
  let lastError: Error | null = null;

  for (const url of gateways) {
    try {
      const response = await fetch(url);
      if (response.ok) {
        const buffer = await response.arrayBuffer();
        return new Uint8Array(buffer);
      }
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
    }
  }

  throw lastError ?? new Error(`Failed to fetch CID ${cid} from all gateways`);
}
