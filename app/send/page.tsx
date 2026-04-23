"use client";

import { useEffect, useMemo, useState } from "react";
import { usePrivy } from "@privy-io/react-auth";
import { useSmartWallets } from "@privy-io/react-auth/smart-wallets";
import { usePublicClient } from "wagmi";
import { encodeFunctionData, formatEther, type Address } from "viem";
import { baseSepolia } from "wagmi/chains";
import Link from "next/link";
import {
  DEMO_NFT_ABI,
  DEMO_NFT_ADDRESS,
  ESCROW_ABI,
  ESCROW_ADDRESS,
} from "@/lib/contracts";
import { NFTPreview } from "@/app/components/NFTPreview";
import { SendSheet } from "@/app/send/SendSheet";
import { discoverOwnedIds } from "@/lib/owned";

type MintStatus =
  | { kind: "idle" }
  | { kind: "minting" }
  | { kind: "error"; message: string };

function shorten(addr: string | undefined): string {
  if (!addr) return "";
  return `${addr.slice(0, 4)}..${addr.slice(-4)}`;
}

export default function SendPage() {
  const { ready, authenticated, login, logout } = usePrivy();
  const { client: smartClient } = useSmartWallets();
  const publicClient = usePublicClient({ chainId: baseSepolia.id });

  const address = smartClient?.account?.address as Address | undefined;

  const [mint, setMint] = useState<MintStatus>({ kind: "idle" });
  const [ownedIds, setOwnedIds] = useState<bigint[]>([]);
  const [balance, setBalance] = useState<bigint | null>(null);
  const [activeTokenId, setActiveTokenId] = useState<bigint | null>(null);

  async function refreshOwned(addr: Address) {
    if (!publicClient || !DEMO_NFT_ADDRESS) return;
    try {
      const owned = await discoverOwnedIds(publicClient, addr);
      setOwnedIds(owned);
    } catch {
      // Transient RPC failure — keep whatever's currently on screen.
    }
  }

  async function refreshBalance(addr: Address) {
    if (!publicClient) return;
    try {
      const bal = await publicClient.getBalance({ address: addr });
      setBalance(bal);
    } catch {}
  }

  useEffect(() => {
    if (!address) return;
    void refreshOwned(address);
    void refreshBalance(address);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [address]);

  const canMint = useMemo(
    () => !!smartClient && !!DEMO_NFT_ADDRESS,
    [smartClient],
  );

  async function handleMint() {
    if (!smartClient || !publicClient || !address) return;
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
      if (tokenId === null) throw new Error("Could not find tokenId in logs");
      setOwnedIds((prev) => Array.from(new Set([...prev, tokenId!])));
      setMint({ kind: "idle" });
    } catch (err: any) {
      setMint({
        kind: "error",
        message: err?.shortMessage || err?.message || "Mint failed",
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
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link
            href="/"
            className="text-base font-semibold tracking-tight text-white"
          >
            Toss
          </Link>
          {authenticated && address ? (
            <div className="flex items-center gap-2">
              <div className="hidden sm:block text-right leading-tight">
                <div className="text-[11px] uppercase tracking-wide text-neutral-500">
                  Wallet
                </div>
                <div className="font-mono text-xs text-neutral-300">
                  {shorten(address)}
                </div>
              </div>
              {canMint ? (
                <button
                  onClick={handleMint}
                  disabled={isMinting}
                  aria-label="Mint NFT"
                  className="min-h-11 min-w-11 rounded-full border border-neutral-800 hover:border-neutral-600 disabled:opacity-50 px-3 text-sm flex items-center gap-1"
                >
                  {isMinting ? (
                    <span className="text-xs">Minting...</span>
                  ) : (
                    <>
                      <svg
                        width="14"
                        height="14"
                        viewBox="0 0 14 14"
                        fill="none"
                      >
                        <path
                          d="M7 2v10M2 7h10"
                          stroke="currentColor"
                          strokeWidth="1.5"
                          strokeLinecap="round"
                        />
                      </svg>
                      <span className="text-xs">Mint</span>
                    </>
                  )}
                </button>
              ) : null}
              <button
                onClick={logout}
                aria-label="Sign out"
                className="min-h-11 min-w-11 rounded-full hover:bg-neutral-900 text-neutral-400 hover:text-white flex items-center justify-center"
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path
                    d="M10 11l3-3-3-3M13 8H6M6 3H3v10h3"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>
            </div>
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
                Send an NFT by link
              </h1>
              <p className="text-neutral-400 text-sm max-w-sm mx-auto">
                Sign in, mint a demo token, then text a claim link to anyone.
                No gas.
              </p>
            </div>
            <button
              onClick={login}
              className="w-full max-w-xs mx-auto rounded-xl bg-blue-600 hover:bg-blue-500 px-5 py-4 text-base font-medium min-h-[52px]"
            >
              Sign in to send
            </button>
          </div>
        ) : !smartClient ? (
          <div className="pt-16 text-center text-sm text-neutral-400">
            Preparing smart wallet...
          </div>
        ) : (
          <>
            {/* Balance chip — compact, below header */}
            <div className="flex items-center justify-between text-xs text-neutral-500 mb-4">
              <span>Your NFTs</span>
              <span className="font-mono">
                {balance !== null
                  ? `${Number(formatEther(balance)).toFixed(4)} ETH`
                  : "..."}
              </span>
            </div>

            {ownedIds.length === 0 ? (
              <div className="pt-10 pb-8 text-center space-y-5">
                <div className="space-y-1">
                  <div className="text-neutral-300 text-base">
                    No NFTs yet
                  </div>
                  <div className="text-neutral-500 text-sm">
                    Mint a demo token to get started.
                  </div>
                </div>
                <button
                  onClick={handleMint}
                  disabled={!canMint || isMinting}
                  className="w-full max-w-xs mx-auto rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 px-5 py-4 text-base font-medium min-h-[52px]"
                >
                  {isMinting ? "Minting..." : "Mint your first NFT"}
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
                        onClick={() => setActiveTokenId(id)}
                        className="group w-full text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded-xl"
                        aria-label={`Send token #${id.toString()}`}
                      >
                        <div className="relative">
                          <NFTPreview
                            contract={DEMO_NFT_ADDRESS}
                            tokenId={id}
                            size="lg"
                            className="!max-w-none transition-transform group-active:scale-[0.98]"
                          />
                        </div>
                        <div className="mt-2 flex items-center justify-between px-0.5">
                          <span className="font-mono text-xs text-neutral-400">
                            #{id.toString()}
                          </span>
                          <span className="text-[11px] text-neutral-500 group-hover:text-neutral-300">
                            Tap to send
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

            <div className="mt-10 flex items-center justify-center gap-4 text-xs text-neutral-600">
              <Link href="/sent" className="hover:text-neutral-300">
                View sent links
              </Link>
              <span className="text-neutral-800">·</span>
              <Link href="/claim" className="hover:text-neutral-300">
                Have a link? Open Claim
              </Link>
            </div>
          </>
        )}
      </div>

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
