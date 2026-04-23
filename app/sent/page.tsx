"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { usePrivy } from "@privy-io/react-auth";
import { useSmartWallets } from "@privy-io/react-auth/smart-wallets";
import { usePublicClient } from "wagmi";
import { baseSepolia } from "wagmi/chains";
import { encodeFunctionData, type Address } from "viem";
import { ESCROW_ABI, ESCROW_ADDRESS } from "@/lib/contracts";
import { loadSentClaims, formatExpiry, type SentClaim } from "@/lib/sent";
import { NFTPreview } from "@/app/components/NFTPreview";

function StatusPill({ status }: { status: SentClaim["status"] }) {
  const map: Record<SentClaim["status"], string> = {
    pending:
      "bg-blue-950/60 text-blue-300 border-blue-900",
    claimed:
      "bg-emerald-950/60 text-emerald-300 border-emerald-900",
    expired:
      "bg-neutral-900 text-neutral-400 border-neutral-800",
    revoked:
      "bg-neutral-900 text-neutral-400 border-neutral-800",
  };
  const label = {
    pending: "Sent",
    claimed: "Opened",
    expired: "Expired",
    revoked: "Returned",
  }[status];
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full border text-[11px] font-medium ${map[status]}`}
    >
      {label}
    </span>
  );
}

function shortenAddr(addr: string | null | undefined): string {
  if (!addr) return "";
  return `${addr.slice(0, 4)}..${addr.slice(-4)}`;
}

export default function SentPage() {
  const { ready, authenticated, login, logout } = usePrivy();
  const { client: smartClient } = useSmartWallets();
  const publicClient = usePublicClient({ chainId: baseSepolia.id });

  const address = smartClient?.account?.address as Address | undefined;

  const [claims, setClaims] = useState<SentClaim[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [revoking, setRevoking] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!publicClient || !address) return;
    try {
      setError(null);
      const list = await loadSentClaims(publicClient, address);
      setClaims(list);
    } catch (err: any) {
      setError(err?.shortMessage || err?.message || "Could not load your Tosses");
      setClaims([]);
    }
  }, [publicClient, address]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function handleRevoke(id: bigint) {
    if (!smartClient || !publicClient) return;
    setRevoking(id.toString());
    try {
      const hash = await smartClient.sendTransaction({
        to: ESCROW_ADDRESS,
        data: encodeFunctionData({
          abi: ESCROW_ABI,
          functionName: "revoke",
          args: [id],
        }),
      });
      await publicClient.waitForTransactionReceipt({ hash });
      await refresh();
    } catch (err: any) {
      setError(err?.shortMessage || err?.message || "Could not take it back");
    } finally {
      setRevoking(null);
    }
  }

  if (!ready) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <div className="text-neutral-500 text-sm">Loading...</div>
      </main>
    );
  }

  return (
    <main className="min-h-screen pb-20">
      <header className="sticky top-0 z-20 bg-black/80 backdrop-blur border-b border-neutral-900">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link
            href="/"
            className="text-base font-semibold tracking-tight text-white"
          >
            Toss
          </Link>
          <nav className="flex items-center gap-1 text-sm">
            <Link
              href="/send"
              className="min-h-11 px-3 rounded-full hover:bg-neutral-900 text-neutral-400 hover:text-white flex items-center"
            >
              Send
            </Link>
            <span className="min-h-11 px-3 rounded-full bg-neutral-900 text-white flex items-center">
              Sent
            </span>
            {authenticated ? (
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
            ) : null}
          </nav>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-4 pt-6">
        {!ESCROW_ADDRESS ? (
          <div className="rounded-lg border border-amber-900 bg-amber-950/30 px-4 py-3 text-sm text-amber-200">
            Contracts not deployed.
          </div>
        ) : !authenticated ? (
          <div className="pt-16 pb-8 text-center space-y-6">
            <div className="space-y-2">
              <h1 className="text-2xl font-semibold tracking-tight">
                Your sent Tosses
              </h1>
              <p className="text-neutral-400 text-sm max-w-sm mx-auto">
                Sign in to see what you've sent and what's been opened.
              </p>
            </div>
            <button
              onClick={login}
              className="w-full max-w-xs mx-auto rounded-xl bg-blue-600 hover:bg-blue-500 px-5 py-4 text-base font-medium min-h-[52px]"
            >
              Sign in
            </button>
          </div>
        ) : claims === null ? (
          <div className="pt-10 text-center text-sm text-neutral-400">
            Loading...
          </div>
        ) : claims.length === 0 ? (
          <div className="pt-10 pb-8 text-center space-y-5">
            <div className="space-y-1">
              <div className="text-neutral-300 text-base">Nothing sent yet</div>
              <div className="text-neutral-500 text-sm">
                Tosses you send will appear here.
              </div>
            </div>
            <Link
              href="/send"
              className="inline-block rounded-xl bg-blue-600 hover:bg-blue-500 px-5 py-3 text-sm font-medium min-h-[44px]"
            >
              Send a Toss
            </Link>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between text-xs text-neutral-500 mb-4">
              <span>
                {claims.length} sent
              </span>
              <button
                onClick={() => void refresh()}
                className="text-neutral-400 hover:text-white"
              >
                Refresh
              </button>
            </div>
            <ul className="space-y-3">
              {claims.map((c) => {
                const isRevoking = revoking === c.id.toString();
                return (
                  <li
                    key={c.id.toString()}
                    className="rounded-xl border border-neutral-800 bg-neutral-950 p-3 flex items-center gap-3"
                  >
                    <div className="w-16 h-16 flex-shrink-0">
                      <NFTPreview
                        contract={c.nftContract}
                        tokenId={c.tokenId}
                        size="lg"
                        className="!max-w-none"
                      />
                    </div>
                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-sm">
                          #{c.tokenId.toString()}
                        </span>
                        <StatusPill status={c.status} />
                      </div>
                      <div className="text-xs text-neutral-500">
                        {c.status === "pending"
                          ? formatExpiry(c.expiresAt)
                          : c.status === "claimed" && c.recipient
                            ? `by ${shortenAddr(c.recipient)}`
                            : c.status === "expired"
                              ? "Link no longer valid"
                              : "Back in your collection"}
                      </div>
                    </div>
                    {c.status === "pending" ? (
                      <button
                        onClick={() => void handleRevoke(c.id)}
                        disabled={isRevoking}
                        className="rounded-md border border-neutral-800 hover:border-neutral-600 disabled:opacity-50 px-3 py-1.5 text-xs text-neutral-300 min-h-11"
                      >
                        {isRevoking ? "Returning..." : "Take back"}
                      </button>
                    ) : null}
                  </li>
                );
              })}
            </ul>

            {error ? (
              <div className="mt-4 rounded-lg border border-red-900 bg-red-950/30 px-4 py-3 text-sm text-red-200">
                {error}
              </div>
            ) : null}
          </>
        )}

        <div className="mt-10 text-center text-xs text-neutral-600">
          <Link href="/send" className="hover:text-neutral-300">
            Send another
          </Link>
        </div>
      </div>
    </main>
  );
}
