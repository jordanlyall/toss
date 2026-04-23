"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePublicClient } from "wagmi";
import { baseSepolia } from "wagmi/chains";
import { DEMO_NFT_ABI, DEMO_NFT_ADDRESS } from "@/lib/contracts";
import { NFTPreview } from "@/app/components/NFTPreview";
import { deriveTraits, type PaletteName } from "@/lib/traits";

const REPO_URL = "https://github.com/jordanlyall/toss";

// Six IDs that sample the palette variety. Computed client-side from the
// contract's nextId — we pick the first minted token we see for each palette
// so visitors get a grid that spans Paper / Sun / Ocean / Forest / Noir / Neon
// instead of six neighboring IDs that may cluster.
const PALETTES: PaletteName[] = [
  "Paper",
  "Sun",
  "Ocean",
  "Forest",
  "Noir",
  "Neon",
];

// Fallback while nextId is loading. These specific low IDs are known-minted
// on the live contract and happen to hit multiple palettes; if the client
// never finishes loading nextId we still render something reasonable.
const FALLBACK_IDS: bigint[] = [0n, 1n, 2n, 3n, 4n, 5n];

export default function Landing() {
  const contractsReady = !!DEMO_NFT_ADDRESS;
  const publicClient = usePublicClient({ chainId: baseSepolia.id });
  const [previewIds, setPreviewIds] = useState<bigint[]>(FALLBACK_IDS);

  useEffect(() => {
    if (!publicClient || !DEMO_NFT_ADDRESS) return;
    let cancelled = false;
    (async () => {
      try {
        const nextId = (await publicClient.readContract({
          address: DEMO_NFT_ADDRESS,
          abi: DEMO_NFT_ABI,
          functionName: "nextId",
        })) as bigint;
        if (cancelled || nextId === 0n) return;
        const seen = new Map<PaletteName, bigint>();
        for (let i = 0n; i < nextId && seen.size < PALETTES.length; i++) {
          const p = deriveTraits(i).palette;
          if (!seen.has(p)) seen.set(p, i);
        }
        const curated = PALETTES.map((p) => seen.get(p)).filter(
          (id): id is bigint => id !== undefined,
        );
        if (!cancelled && curated.length >= 3) {
          setPreviewIds(curated);
        }
      } catch {
        // Fallback IDs stay. Silent — landing page should never error.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [publicClient]);

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
              Small compositions, made to be shared.
            </h1>
            <p className="text-base text-neutral-600 leading-relaxed max-w-xl pt-2">
              An open-ended series of on-chain glyph grids. Eight marks, six
              palettes, a lot of whitespace. Each one is generated the moment
              you make it.
            </p>
          </div>

          {contractsReady ? (
            <div className="mt-10 grid grid-cols-3 md:grid-cols-6 gap-3 max-w-3xl">
              {previewIds.map((id) => (
                <div key={id.toString()} className="aspect-square">
                  <NFTPreview
                    contract={DEMO_NFT_ADDRESS}
                    tokenId={id}
                    size="lg"
                    className="!max-w-none !border-neutral-200"
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
