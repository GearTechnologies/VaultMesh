# VaultMesh

> A unified personal sovereignty suite — your passwords, files, identity, and digital inheritance, all encrypted client-side and owned exclusively by you.

## Features

1. **Password Vault** — AES-256-GCM encrypted credentials, no central server, autofill via browser extension
2. **Encrypted File Vault** — client-side encrypted files stored on Storacha/IPFS, accessible anywhere
3. **Social Recovery** — Lit Protocol threshold key shares across guardian wallets (2-of-3 default)
4. **P2P VPN + Relay Rewards** — libp2p relay node; earn $VMESH tokens per GB routed
5. **Portable Social Graph** — W3C DID document exportable across decentralised apps
6. **Dead Man's Switch** — Lit Action releases heir key shares if heartbeat lapses
7. **Data Consent Engine** — Zama FHE: advertisers query encrypted cohort data, never see plaintext

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      VaultMesh Browser Extension            │
│  ┌─────────────┐  ┌──────────────┐  ┌────────────────────┐  │
│  │  Popup UI   │  │  Background  │  │  Content Script    │  │
│  │  (React 18) │  │  Service     │  │  (autofill)        │  │
│  └──────┬──────┘  └──────┬───────┘  └────────────────────┘  │
└─────────┼───────────────┼─────────────────────────────────┘
          │               │
          ▼               ▼
┌─────────────────────────────────────────────────────────────┐
│                    @vaultmesh/core                          │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌───────────────┐  │
│  │  crypto/ │ │   lit/   │ │ storage/ │ │  p2p/ fhe/    │  │
│  │ AES-GCM  │ │ Lit Node │ │Storacha  │ │ libp2p  FHE   │  │
│  └──────────┘ └──────────┘ └──────────┘ └───────────────┘  │
└────────┬──────────────┬──────────────────────────┬──────────┘
         │              │                           │
         ▼              ▼                           ▼
  ┌────────────┐  ┌───────────┐            ┌───────────────┐
  │  Storacha  │  │   Lit     │            │  Base Sepolia │
  │  (IPFS)   │  │ Protocol  │            │  Smart        │
  └────────────┘  └───────────┘            │  Contracts    │
                                           └───────────────┘
```

## Prerequisites

- Node.js 20+
- pnpm 9+
- A wallet (MetaMask, WalletConnect, or Phantom)

## Setup

```bash
# Install dependencies
pnpm install

# Copy environment variables
cp .env.example .env

# Fill in the required environment variables in .env
```

## Deploy Contracts (Base Sepolia)

```bash
pnpm --filter contracts deploy:base-sepolia
```

## Run Web App

```bash
pnpm --filter app dev
```

## Build Browser Extension

```bash
pnpm --filter app build:ext
```

Then load the `dist-ext/` folder in `chrome://extensions` with Developer Mode enabled.

## Run Tests

```bash
pnpm --filter contracts test
```

## Sponsor Integration

| Sponsor | Integration |
|---------|-------------|
| **Lit Protocol** | Threshold encryption for vault key shares, Dead Man's Switch Lit Action, access control for shared files |
| **Storacha / IPFS** | Encrypted file vault storage, DID document hosting, Lit Action IPFS pinning |
| **Zama FHE** | Consent engine: advertisers query encrypted cohort data without seeing plaintext profiles |
| **Filecoin** | Underlying storage layer via Storacha/w3up UCAN protocol |

## Hackathon Demo Script

1. **Connect wallet** → Open the extension popup → Click "Connect Wallet" → Select MetaMask
2. **Add a password** → Navigate to Vault tab → Click "Add Credential" → Fill in GitHub credentials → Save (watch it encrypt + upload to IPFS)
3. **Setup guardians** → Navigate to Onboarding → Add 3 guardian ETH addresses → Click "Finish Setup" (Shamir shares distributed via Lit)
4. **Start relay node** → Navigate to VPN tab → Click "Start Relaying" → Watch bytes routed counter increment
5. **Configure dead man's switch** → Navigate to Dead Man's Switch tab → Set 30-day interval → Add heir → Click "Configure Switch" → See Lit Action CID

## License

MIT
