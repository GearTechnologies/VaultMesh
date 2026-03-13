/**
 * libp2p relay node for VaultMesh VPN.
 * Uses WebRTC transport, Noise encryption, Yamux multiplexer, and Circuit Relay v2.
 */
import { createLibp2p, Libp2p } from "libp2p";
import { webRTC } from "@libp2p/webrtc";
import { noise } from "@libp2p/noise";
import { yamux } from "@libp2p/yamux";
import { circuitRelayTransport, circuitRelayServer } from "@libp2p/circuit-relay-v2";
import { bootstrap } from "@libp2p/bootstrap";
import { identify } from "@libp2p/identify";
import { ethers } from "ethers";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface BandwidthStats {
  bytesIn: number;
  bytesOut: number;
  totalGB: number;
}

// ─── Bootstrap peers ─────────────────────────────────────────────────────────

function getBootstrapPeers(): string[] {
  const peers: string[] = [];
  const env = globalThis as unknown as { __ENV__?: Record<string, string> };
  const peer1 = env.__ENV__?.VITE_BOOTSTRAP_PEER_1;
  const peer2 = env.__ENV__?.VITE_BOOTSTRAP_PEER_2;
  if (peer1) peers.push(peer1);
  if (peer2) peers.push(peer2);

  // Fallback hardcoded bootstrap peers
  if (peers.length === 0) {
    peers.push(
      "/dns4/bootstrap.vaultmesh.io/tcp/443/wss/p2p/QmBootstrap1VaultMeshNode",
      "/dns4/bootstrap2.vaultmesh.io/tcp/443/wss/p2p/QmBootstrap2VaultMeshNode",
      "/dns4/bootstrap3.vaultmesh.io/tcp/443/wss/p2p/QmBootstrap3VaultMeshNode"
    );
  }
  return peers;
}

// ─── Bandwidth tracking ───────────────────────────────────────────────────────

const _bandwidthStats: BandwidthStats = { bytesIn: 0, bytesOut: 0, totalGB: 0 };

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Create a libp2p relay node with WebRTC, Noise, Yamux, and Circuit Relay v2.
 */
export async function createRelayNode(): Promise<Libp2p> {
  const node = await createLibp2p({
    transports: [
      webRTC(),
      circuitRelayTransport(),
    ],
    connectionEncrypters: [noise()],
    streamMuxers: [yamux()],
    peerDiscovery: [
      bootstrap({
        list: getBootstrapPeers(),
      }),
    ],
    services: {
      identify: identify(),
      relay: circuitRelayServer(),
    },
  });

  return node;
}

/**
 * Start the relay node and begin advertising.
 */
export async function startRelay(node: Libp2p): Promise<void> {
  await node.start();
}

/**
 * Stop the relay node gracefully.
 */
export async function stopRelay(node: Libp2p): Promise<void> {
  await node.stop();
}

/**
 * Get current bandwidth statistics for the relay node.
 * TODO: Read from @libp2p/bandwidth-stats service once node exposes it.
 */
export function getBandwidthStats(_node: Libp2p): BandwidthStats {
  return { ..._bandwidthStats };
}

/**
 * Update bandwidth counters (called by internal event listeners).
 */
export function recordBandwidth(direction: "in" | "out", bytes: number): void {
  if (direction === "in") {
    _bandwidthStats.bytesIn += bytes;
  } else {
    _bandwidthStats.bytesOut += bytes;
  }
  const totalBytes = _bandwidthStats.bytesIn + _bandwidthStats.bytesOut;
  _bandwidthStats.totalGB = totalBytes / 1_000_000_000;
}

/**
 * Sign bandwidth session data and report it to the RelayRewards contract.
 * @returns Transaction hash.
 */
export async function reportBandwidthToOracle(
  stats: BandwidthStats,
  signer: ethers.Signer
): Promise<string> {
  const relayRewardsAddress = (globalThis as unknown as { __ENV__?: Record<string, string> })
    .__ENV__?.VITE_RELAY_REWARDS_ADDRESS;

  if (!relayRewardsAddress) {
    throw new Error("VITE_RELAY_REWARDS_ADDRESS not configured");
  }

  const abi = [
    "function reportBandwidth(bytes32 sessionId, uint256 bytesRouted, bytes calldata signature) external",
  ];
  const contract = new ethers.Contract(relayRewardsAddress, abi, signer);

  const totalBytes = BigInt(Math.floor((stats.bytesIn + stats.bytesOut)));
  const sessionId = ethers.keccak256(
    ethers.toUtf8Bytes(`${Date.now()}-${await signer.getAddress()}`)
  );

  // In production, the oracle signs off-chain and provides the signature.
  // For demo purposes, we use a placeholder signature.
  const placeholder = "0x" + "00".repeat(65);
  const tx = await contract.reportBandwidth(sessionId, totalBytes, placeholder);
  await tx.wait();
  return tx.hash;
}
