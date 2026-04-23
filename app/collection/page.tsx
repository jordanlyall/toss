"use client";

import { useEffect, useMemo, useState } from "react";
import { usePrivy } from "@privy-io/react-auth";
import { useSmartWallets } from "@privy-io/react-auth/smart-wallets";
import { usePublicClient } from "wagmi";
import { encodeFunctionData, type Address } from "viem";
import { baseSepolia } from "wagmi/chains";
import Link from "next/link";
import {
  DEMO_NFT_ABI,
  DEMO_NFT_ADDRESS,
  ESCROW_ABI,
  ESCROW_ADDRESS,
} from "@/lib/contracts";
import { NFTPreview } from "@/app/components/NFTPreview";
import { ProfileMenu } from "@/app/components/ProfileMenu";
import { SendSheet } from "@/app/collection/SendSheet";
import { discoverOwnedIds } from "@/lib/owned";
import { haptic } from "@/lib/haptic";

type MintStatus =
  | { kind: "idle" }
  | { kind: "minting" }
  | { kind: "error"; message: string };

export default function CollectionPage() {
  const { ready, authenticated, login } = usePrivy();
  const { client: smartClient } = useSmartWallets();
  const publicClient = usePublicClient({ chainId: baseSepolia.id });

  const address = smartClient?.account?.address as Address | undefined;

  const [mint, setMint] = useState<MintStatus>({ kind: "idle" });
  const [ownedIds, setOwnedIds] = useState<bigint[]>([]);
  const [ownedLoaded, setOwnedLoaded] = useState(false);
  const [activeTokenId, setActiveTokenId] = useState<bigint | null>(null);

  async function refreshOwned(addr: Address) {
    if (!publicClient || !DEMO_NFT_ADDRESS) {
      console.warn("refreshOwned skipped", {
        hasPublicClient: !!publicClient,
        hasContract: !!DEMO_NFT_ADDRESS,
      });
      return;
    }
    try {
      const owned = await discoverOwnedIds(publicClient, addr);
      console.info("refreshOwned", { addr, owned: owned.map(String) });
      setOwnedIds(owned);
      setOwnedLoaded(true);
    } catch (err) {
      console.error("refreshOwned failed", err);
      setOwnedLoaded(true);
    }
  }

  useEffect(() => {
    if (!address || !publicClient) return;
    void refreshOwned(address);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [address, publicClient]);

  // Pre-approve the escrow for all tokens the moment the wallet is ready.
  // Fire-and-forget: if it fails, the explicit approval inside SendSheet still
  // runs. Result: the first Send is a single tap instead of approve + deposit.
  useEffect(() => {
    if (!smartClient || !publicClient || !address) return;
    if (!DEMO_NFT_ADDRESS || !ESCROW_ADDRESS) return;
    let cancelled = false;
    (async () => {
      try {
        const approved = (await publicClient.readContract({
          address: DEMO_NFT_ADDRESS,
          abi: DEMO_NFT_ABI,
          functionName: "isApprovedForAll",
          args: [address, ESCROW_ADDRESS],
        })) as boolean;
        if (approved || cancelled) return;
        await smartClient.sendTransaction({
          to: DEMO_NFT_ADDRESS,
          data: encodeFunctionData({
            abi: DEMO_NFT_ABI,
            functionName: "setApprovalForAll",
            args: [ESCROW_ADDRESS, true],
          }),
        });
      } catch {
        // Silent — SendSheet will do the same check on demand.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [smartClient, publicClient, address]);

  const canMint = useMemo(
    () => !!smartClient && !!DEMO_NFT_ADDRESS,
    [smartClient],
  );

  async function handleMint() {
    if (!smartClient || !publicClient || !address) return;
    haptic.press();
    setMint({ kind: "minting" });
    try {
      const hash = await smartClient.sendTransaction({
        to: DEMO_NFT_ADDRESS,
        data: encodeFunctionData({
          abi: DEMO_NFT_ABI,
          functionName: "mint",
          args: [],
        }),
      });
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      let tokenId: bigint | null = null;
      const transferTopic =
        "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";
      for (const log of receipt.logs) {
        if (log.address.toLowerCase() !== DEMO_NFT_ADDRESS.toLowerCase())
          continue;
        if (log.topics[0] !== transferTopic) continue;
        if (log.topics.length < 4) continue;
        const to = ("0x" + log.topics[2]!.slice(-40)).toLowerCase();
        if (to !== address.toLowerCase()) continue;
        tokenId = BigInt(log.topics[3]!);
        break;
      }
      if (tokenId === null) throw new Error("Could not confirm the new Field Note");
      setOwnedIds((prev) => Array.from(new Set([...prev, tokenId!])));
      setMint({ kind: "idle" });
      haptic.success();
    } catch (err: any) {
      haptic.error();
      setMint({
        kind: "error",
        message: err?.shortMessage || err?.message || "Could not make a Field Note",
      });
    }
  }

  if (!ready) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <div className="text-neutral-500 text-sm">Loading...</div>
      </main>
    );
  }

  const isMinting = mint.kind === "minting";
  const contractsReady = !!ESCROW_ADDRESS && !!DEMO_NFT_ADDRESS;

  return (
    <main className="min-h-screen pb-20">
      {/* Top bar */}
      <header className="sticky top-0 z-20 bg-black/80 backdrop-blur border-b border-neutral-900">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <Link
            href="/"
            className="text-base font-semibold tracking-tight text-white"
          >
            Field Notes
          </Link>
          {authenticated && address ? (
            <nav className="flex items-center gap-1 text-sm">
              <span className="min-h-11 px-3 rounded-full bg-neutral-900 text-white flex items-center">
                Collection
              </span>
              <Link
                href="/sent"
                className="min-h-11 px-3 rounded-full hover:bg-neutral-900 text-neutral-400 hover:text-white flex items-center"
              >
                Sent
              </Link>
              <ProfileMenu address={address} />
            </nav>
          ) : null}
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-4 pt-6">
        {!contractsReady ? (
          <div className="rounded-lg border border-amber-900 bg-amber-950/30 px-4 py-3 text-sm text-amber-200">
            Contracts not deployed. Run{" "}
            <code className="font-mono">npm run deploy:sepolia</code> first.
          </div>
        ) : !authenticated ? (
          <div className="pt-16 pb-8 text-center space-y-6">
            <div className="space-y-2">
              <h1 className="text-2xl font-semibold tracking-tight">
                Send a Field Note
              </h1>
              <p className="text-neutral-400 text-sm max-w-sm mx-auto">
                Sign in, make one, and text a link. It's free.
              </p>
            </div>
            <button
              onClick={login}
              className="w-full max-w-xs mx-auto rounded-xl bg-blue-600 hover:bg-blue-500 px-5 py-4 text-base font-medium min-h-[52px]"
            >
              Sign in
            </button>
          </div>
        ) : !smartClient ? (
          <div className="pt-16 text-center text-sm text-neutral-400">
            Getting things ready...
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between text-xs text-neutral-500 mb-4">
              <span>Your Field Notes</span>
            </div>

            {!ownedLoaded ? (
              <ul className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {Array.from({ length: 6 }).map((_, i) => (
                  <li key={i}>
                    <div className="aspect-square w-full rounded-xl bg-neutral-900 animate-pulse" />
                    <div className="mt-2 h-3 w-16 rounded bg-neutral-900 animate-pulse" />
                  </li>
                ))}
              </ul>
            ) : ownedIds.length === 0 ? (
              <div className="pt-10 pb-8 text-center space-y-5">
                <div className="space-y-1">
                  <div className="text-neutral-300 text-base">
                    Nothing here yet
                  </div>
                  <div className="text-neutral-500 text-sm">
                    Make your first Toss to get started.
                  </div>
                </div>
                <button
                  onClick={handleMint}
                  disabled={!canMint || isMinting}
                  className="w-full max-w-xs mx-auto rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 px-5 py-4 text-base font-medium min-h-[52px]"
                >
                  {isMinting ? "Making..." : "Make your first Field Note"}
                </button>
                {mint.kind === "error" ? (
                  <div className="max-w-sm mx-auto rounded-lg border border-red-900 bg-red-950/30 px-4 py-3 text-sm text-red-200">
                    {mint.message}
                  </div>
                ) : null}
              </div>
            ) : (
              <>
                <ul className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                  {ownedIds.map((id) => (
                    <li key={id.toString()}>
                      <button
                        onClick={() => {
                          haptic.tap();
                          setActiveTokenId(id);
                        }}
                        className="group w-full text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded-xl"
                        aria-label={`Send Field Note #${id.toString()}`}
                      >
                        <div className="relative">
                          <NFTPreview
                            contract={DEMO_NFT_ADDRESS}
                            tokenId={id}
                            size="lg"
                            className="!max-w-none transition-transform duration-150 group-active:scale-[0.96]"
                          />
                        </div>
                        <div className="mt-2 px-0.5">
                          <span className="text-xs text-neutral-400">
                            Note #{id.toString()}
                          </span>
                        </div>
                      </button>
                    </li>
                  ))}
                </ul>

                {mint.kind === "error" ? (
                  <div className="mt-4 rounded-lg border border-red-900 bg-red-950/30 px-4 py-3 text-sm text-red-200">
                    {mint.message}
                  </div>
                ) : null}
              </>
            )}

          </>
        )}
      </div>

      {authenticated &&
      smartClient &&
      canMint &&
      ownedIds.length > 0 &&
      activeTokenId === null ? (
        <button
          onClick={handleMint}
          disabled={isMinting}
          aria-label="New Toss"
          className="fixed right-6 z-20 h-14 w-14 rounded-full bg-blue-600 hover:bg-blue-500 disabled:opacity-60 shadow-lg shadow-blue-950/50 flex items-center justify-center text-white active:scale-95 transition-transform"
          style={{ bottom: "calc(1.5rem + env(safe-area-inset-bottom))" }}
        >
          {isMinting ? (
            <span className="text-lg">...</span>
          ) : (
            <svg width="22" height="22" viewBox="0 0 14 14" fill="none">
              <path
                d="M7 2v10M2 7h10"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
              />
            </svg>
          )}
        </button>
      ) : null}

      <SendSheet
        tokenId={activeTokenId}
        onClose={() => setActiveTokenId(null)}
        onSent={(id) =>
          setOwnedIds((prev) => prev.filter((t) => t !== id))
        }
      />
    </main>
  );
}
