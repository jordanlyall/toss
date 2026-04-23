# Toss — Claude Code Handoff

## TLDR
Finish a Next.js + Hardhat prototype that lets someone send an NFT via a link (text, iMessage, anything). Contracts + scaffolding are in this repo. Build the remaining pages, wire Privy, ship to Vercel + Base Sepolia. Target: working E2E where two browser windows simulate sender and recipient side-by-side on the landing page.

**Stack is locked. Do not substitute.** Next.js 14 App Router, TypeScript, Tailwind, wagmi v2, viem, `@privy-io/react-auth` + `@privy-io/wagmi`, Hardhat, Base Sepolia (chainId 84532).

---

## What exists

```
toss/
  contracts/
    ClaimableNFTEscrow.sol   ✅ deposit/claim/revoke with secret hash
    DemoNFT.sol              ✅ free-mint ERC-721
  scripts/
    deploy.ts                ✅ deploys both, writes lib/deployed.json
  lib/
    contracts.ts             ✅ addresses + ABIs (reads deployed.json)
    claim.ts                 ✅ secret gen, URL fragment parse, expiry helper
    wagmi.ts                 ✅ Base Sepolia config
    deployed.json            ✅ stub (gets overwritten by deploy)
  app/
    layout.tsx               ✅ root w/ Providers
    globals.css              ✅ Tailwind + imessage-bubble + phone-frame styles
  package.json               ✅ all deps
  hardhat.config.ts          ✅ Base Sepolia network
  tsconfig.json, next.config.js, tailwind.config.ts, postcss.config.js  ✅
  .env.local.example         ✅
```

## What's missing

1. `app/providers.tsx` — Privy + Wagmi provider tree
2. `app/page.tsx` — **hero: side-by-side iPhone mockup demo** (both flows in one view)
3. `app/collection/page.tsx` — mint test NFT, approve escrow, deposit, show claim URL
4. `app/claim/page.tsx` — parse fragment, Privy sign-in, preview NFT, claim
5. `scripts/mint.ts` — helper to mint demo NFTs from deployer
6. `README.md` — setup, deploy, Privy dashboard steps

---

## Architecture notes (read before coding)

### Secret lives in URL fragment, never in query string
Claim URL format: `https://toss.app/claim#id=42&s=0xabc...` (see `lib/claim.ts`). The `#` fragment is never sent to the server. Do not move it to a query param or localStorage.

### Front-running is a known limitation, not a bug
`claim(id, secret)` is front-runnable on mainnet. Noted in contract comments. For this prototype, ship as-is. Do NOT add ECDSA signing unless asked — it adds complexity the demo doesn't need.

### ERC-721 transfer dance
Sender flow must:
1. `mint()` on `DemoNFT` → get tokenId from `Transfer` event
2. `setApprovalForAll(escrow, true)` if not already approved (check `isApprovedForAll` first, skip if true)
3. `deposit(nftContract, tokenId, secretHash, expiresAt)` on escrow
4. Watch `Deposited` event for the escrow `id`

Use `useWriteContract` from wagmi + `waitForTransactionReceipt` + `decodeEventLog` from viem. Do not use ethers.

### Privy + Wagmi wiring (easy to get wrong)
Use `WagmiProvider` from `@privy-io/wagmi`, NOT from `wagmi`. Structure:

```tsx
<PrivyProvider appId={...} config={...}>
  <QueryClientProvider client={queryClient}>
    <WagmiProvider config={wagmiConfig}>  {/* from @privy-io/wagmi */}
      {children}
    </WagmiProvider>
  </QueryClientProvider>
</PrivyProvider>
```

Privy config should:
- `loginMethods: ['email', 'sms', 'wallet']` — SMS is the iMessage story
- `embeddedWallets: { createOnLogin: 'users-without-wallets' }`
- `defaultChain: baseSepolia`, `supportedChains: [baseSepolia]`

### What "both sides side-by-side" means on `/`
A single page showing TWO column panels styled like iPhones. Left column is the sender, right is the recipient. Both are fully interactive in the same page load. The fake iMessage thread in the middle animates the claim link bubble from left to right when the sender deposits.

Implementation shortcut: both panels use the same wallet (connected via Privy). The "sender" panel mints + deposits. The "recipient" panel reads the generated claim URL and lets the user claim to a different address (either the same wallet, which is fine for demo, or a freshly created embedded wallet via a second Privy `login()`). For simplicity of v1, let both sides use the same wallet — the story is the UX flow, not the address separation.

Production `/collection` and `/claim` routes are the real thing. The landing page is the cinematic demo.

### Embedded wallet as the recipient story
The recipient flow must demonstrate: tap link → sign in with email or phone → passkey/embedded wallet is auto-created → claim. User never sees "wallet" terminology. Use Privy's `login()` modal, then `useWallets()` to get the embedded wallet, then write to `claim`.

---

## Deliverables

### 1. `app/providers.tsx`
Provider tree described above. Export `Providers` as a `'use client'` component. App ID from `process.env.NEXT_PUBLIC_PRIVY_APP_ID`.

### 2. `app/page.tsx`
- Hero headline: "Text a link. Tap. Own."
- Subhead explaining the flow in one sentence
- Side-by-side phone mockups (use the `.phone-frame` and `.imessage-bubble` classes in `globals.css`)
- Left phone: mint → deposit → "Link copied" state
- Middle: iMessage-style conversation showing the link bubble
- Right phone: tap link → preview NFT → claim → "You own it" state
- Below: "Try the real thing" with links to `/collection` and `/claim`
- Link to GitHub repo + Basescan for deployed contracts

Make it look sharp. Dark mode only. Use system font stack already configured. No emoji. No gradients except the iMessage bubble.

### 3. `app/collection/page.tsx`
- If not signed in: big "Sign in to send" button → Privy modal
- Once signed in: show connected address (truncated), balance
- "Mint a demo NFT" button — calls `mint()`, waits, shows the new tokenId
- List user's owned DemoNFTs (query `balanceOf` + enumerate, or track client-side after mint)
- For each NFT: "Send" button → generates secret, hashes it, checks + sets approval, calls `deposit`, watches for `Deposited` event
- On success: show claim URL in a copy-able input + a "Share via iMessage" button (`sms:&body=...` link on iOS)
- Also show a "Revoke" button for escrows the user created (optional stretch)

### 4. `app/claim/page.tsx`
- On mount: parse `window.location.hash` via `parseClaimFragment`
- If no valid fragment: show "Invalid claim link" state
- If valid: call `getEscrow(id)` and display NFT preview (contract + tokenId, link to Basescan, check if already settled or expired)
- If not signed in: "Sign in to claim" → Privy modal
- If signed in: "Claim this NFT" button → calls `claim(id, secret)`
- On success: confetti-free celebration ("You own it"), link to view on Basescan, link back to home

### 5. `scripts/mint.ts`
Hardhat script. Mints N demo NFTs from the deployer to the deployer. Takes count from env or arg. Writes tokenIds to console.

### 6. `README.md`
Full setup:
1. Clone, `npm install`
2. Copy `.env.local.example` → `.env.local`, fill in `DEPLOYER_PRIVATE_KEY` and `NEXT_PUBLIC_PRIVY_APP_ID`
3. Get Base Sepolia ETH from https://www.alchemy.com/faucets/base-sepolia
4. `npm run compile`
5. `npm run deploy:sepolia` — writes addresses to `lib/deployed.json`
6. Privy dashboard (https://dashboard.privy.io): create app, enable Email + SMS + Wallet login, set default chain to Base Sepolia, add localhost + Vercel URL to allowed origins
7. `npm run dev`
8. Deploy: `vercel --prod`, set `NEXT_PUBLIC_PRIVY_APP_ID` in Vercel env, add the production URL to Privy allowed origins

Include a "How it works" section summarizing the escrow + secret pattern in 3 bullets.

---

## Constraints

- No em dashes in copy. Use periods or restructure.
- No "Get started" / "Unlock the future" marketing-speak. Direct, terse.
- Do not add features not in this spec (no notifications, no email confirmations, no social sharing metadata beyond OG image, no analytics).
- Do not substitute libraries. If a dep is missing, add it to package.json, don't swap the stack.
- Commit after each deliverable. Small PRs.

## Success criteria

- `npm run deploy:sepolia` completes, `lib/deployed.json` is populated
- `npm run dev` on `localhost:3000` renders the landing page with two phone mockups
- Real flow: mint a DemoNFT on `/collection`, deposit, get a URL, paste in incognito window, sign in with a different email, claim, see NFT in recipient wallet on Basescan
- Deployed to Vercel with working Privy auth on the production URL
