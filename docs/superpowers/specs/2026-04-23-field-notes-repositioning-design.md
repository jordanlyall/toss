# Field Notes repositioning — design spec

**Date:** 2026-04-23
**Author:** Jordan Lyall (with Claude)
**Status:** Approved for implementation
**Target:** Hackathon demo, 2026-04-24

## Summary

Reposition the project from "Toss, a share mechanic for NFTs" to "Field Notes, an art project by Jordan Lyall — built on Toss, an open-source pattern for sending free-mint on-chain art by link." Replace the existing 3-phone cinematic demo homepage with a Field Notes art-project homepage. Rename user-facing copy throughout the app from "Toss" to "Field Note." Ship a public GitHub repo with a short README so the dev-credit on the homepage is real, not vapor.

## Why

The current site markets the share mechanic (Toss). That framing underweights the work the on-chain art is actually doing and overweights the infrastructure, which is interesting but abstract to first-time visitors. Reframing splits the identity cleanly: **Field Notes** is the art (what people collect, send, and feel), **Toss** is the infra (credit, code, optional reuse). This is how crypto-native patterns work (Zora protocol vs. specific drops; Manifold infra vs. artist editions). It also leaves optionality: Toss could stay a quiet credit forever, or grow into a studio offering ("we'll help you ship one") if artists/brands reach out. No platform claims today — the positioning stays honest about what actually exists.

## Identity decisions

- **Art project name:** Field Notes
- **Artist:** Jordan Lyall
- **Infra/tech name:** Toss (unchanged)
- **Domain:** toss.lol (unchanged; the asymmetry reads as "infra is Toss, instance is Field Notes")
- **Repo:** github.com/jordanlyall/toss (flipped to public)

## Homepage design

**Layout: B refined** (Layout B from the visual companion, confirmed 2026-04-23). See `.superpowers/brainstorm/60522-1776978273/content/homepage-b-refined.html` for the mock.

**Structure, top to bottom:**

1. **Top bar** — "Field Notes" wordmark (left), *Sign in* (right). About/Archive nav items from the mock are omitted for hackathon since those pages don't exist yet; re-introduce post-hackathon.
2. **Hero section** — warm cream background (matches the "Paper" palette of the art). Contains:
   - Small uppercase label: `JORDAN LYALL`
   - Hero line: **Small compositions, made to be given.**
   - Statement: *An open-ended series of on-chain glyph grids. Eight marks, six palettes, a lot of whitespace. Each one is generated the moment you make it.*
   - Preview grid: 6-tile strip showing real on-chain Field Notes (rendered via existing `NFTPreview` component) across all six palettes for visual variety.
   - Primary CTA: **Make one →** (solid, dark) — links to `/collection`, which handles auth and minting.
   - Secondary CTA: **Read the statement** — *omit for hackathon* (no statement page exists yet).
3. **Toss credit band** — dark, thin, below the fold of the hero. Contains:
   - Copy: *A demo of **Toss** — a pattern for sending free-mint, on-chain art by link. Open source.*
   - Right-aligned link: **GitHub →** (goes to github.com/jordanlyall/toss)

**Visual tone:** the art is warm and paper-toned; the Toss band is dark. The contrast signals "art above / infra below" without needing labels.

## App-wide copy changes

Every user-visible instance of "Toss" becomes "Field Note" (or "Field Notes" plural/collective).

| Surface | Before | After |
|---|---|---|
| App header wordmark (`/collection`, `/sent`, `/settings`) | Toss | Field Notes |
| Collection page grid header label | (none) | Your Field Notes |
| Collection empty-state CTA | Make your first Toss | Make your first Field Note |
| Collection tile label | Toss #N | Note #N |
| Send sheet title | Send a Toss | Send a Field Note |
| Sent page labels | Tosses you send / Toss #N | Field Notes you send / Note #N |
| OG preview title | *Name* sent you a Toss / You got a Toss | *Name* sent you a Field Note / You got a Field Note |
| `/t/[id]` page headline | You got a Toss | You got a Field Note |
| `/claim` page headline | You got a Toss | You got a Field Note |
| Post-claim message | (existing) Saved to your collection. | Saved to your collection. *(unchanged)* |
| Landing page entirely | 3-phone cinematic demo | Replaced (see Homepage design above) |

"Toss" continues to appear in:
- Homepage band copy ("A demo of Toss…")
- GitHub repo name (unchanged)
- Domain (toss.lol, invisible to users interacting with the app)
- Technical internals (Solidity contracts, component names) — no user impact

**On-chain naming note:** the `DemoNFT` contract's ERC-721 name is currently `"Toss Glyph Grid"` / symbol `"TOSS"`. On-chain naming stays as-is for the hackathon — changing it requires a contract redeploy and migration of the current testnet data. Post-hackathon, if we want marketplace/explorer tooling to show "Field Notes," we redeploy with new name/symbol.

## CTA / signup flow

The "Make one" button on the homepage routes to `/collection`. That page already handles both states correctly:

- **Unauthenticated visitor:** sees the signed-out hero on `/collection` ("Send a Toss" → to be updated to "Send a Field Note, sign in to make one"), clicks Sign in, Privy takes over.
- **Authenticated, zero owned:** sees the empty-state CTA "Make your first Field Note."
- **Authenticated, some owned:** sees their grid.

No new routes needed. No signup-flow rewrite needed. Just copy.

## GitHub / repo prep

Required before the band link goes live:

1. **Secrets audit.** Scan git history for anything sensitive. The live `PRIVY_APP_SECRET` lives in Vercel env, not in the repo — confirm `.env.local` is gitignored and grep the history for accidental commits of `.env*` or any secret-looking strings.
2. **README.** Short, scannable. Covers:
   - What Field Notes is (one paragraph)
   - What Toss is (one paragraph)
   - Live demo link (toss.lol)
   - How to run locally (tl;dr: `npm install`, `.env.local` from `.env.local.example`, `npm run dev`)
   - Contracts: addresses on Base Sepolia, link to deployed.json
   - License
3. **LICENSE.** MIT is the obvious default; confirm or pick.
4. **Flip visibility.** Private → Public via GitHub settings.

## Out of scope for hackathon

Explicitly deferred to post-demo:

- `/about` / full artist statement page
- `/archive` / all-pieces gallery view
- Extra biographical / artist content
- On-chain contract rename ("Toss Glyph Grid" → "Field Notes")
- Deprecating `/claim` legacy route (still works, no harm)
- Animated hero or complex visuals
- Secondary CTA ("Read the statement") — no page to link to yet

## Risks / known tradeoffs

- **Losing the cinematic demo.** The current 3-phone iMessage demo is the best visual explainer of the share mechanic, and it's being deleted. Mitigation: the mechanic demonstrates itself live at the hackathon (send a Field Note to a judge's phone); the old demo can be recovered from git history if we want to repurpose later.
- **On-chain name mismatch.** Marketplaces/explorers will show "Toss Glyph Grid" while the app says "Field Notes" until we redeploy. Acceptable for testnet demo; worth fixing before any mainnet push.
- **Public repo before hackathon.** Any oversight (forgotten secret, WIP code) becomes public. The secrets audit step is the mitigation, but worth doing it carefully.

## Implementation checklist (preview — full plan via writing-plans)

Ordered roughly by dependency, not priority:

1. Audit git history for secrets; verify `.env.local` gitignored
2. Write README + LICENSE
3. Rewrite `app/page.tsx` as the new Field Notes homepage (delete cinematic demo)
4. Rename user-visible copy across:
   - `app/collection/page.tsx`
   - `app/collection/SendSheet.tsx`
   - `app/sent/page.tsx`
   - `app/claim/ClaimClient.tsx`
   - `app/t/[id]/page.tsx` (if it has inline copy)
   - `lib/ogMeta.ts` (OG title strings)
5. Update app header wordmark to "Field Notes" (used across `/collection`, `/sent`, `/settings`)
6. QA the full send-to-claim loop on toss.lol with new copy
7. Flip GitHub repo to public
8. Verify homepage band GitHub link resolves

## References

- Visual mock: `.superpowers/brainstorm/60522-1776978273/content/homepage-b-refined.html`
- Fork-layout comparison (archive): `.superpowers/brainstorm/60522-1776978273/content/homepage-layouts.html`
- Previous site state: commit `55807d6` (before this repositioning)
