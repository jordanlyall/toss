# Field Notes Repositioning — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reposition `toss.lol` around the **Field Notes** art project by Jordan Lyall while keeping **Toss** as an honest infra credit; rewrite the homepage; rename user-visible copy; flip the GitHub repo to public.

**Architecture:** Next.js 14 App Router. All visible changes live in `app/`, `lib/ogMeta.ts`, and a rewrite of `app/page.tsx`. On-chain contracts do not change. No new routes. CTA continues to funnel to `/collection`, which already handles all auth states correctly.

**Tech Stack:** Next.js 14, Tailwind, Privy, existing `NFTPreview` component, viem/wagmi.

**Spec:** `docs/superpowers/specs/2026-04-23-field-notes-repositioning-design.md`

**Timeline:** Target completion before hackathon demo on 2026-04-24.

---

## File Structure

**Modified:**
- `app/page.tsx` — complete rewrite (delete cinematic demo, build Field Notes homepage)
- `app/layout.tsx` — site title/description metadata
- `app/collection/page.tsx` — wordmark + empty state + tile labels + aria-labels
- `app/collection/SendSheet.tsx` — sheet title + button copy
- `app/sent/page.tsx` — wordmark + headings + tile labels
- `app/claim/ClaimClient.tsx` — wordmark + headlines + post-claim CTA label
- `app/settings/page.tsx` — wordmark
- `lib/ogMeta.ts` — DEFAULT_TITLE + ENS-template string
- `README.md` — rewrite for the Field Notes + Toss framing

**Created:**
- `LICENSE` — MIT

**Untouched (important):**
- `contracts/DemoNFT.sol` — on-chain name stays "Toss Glyph Grid" (out of scope; requires redeploy)
- Domain, GitHub repo name, Vercel project name — all stay as `toss`
- `app/t/[id]/page.tsx` — no inline copy; metadata flows through `lib/ogMeta.ts`

---

## Task 1: Secrets audit

**Why:** Repo is about to go public. Any secret committed in history (even if deleted in a later commit) stays recoverable. Must confirm nothing leaked before flipping visibility.

**Files:** None modified in this task — inspection only.

- [ ] **Step 1: Verify `.env.local` is gitignored and not tracked**

```bash
cd ~/Projects/toss
grep -E "\.env" .gitignore
git ls-files | grep -E "\.env\.local$"
```

Expected:
- `.gitignore` output contains `.env.local` (or `.env*.local` or equivalent)
- `git ls-files` returns **nothing** for `.env.local`

- [ ] **Step 2: Scan full git history for any committed `.env` file**

```bash
git log --all --diff-filter=A --name-only --format=format: -- '*.env*' | sort -u | grep -v '^$'
```

Expected: only `.env.local.example` appears. If anything else does, stop and rotate those secrets before proceeding.

- [ ] **Step 3: Scan git history for common secret patterns**

```bash
git log --all -p | grep -E "privy_app_secret_|PRIVATE_KEY=|DEPLOYER_PRIVATE_KEY=0x[a-fA-F0-9]{40,}|api[-_]?key[\"'= ]+[a-zA-Z0-9]{20,}" | head -20
```

Expected: no matches. Any secret-looking hit must be investigated. The Hardhat `DEPLOYER_PRIVATE_KEY` is a known sensitive value that must never have been committed.

- [ ] **Step 4: Verify `lib/deployed.json` is safe to publish**

```bash
cat lib/deployed.json
```

Expected: only contains `chainId`, `escrow` address, `demoNFT` address. Public data. OK to ship.

- [ ] **Step 5: Commit audit outcome (no changes yet)**

Nothing to commit in this task. Proceed only if all steps pass. If any step failed, halt and remediate before continuing.

---

## Task 2: Add LICENSE and rewrite README

**Why:** Public repo needs a license file and a README that matches the new framing. Current README still talks about "Toss / send an NFT by link" and references the deleted cinematic demo and `/send` route.

**Files:**
- Create: `LICENSE`
- Modify: `README.md`

- [ ] **Step 1: Create `LICENSE` (MIT)**

Write to `LICENSE`:

```
MIT License

Copyright (c) 2026 Jordan Lyall

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

- [ ] **Step 2: Rewrite `README.md`**

Replace the entire contents with:

```markdown
# Toss

An open-source pattern for sending free-mint, on-chain art by link.

Live demo: **[toss.lol](https://toss.lol)** — the first release on Toss is **Field Notes**, an open-ended series of on-chain glyph grids by [Jordan Lyall](https://x.com/jordanlyall).

## What Toss is

- **Escrow by secret hash.** Sender deposits the NFT into `ClaimableNFTEscrow` along with the keccak256 of a random 32-byte secret. The NFT is held by the contract.
- **Link carries the secret.** The secret lives in the URL fragment (`#s=0x...`), which never reaches any server. Share the link over iMessage, email, anything.
- **Recipient claims.** Anyone holding the secret can call `claim(id, secret)` to transfer the NFT to themselves. The recipient signs in with Privy (email, phone, or passkey); Privy auto-creates an embedded smart wallet.

Front-running the claim transaction is a known limitation for mainnet use. See the contract comments for the production mitigation (bind the recipient into a signature).

## What Field Notes is

A growing series of small on-chain compositions, drawn from a vocabulary of eight marks and six palettes. Fully on-chain SVG, deterministic from tokenId. Free to make. Made to be given.

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
```

- [ ] **Step 3: Verify locally**

```bash
cd ~/Projects/toss
head -30 README.md
cat LICENSE | head -3
```

Expected: README starts with `# Toss` (unchanged repo name) and mentions Field Notes in the first paragraph. LICENSE starts with `MIT License`.

- [ ] **Step 4: Commit**

```bash
git add README.md LICENSE
git commit -m "$(cat <<'EOF'
docs: rewrite README for Field Notes + Toss framing, add LICENSE

README now leads with Toss as open-source infra with Field Notes
as the first release on it. Drops the pre-reposition "send an NFT
by link" framing and the obsolete /send route.

Adds MIT LICENSE ahead of flipping the repo public.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Rename wordmarks + site-level metadata

**Why:** The top-left wordmark on every authenticated page says "Toss." It needs to say "Field Notes" per the spec. Site-level `<title>` and `<meta name="description">` need to match too.

**Files:**
- Modify: `app/layout.tsx`
- Modify: `app/collection/page.tsx`
- Modify: `app/sent/page.tsx`
- Modify: `app/claim/ClaimClient.tsx`
- Modify: `app/settings/page.tsx`

- [ ] **Step 1: Update site-level metadata in `app/layout.tsx`**

Find:

```ts
export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: "Toss — send a Toss by link.",
  description: "Text a link. Tap. Keep it. Free.",
};
```

Replace with:

```ts
export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: "Field Notes — small compositions, made to be given.",
  description: "On-chain glyph grids by Jordan Lyall. Free to make. Sent by link.",
};
```

- [ ] **Step 2: Update wordmark in `app/collection/page.tsx`**

Find:

```tsx
<Link
  href="/"
  className="text-base font-semibold tracking-tight text-white"
>
  Toss
</Link>
```

Replace with:

```tsx
<Link
  href="/"
  className="text-base font-semibold tracking-tight text-white"
>
  Field Notes
</Link>
```

- [ ] **Step 3: Same edit in `app/sent/page.tsx`**

Same find/replace as Step 2 (same JSX pattern).

- [ ] **Step 4: Same edit in `app/claim/ClaimClient.tsx`**

Same find/replace as Step 2.

- [ ] **Step 5: Same edit in `app/settings/page.tsx`**

Same find/replace as Step 2, **except** that file links the wordmark to `/collection`, not `/`. The link target stays — only the label `Toss` → `Field Notes` changes.

- [ ] **Step 6: Typecheck**

```bash
cd ~/Projects/toss && rm -rf .next && npx tsc --noEmit
```

Expected: no output (success).

- [ ] **Step 7: Commit**

```bash
git add app/layout.tsx app/collection/page.tsx app/sent/page.tsx app/claim/ClaimClient.tsx app/settings/page.tsx
git commit -m "$(cat <<'EOF'
refactor(copy): rename app wordmark to Field Notes

Top-left wordmark across /collection, /sent, /settings, /claim,
/t/[id] switches from 'Toss' to 'Field Notes' to match the
repositioning. Site-level <title> and <meta description> updated
too.

'Toss' stays as the internal name of the repo, the domain, and the
infra credit on the homepage band.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: Rename user-visible copy inside the collection + send flows

**Why:** Grid header, empty state, tile labels, aria-labels, send sheet title, and send sheet button copy all still say "Toss." Bring them to "Field Note."

**Files:**
- Modify: `app/collection/page.tsx`
- Modify: `app/collection/SendSheet.tsx`

- [ ] **Step 1: In `app/collection/page.tsx`, rename the grid section label**

Find:

```tsx
<span>Your Tosses</span>
```

Replace with:

```tsx
<span>Your Field Notes</span>
```

- [ ] **Step 2: Rename the empty-state CTA**

Find:

```tsx
{isMinting ? "Making..." : "Make your first Toss"}
```

Replace with:

```tsx
{isMinting ? "Making..." : "Make your first Field Note"}
```

- [ ] **Step 3: Rename tile labels and aria-labels**

Find:

```tsx
aria-label={`Send Toss #${id.toString()}`}
```

Replace with:

```tsx
aria-label={`Send Field Note #${id.toString()}`}
```

Find:

```tsx
<span className="text-xs text-neutral-400">
  Toss #{id.toString()}
</span>
```

Replace with:

```tsx
<span className="text-xs text-neutral-400">
  Note #{id.toString()}
</span>
```

- [ ] **Step 4: In `app/collection/SendSheet.tsx`, rename the four user-visible Toss strings**

There are exactly four places where "Toss" appears in user-visible copy in this file. Leave all other occurrences (variable names, imports, comments) untouched.

**Edit 1** — share text (goes into iMessage/native share body). Find:

```ts
const text = "You got a Toss. Open it here:";
```

Replace with:

```ts
const text = "You got a Field Note. Open it here:";
```

**Edit 2** — native share sheet title. Find:

```ts
await navigator.share({ url, title: "Toss", text });
```

Replace with:

```ts
await navigator.share({ url, title: "Field Note", text });
```

**Edit 3** — desktop sheet header label. Find:

```tsx
{ready ? "Ready to share" : "Send this Toss"}
```

Replace with:

```tsx
{ready ? "Ready to share" : "Send this Field Note"}
```

**Edit 4** — item label above the Send button. Find:

```tsx
<div className="text-sm text-neutral-400">
  Toss #{tokenId.toString()}
</div>
```

Replace with:

```tsx
<div className="text-sm text-neutral-400">
  Note #{tokenId.toString()}
</div>
```

Do **not** change the `Phase` type, `handleSend`, any variable names, or any component props — those aren't user-visible.

- [ ] **Step 5: Typecheck + local visual check**

```bash
cd ~/Projects/toss && rm -rf .next && npx tsc --noEmit
```

Then:

```bash
npm run dev
```

Open `http://localhost:3000/collection`:
- Header section above grid reads "Your Field Notes"
- Tile labels read "Note #N"
- Tap a tile → sheet title reads "Send a Field Note"

If anything still says "Toss" in a user-visible place, fix it before committing.

- [ ] **Step 6: Commit**

```bash
git add app/collection/page.tsx app/collection/SendSheet.tsx
git commit -m "$(cat <<'EOF'
refactor(copy): rename Toss -> Field Note in collection + send flow

User-visible strings in the collection grid (section header, empty
state CTA, tile labels, aria-labels) and the send sheet (title,
button copy) switch from 'Toss' to 'Field Note'. Internal variable
and component names unchanged.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: Rename user-visible copy in /sent and /claim

**Why:** Sent-page headings and labels, claim-page headline, and post-claim "see your collection" CTA all still reference "Toss."

**Files:**
- Modify: `app/sent/page.tsx`
- Modify: `app/claim/ClaimClient.tsx`

- [ ] **Step 1: In `app/sent/page.tsx`, rename section headings**

Find:

```tsx
<h1 className="text-2xl font-semibold tracking-tight">
  Your sent Tosses
</h1>
```

Replace with:

```tsx
<h1 className="text-2xl font-semibold tracking-tight">
  Your sent Field Notes
</h1>
```

- [ ] **Step 2: Rename the empty-state copy**

Find:

```tsx
<div className="text-neutral-300 text-base">Nothing sent yet</div>
<div className="text-neutral-500 text-sm">
  Tosses you send will appear here.
</div>
```

Replace with:

```tsx
<div className="text-neutral-300 text-base">Nothing sent yet</div>
<div className="text-neutral-500 text-sm">
  Field Notes you send will appear here.
</div>
```

- [ ] **Step 3: Rename the inline row title**

Find:

```tsx
<span className="text-sm text-neutral-200">
  Toss #{c.tokenId.toString()}
</span>
```

Replace with:

```tsx
<span className="text-sm text-neutral-200">
  Note #{c.tokenId.toString()}
</span>
```

- [ ] **Step 4: Rename the empty-state button**

Find:

```tsx
Send a Toss
```

Replace with:

```tsx
Send a Field Note
```

- [ ] **Step 5: Rename the sign-in copy**

Find:

```tsx
Sign in to see what you've sent and what's been opened.
```

Leave as-is (no rename needed — it doesn't say "Toss").

- [ ] **Step 6: In `app/claim/ClaimClient.tsx`, rename the dynamic headline cases**

Find:

```tsx
{status.kind === "claimed"
  ? "It's yours"
  : settled
    ? "Already opened"
    : expired
      ? "Link expired"
      : "You got a Toss"}
```

Replace with:

```tsx
{status.kind === "claimed"
  ? "It's yours"
  : settled
    ? "Already opened"
    : expired
      ? "Link expired"
      : "You got a Field Note"}
```

- [ ] **Step 7: Typecheck + local check**

```bash
cd ~/Projects/toss && rm -rf .next && npx tsc --noEmit
```

```bash
npm run dev
```

- Open `/sent` — heading reads "Your sent Field Notes," row titles read "Note #N"
- Open `/t/<any-id>` — headline reads "You got a Field Note" (when the link is valid, unclaimed, unexpired)

- [ ] **Step 8: Commit**

```bash
git add app/sent/page.tsx app/claim/ClaimClient.tsx
git commit -m "$(cat <<'EOF'
refactor(copy): rename Toss -> Field Note in /sent and /claim

Sent-page headings, empty state, and row labels rename to 'Field
Note(s)'. Claim-page default headline 'You got a Toss' becomes
'You got a Field Note'. Other dynamic states (already opened,
expired, it's yours) unchanged.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: Update OG metadata titles

**Why:** Link previews (iMessage, Slack, Discord) still say "Jordan sent you a Toss" / "You got a Toss." These are generated server-side in `lib/ogMeta.ts`. Field Notes is how the art is named now.

**Files:**
- Modify: `lib/ogMeta.ts`

- [ ] **Step 1: Update the default title constant**

Find:

```ts
const DEFAULT_TITLE = "You got a Toss";
const DEFAULT_DESCRIPTION = "Open to keep it. Free. Takes seconds.";
```

Replace with:

```ts
const DEFAULT_TITLE = "You got a Field Note";
const DEFAULT_DESCRIPTION = "Open to keep it. Free. Takes seconds.";
```

- [ ] **Step 2: Update the name-resolved title template**

Find:

```ts
if (name) title = `${name} sent you a Toss`;
```

Replace with:

```ts
if (name) title = `${name} sent you a Field Note`;
```

- [ ] **Step 3: Typecheck**

```bash
cd ~/Projects/toss && rm -rf .next && npx tsc --noEmit
```

- [ ] **Step 4: Verify the OG title renders correctly on the live deploy after merge**

(Defer the live verification to Task 9. Local SSR on localhost works differently than production because Privy needs the real `PRIVY_APP_SECRET`. Trust typecheck + manual review here; actual OG preview test is in QA.)

- [ ] **Step 5: Commit**

```bash
git add lib/ogMeta.ts
git commit -m "$(cat <<'EOF'
refactor(copy): rename Toss -> Field Note in OG preview titles

Link preview titles switch to 'You got a Field Note' and
'{Name} sent you a Field Note' so iMessage/Slack/Discord cards
reflect the repositioning.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: New homepage — Field Notes hero + Toss credit band

**Why:** `app/page.tsx` is currently a 500-line cinematic demo with two phone mockups and an iMessage simulation. Spec calls for a warm art-project homepage (Field Notes hero on cream background) with a dark Toss credit band below. See the approved mock at `.superpowers/brainstorm/60522-1776978273/content/homepage-b-refined.html`.

**Files:**
- Modify: `app/page.tsx` (complete rewrite)

- [ ] **Step 1: Rewrite `app/page.tsx` from scratch**

Replace the **entire file** with:

```tsx
"use client";

import Link from "next/link";
import { DEMO_NFT_ADDRESS } from "@/lib/contracts";
import { NFTPreview } from "@/app/components/NFTPreview";

const REPO_URL = "https://github.com/jordanlyall/toss";

// Six tokenIds chosen to sample the palette variety. These render live from
// the on-chain contract; if a tokenId hasn't been minted the preview falls
// back gracefully.
const PREVIEW_IDS: bigint[] = [0n, 1n, 2n, 3n, 4n, 5n];

export default function Landing() {
  const contractsReady = !!DEMO_NFT_ADDRESS;

  return (
    <main className="min-h-screen bg-[#0a0a0a] flex flex-col">
      {/* Art section — warm paper background */}
      <section className="bg-[#faf9f5] text-[#141413]">
        <header className="max-w-5xl mx-auto px-6 py-5 flex items-center justify-between">
          <span className="text-base font-semibold tracking-tight">
            Field Notes
          </span>
          <Link
            href="/collection"
            className="text-sm text-[#141413] hover:text-black min-h-11 px-3 flex items-center"
          >
            Sign in
          </Link>
        </header>

        <div className="max-w-5xl mx-auto px-6 pt-10 pb-20 md:pt-20 md:pb-28">
          <div className="max-w-2xl space-y-4">
            <div className="text-[11px] uppercase tracking-[0.14em] text-neutral-500">
              Jordan Lyall
            </div>
            <h1 className="text-4xl md:text-5xl font-medium tracking-[-0.02em] leading-[1.05]">
              Small compositions, made to be given.
            </h1>
            <p className="text-base text-neutral-600 leading-relaxed max-w-xl pt-2">
              An open-ended series of on-chain glyph grids. Eight marks, six
              palettes, a lot of whitespace. Each one is generated the moment
              you make it.
            </p>
          </div>

          {contractsReady ? (
            <div className="mt-10 grid grid-cols-3 md:grid-cols-6 gap-3 max-w-3xl">
              {PREVIEW_IDS.map((id) => (
                <div key={id.toString()} className="aspect-square">
                  <NFTPreview
                    contract={DEMO_NFT_ADDRESS}
                    tokenId={id}
                    size="lg"
                    className="!max-w-none"
                  />
                </div>
              ))}
            </div>
          ) : null}

          <div className="mt-10 flex items-center gap-3">
            <Link
              href="/collection"
              className="rounded-md bg-[#141413] hover:bg-black text-[#faf9f5] px-6 py-3 text-base font-medium min-h-[52px] flex items-center"
            >
              Make one
              <span className="ml-2">→</span>
            </Link>
          </div>
        </div>
      </section>

      {/* Toss credit band — dark */}
      <section className="bg-[#0a0a0a] border-t border-neutral-900 text-neutral-300">
        <div className="max-w-5xl mx-auto px-6 py-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <p className="text-sm leading-relaxed">
            A demo of <span className="font-semibold text-white">Toss</span> —
            a pattern for sending free-mint, on-chain art by link. Open source.
          </p>
          <a
            href={REPO_URL}
            target="_blank"
            rel="noreferrer"
            className="self-start md:self-auto rounded-md border border-neutral-700 hover:border-neutral-500 px-4 py-2 text-sm text-white min-h-11 inline-flex items-center"
          >
            GitHub →
          </a>
        </div>
      </section>
    </main>
  );
}
```

- [ ] **Step 2: Typecheck**

```bash
cd ~/Projects/toss && rm -rf .next && npx tsc --noEmit
```

Expected: no output. If there are unused-import errors from the old file (e.g., `useMemo`, `useState`, `usePrivy`, etc.), they'll all be gone because the whole file was replaced.

- [ ] **Step 3: Visual check in local dev**

```bash
npm run dev
```

Open `http://localhost:3000`:

- Cream background hero with "Jordan Lyall" label, "Small compositions, made to be given." headline, statement paragraph
- 6-tile grid of live on-chain previews (requires deployed contracts on Base Sepolia; if no contract is reachable, grid is hidden cleanly)
- Primary CTA "Make one →" with dark button
- Dark band below with Toss credit + GitHub button

If previews fail to render (common on first load when RPC is cold), that's OK — they're live reads. Refresh once; if they still don't load, the NFTPreview component handles fallback.

- [ ] **Step 4: Click-through check**

- Click "Sign in" → lands on `/collection`, which handles auth states
- Click "Make one →" → lands on `/collection`
- Click "GitHub →" → opens new tab to `github.com/jordanlyall/toss` (will 404 until Task 9 flips the repo public; that's expected intermediate state)

- [ ] **Step 5: Commit**

```bash
git add app/page.tsx
git commit -m "$(cat <<'EOF'
feat(home): Field Notes homepage, Toss credit band

Replaces the 500-line cinematic 3-phone demo with an art-project
homepage. Cream hero (Field Notes by Jordan Lyall, artist statement,
six live on-chain previews across palettes, 'Make one' CTA), dark
credit band below with the Toss infra credit and GitHub link.

The 'Make one' CTA routes to /collection which already handles
unauthenticated visitors (shows Sign in), empty-owned users (shows
'Make your first Field Note'), and returning users (shows their
grid). No new routes or auth flow needed.

The previous cinematic demo is preserved in git history; it
demonstrated the send mechanic well but the mechanic now
demonstrates itself live on /collection.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 8: Push, verify live deploy, full send-to-claim QA

**Why:** Six commits are queued locally. Push triggers Vercel auto-deploy. Need to verify OG title resolves with the new copy and the whole send-to-claim loop still works under the renamed strings.

**Files:** None modified; this is a verification task.

- [ ] **Step 1: Push all queued commits**

```bash
cd ~/Projects/toss && git push origin main
```

- [ ] **Step 2: Wait for Vercel deploy to be Ready**

```bash
# Poll every 10s until latest production deploy is Ready
for i in {1..30}; do
  status=$(vercel ls 2>/dev/null | awk 'NR==2 && /Production/ {print $4}')
  if [ "$status" = "Ready" ] || [ "$status" = "●" ]; then
    echo "Deploy Ready"
    break
  fi
  sleep 10
done
```

Or manually check Vercel dashboard until latest commit is Ready.

- [ ] **Step 3: Verify homepage renders the new content**

```bash
curl -s https://toss.lol/ | grep -oE "(Field Notes|Small compositions, made to be given|A demo of)" | head -5
```

Expected: all three strings appear in the output.

- [ ] **Step 4: Verify OG metadata on a real claim URL**

```bash
# Use any existing tokenId that you know has a deposit, e.g. 21 from earlier
curl -s https://toss.lol/t/21 | grep -oE '<meta[^>]*og:title[^>]*>' | head -2
```

Expected: either `"You got a Field Note"` (if the sender has no displayName) or `"<name> sent you a Field Note"` (if they do).

- [ ] **Step 5: Manual end-to-end test in browser**

Open https://toss.lol in a regular browser window (not incognito):

- [ ] Homepage shows Field Notes hero, previews, dark band with GitHub link
- [ ] Click "Make one →" → lands on `/collection`
- [ ] Sign in if not already; if already authenticated, grid renders
- [ ] Tap a tile → sheet opens with "Send a Field Note" title
- [ ] Complete a send to yourself (open the resulting link in another device/tab)
- [ ] Claim link shows "You got a Field Note" on `/t/<id>`
- [ ] Claim it → see "It's yours" → "Saved to your collection"
- [ ] Navigate to `/sent` → the just-sent item shows as "Opened" with label "Note #N"
- [ ] Open `/settings` → wordmark reads "Field Notes", display name still persists

- [ ] **Step 6: Check iMessage/Slack preview (optional but recommended)**

Paste a claim URL into iMessage or Slack and confirm the preview title reads `Jordan sent you a Field Note` (or whatever displayName is set). Art fills the frame; domain below reads `toss.lol`.

- [ ] **Step 7: If any failure, halt and fix before Task 9**

Do not flip the repo public if any visible copy still shows "Toss" where Field Note is expected.

No commit for this task; pure verification. If any fix commits are needed, add them here before advancing.

---

## Task 9: Flip GitHub repo to public + verify band link

**Why:** Band on the homepage advertises "open source" and links to the repo. Until the repo is public, that link 404s. This is the last step; do it only after Task 8 passes.

**Files:** None modified in this repo — this is a GitHub settings change.

- [ ] **Step 1: Flip the repo to public via `gh` CLI**

```bash
gh repo edit jordanlyall/toss --visibility public --accept-visibility-change-consequences
```

Expected output: something like `✓ Edited repository jordanlyall/toss`.

If `gh` CLI is not authenticated, use the GitHub web UI instead: repo → Settings → General → Danger Zone → Change visibility → Make public. Confirm the warning.

- [ ] **Step 2: Verify the repo is publicly readable**

```bash
curl -sI https://github.com/jordanlyall/toss | head -3
# Also check without auth that the repo landing page works
curl -sI https://api.github.com/repos/jordanlyall/toss | grep -E "HTTP/|^status"
```

Expected: both return 200 without GitHub auth.

- [ ] **Step 3: Verify the homepage band link works end-to-end**

Open https://toss.lol in an incognito/private browser window (to simulate a fresh visitor). Click the "GitHub →" button. Should land on the repo page and render README (which now shows the Field Notes + Toss framing from Task 2).

- [ ] **Step 4: Confirm README renders cleanly on GitHub**

Skim the rendered README on github.com/jordanlyall/toss. Check for broken markdown, missing images, unexpected line breaks. Fix any issue with a follow-up commit if needed.

- [ ] **Step 5: Done — no repo-level commit needed**

GitHub visibility is a settings change, not a commit in this repo. The task is complete once the repo is publicly accessible and the homepage link resolves.

---

## Done criteria

- [ ] Homepage at toss.lol leads with Field Notes and credits Toss in a dark band
- [ ] Every user-visible "Toss" string in the app is now "Field Note" / "Field Notes" / "Note #N"
- [ ] OG link previews read "<name> sent you a Field Note" / "You got a Field Note"
- [ ] GitHub repo is public, README matches the new framing, LICENSE is present
- [ ] Full send-to-claim flow works end-to-end under the new copy
- [ ] Nothing sensitive was committed to public history

---

## Post-hackathon backlog (explicitly deferred)

From the design spec's "Out of scope" section — not part of this plan, but captured so they aren't lost:

- `/about` artist statement page (and wire up the "Read the statement" secondary CTA)
- `/archive` — full gallery of all minted Field Notes
- Redeploy contracts with on-chain name "Field Notes" (breaks current testnet data; requires migration)
- Live `/sent` updates without manual refresh
- Server-rendered first paint on `/t/[id]`
- ECDSA-bound claim (mainnet-blocker: prevents mempool front-running)
