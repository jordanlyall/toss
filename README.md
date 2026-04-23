# Toss

An open-source pattern for sending free-mint, on-chain art by link.

Live demo: **[toss.lol](https://toss.lol)** — the first release on Toss is **Field Notes**, an open-ended series of on-chain glyph grids by [Jordan Lyall](https://x.com/jordanlyall).

## What Toss is

- **Escrow by secret hash.** Sender deposits the NFT into `ClaimableNFTEscrow` along with the keccak256 of a random 32-byte secret. The NFT is held by the contract.
- **Link carries the secret.** The secret lives in the URL fragment (`#s=0x...`), which never reaches any server. Share the link over iMessage, email, anything.
- **Recipient claims.** Anyone holding the secret can call `claim(id, secret)` to transfer the NFT to themselves. The recipient signs in with Privy (email, phone, or passkey); Privy auto-creates an embedded smart wallet.

Front-running the claim transaction is a known limitation for mainnet use. See the contract comments for the production mitigation (bind the recipient into a signature).

## What Field Notes is

A growing series of small on-chain compositions, drawn from a vocabulary of eight marks and six palettes. Fully on-chain SVG, deterministic from tokenId. Free to make. Made to be shared.

The art and the infra are one repo right now because Field Notes is the first thing shipped on top of Toss. Either could be forked independently.

## Stack

- Next.js 14 (App Router)
- TypeScript + Tailwind
- wagmi v2 + viem
- `@privy-io/react-auth` + `@privy-io/wagmi` + `@privy-io/server-auth`
- Hardhat for contracts
- Base Sepolia (chainId 84532)

## Run locally

### 1. Install

```bash
git clone https://github.com/jordanlyall/toss.git
cd toss
npm install
```

### 2. Configure env

```bash
cp .env.local.example .env.local
```

Fill in:

- `DEPLOYER_PRIVATE_KEY` — a funded Base Sepolia key for deploys and the mint script.
- `NEXT_PUBLIC_PRIVY_APP_ID` — from the Privy dashboard (see step 5).
- `PRIVY_APP_SECRET` — Privy app secret (server-side only, for custom metadata + OG resolver). Optional for local dev; features that use it degrade gracefully when absent.

Fund the deployer at https://www.alchemy.com/faucets/base-sepolia.

### 3. Compile and deploy

```bash
npm run compile
npm run deploy:sepolia
```

Writes the escrow + NFT addresses to `lib/deployed.json`.

### 4. Privy

At https://dashboard.privy.io:

1. Create an app.
2. Login methods: enable **Email**, **SMS**, **Passkey**.
3. Default chain: **Base Sepolia**. Enable **Smart Wallets** (Kernel).
4. Embedded wallets: **Create on login for users without wallets**.
5. Allowed origins: add `http://localhost:3000` and your production URL.
6. Copy the App ID into `NEXT_PUBLIC_PRIVY_APP_ID`.

### 5. Run

```bash
npm run dev
```

### 6. Mint demo NFTs (optional)

```bash
MINT_COUNT=5 npm run mint:sepolia
```

## Routes

- `/` — Field Notes homepage (art statement + CTA; Toss credit band)
- `/collection` — Your Field Notes. Tap one to send. (Old `/send` 308-redirects here.)
- `/sent` — Field Notes you've sent, with live status (Sent / Opened / Expired / Returned).
- `/settings` — set a display name that appears on link previews.
- `/t/[id]` — claim page. `/claim?id=N` legacy form still resolves.

## Contracts (Base Sepolia)

Addresses in `lib/deployed.json`. ERC-721 is named `"Toss Glyph Grid"` on-chain — this is pre-reposition and will be updated on a future redeploy.

## License

MIT. See [LICENSE](LICENSE).
