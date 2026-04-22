# Toss

Send an NFT by link. Any phone number, any email, no wallet required on the receiving side.

Live on Base Sepolia. Next.js 14 + wagmi + viem + Privy.

## How it works

- **Escrow by secret hash.** Sender deposits the NFT into `ClaimableNFTEscrow` along with the keccak256 of a random 32-byte secret. The NFT is held by the contract.
- **Link carries the secret.** The secret is placed in the URL fragment (`#s=0x...`), which never leaves the browser. Share it over iMessage, email, anything.
- **Recipient claims.** Anyone holding the secret can call `claim(id, secret)` to transfer the NFT to themselves. The recipient signs in with Privy (email or SMS), which auto-creates an embedded wallet.

Front-running the claim transaction is a known limitation for mainnet use. See the contract comments for the production mitigation (bind the recipient into a signature).

## Setup

### 1. Install

```bash
git clone <repo>
cd toss
npm install
```

### 2. Configure env

```bash
cp .env.local.example .env.local
```

Fill in:

- `DEPLOYER_PRIVATE_KEY` — a funded Base Sepolia key for deploys and the mint script.
- `NEXT_PUBLIC_PRIVY_APP_ID` — from the Privy dashboard, see step 5.

Fund the deployer at https://www.alchemy.com/faucets/base-sepolia.

### 3. Compile

```bash
npm run compile
```

### 4. Deploy to Base Sepolia

```bash
npm run deploy:sepolia
```

This deploys `ClaimableNFTEscrow` and `DemoNFT`, then writes both addresses to `lib/deployed.json`. The frontend reads from that file.

### 5. Privy

At https://dashboard.privy.io:

1. Create a new app.
2. Login methods: enable **Email**, **SMS**, and **Wallet**.
3. Default chain: **Base Sepolia**.
4. Embedded wallets: **Create on login for users without wallets**.
5. Allowed origins: add `http://localhost:3000` and your Vercel production URL.
6. Copy the App ID into `NEXT_PUBLIC_PRIVY_APP_ID` in `.env.local`.

### 6. Run locally

```bash
npm run dev
```

Open http://localhost:3000. The landing page should render the side-by-side phone demo.

### 7. Mint demo NFTs (optional)

```bash
MINT_COUNT=5 npm run mint:sepolia
```

### 8. Deploy to Vercel

```bash
vercel --prod
```

Then in the Vercel project settings:

- Set `NEXT_PUBLIC_PRIVY_APP_ID`.
- Optionally set `NEXT_PUBLIC_BASE_SEPOLIA_RPC` to a dedicated RPC.

Add the production URL to your Privy app's allowed origins.

## Routes

- `/` — marketing landing page with a live side-by-side demo (sender phone + iMessage thread + recipient phone).
- `/send` — real sender flow. Mint, approve escrow, deposit, copy the claim link.
- `/claim` — real recipient flow. Open the link, sign in, claim.

## Stack

Do not substitute.

- Next.js 14 (App Router)
- TypeScript
- Tailwind
- wagmi v2 + viem (no ethers in the frontend)
- `@privy-io/react-auth` + `@privy-io/wagmi`
- Hardhat for contracts
- Base Sepolia (chainId 84532)
