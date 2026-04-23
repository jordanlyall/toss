"use client";

import { useEffect, useState } from "react";
import { usePrivy } from "@privy-io/react-auth";
import { useSmartWallets } from "@privy-io/react-auth/smart-wallets";
import { usePublicClient } from "wagmi";
import { baseSepolia } from "wagmi/chains";
import { encodeFunctionData } from "viem";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { ESCROW_ABI, ESCROW_ADDRESS } from "@/lib/contracts";
import { parseEscrowId, parseSecretFragment } from "@/lib/claim";
import { NFTPreview } from "@/app/components/NFTPreview";
import { haptic } from "@/lib/haptic";

type Parsed = { id: bigint; secret: `0x${string}` };

type EscrowData = {
  sender: `0x${string}`;
  nftContract: `0x${string}`;
  tokenId: bigint;
  secretHash: `0x${string}`;
  expiresAt: bigint;
  settled: boolean;
};

type Status =
  | { kind: "idle" }
  | { kind: "claiming" }
  | { kind: "claimed" }
  | { kind: "error"; message: string };

type ClaimClientProps = {
  senderName?: string | null;
};

export default function ClaimClient({ senderName }: ClaimClientProps = {}) {
  const { ready, authenticated, login } = usePrivy();
  const { client: smartClient } = useSmartWallets();
  const publicClient = usePublicClient({ chainId: baseSepolia.id });
  const searchParams = useSearchParams();
  const params = useParams();
  const routeId =
    typeof params?.id === "string" ? (params.id as string) : null;

  const [parsed, setParsed] = useState<Parsed | null>(null);
  const [fragmentRead, setFragmentRead] = useState(false);
  const [escrow, setEscrow] = useState<EscrowData | null>(null);
  const [escrowErr, setEscrowErr] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>({ kind: "idle" });

  useEffect(() => {
    if (typeof window === "undefined") return;
    const id = parseEscrowId(routeId ?? searchParams.get("id"));
    const secret = parseSecretFragment(window.location.hash);
    if (id !== null && secret) {
      setParsed({ id, secret });
    } else {
      setParsed(null);
    }
    setFragmentRead(true);
  }, [routeId, searchParams]);

  useEffect(() => {
    if (!parsed || !publicClient || !ESCROW_ADDRESS) return;
    let cancelled = false;
    (async () => {
      try {
        const data = (await publicClient.readContract({
          address: ESCROW_ADDRESS,
          abi: ESCROW_ABI,
          functionName: "getEscrow",
          args: [parsed.id],
        })) as EscrowData;
        if (!cancelled) setEscrow(data);
      } catch (err: any) {
        if (!cancelled)
          setEscrowErr(err?.shortMessage || err?.message || "Could not load");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [parsed, publicClient]);

  const now = Math.floor(Date.now() / 1000);
  const expired = escrow ? Number(escrow.expiresAt) < now : false;
  const settled = escrow?.settled ?? false;
  const openable = !!escrow && !expired && !settled;

  async function handleClaim() {
    if (!smartClient || !publicClient || !parsed) return;
    haptic.press();
    setStatus({ kind: "claiming" });
    try {
      const hash = await smartClient.sendTransaction({
        to: ESCROW_ADDRESS,
        data: encodeFunctionData({
          abi: ESCROW_ABI,
          functionName: "claim",
          args: [parsed.id, parsed.secret],
        }),
      });
      await publicClient.waitForTransactionReceipt({ hash });
      setStatus({ kind: "claimed" });
      haptic.success();
    } catch (err: any) {
      haptic.error();
      setStatus({
        kind: "error",
        message: err?.shortMessage || err?.message || "Something went wrong",
      });
    }
  }

  if (!ready || !fragmentRead) {
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
            Field Notes
          </Link>
          <Link
            href="/collection"
            className="text-sm text-neutral-400 hover:text-white"
          >
            Send one
          </Link>
        </div>
      </header>

      <div className="max-w-md mx-auto px-4 pt-8">
        {!parsed ? (
          <div className="pt-10 text-center space-y-2">
            <h1 className="text-2xl font-semibold tracking-tight">
              This link is incomplete
            </h1>
            <p className="text-neutral-400 text-sm max-w-sm mx-auto">
              Ask the sender to resend it.
            </p>
          </div>
        ) : !ESCROW_ADDRESS ? (
          <div className="rounded-lg border border-amber-900 bg-amber-950/30 px-4 py-3 text-sm text-amber-200">
            Not ready yet. Check back in a minute.
          </div>
        ) : (
          <div className="space-y-6">
            <div className="text-center space-y-1">
              <h1 className="text-3xl font-semibold tracking-tight">
                {status.kind === "claimed"
                  ? "It's yours"
                  : settled
                    ? "Already opened"
                    : expired
                      ? "Link expired"
                      : "You got a Field Note"}
              </h1>
              {senderName && !settled && !expired ? (
                <p className="text-neutral-300 text-sm">
                  From {senderName}
                </p>
              ) : null}
              {status.kind === "claimed" ? (
                <p className="text-neutral-400 text-sm">
                  Saved to your collection.
                </p>
              ) : settled ? (
                <p className="text-neutral-400 text-sm">
                  Someone already opened this one.
                </p>
              ) : expired ? (
                <p className="text-neutral-400 text-sm">
                  Ask the sender for a fresh link.
                </p>
              ) : (
                <p className="text-neutral-400 text-sm">
                  Open to keep it.
                </p>
              )}
            </div>

            {escrow ? (
              <div className="flex justify-center">
                <div className="w-full max-w-[300px]">
                  <NFTPreview
                    contract={escrow.nftContract}
                    tokenId={escrow.tokenId}
                    size="lg"
                    className="!max-w-none"
                  />
                </div>
              </div>
            ) : escrowErr ? (
              <div className="rounded-lg border border-red-900 bg-red-950/30 px-4 py-3 text-sm text-red-200">
                {escrowErr}
              </div>
            ) : (
              <div className="aspect-square w-full max-w-[300px] mx-auto rounded-xl border border-neutral-800 bg-neutral-950 animate-pulse" />
            )}

            {status.kind === "claimed" ? (
              <div className="space-y-3">
                <Link
                  href="/collection"
                  className="block w-full text-center rounded-xl bg-blue-600 hover:bg-blue-500 px-5 py-4 text-base font-medium min-h-[52px] flex items-center justify-center"
                >
                  See your collection
                </Link>
              </div>
            ) : !authenticated ? (
              <button
                onClick={login}
                disabled={!openable}
                className="w-full rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 px-5 py-4 text-base font-medium min-h-[52px]"
              >
                {settled
                  ? "Already opened"
                  : expired
                    ? "Expired"
                    : "Sign in to open"}
              </button>
            ) : !smartClient ? (
              <div className="text-sm text-neutral-400 text-center py-2">
                Getting things ready...
              </div>
            ) : (
              <button
                onClick={handleClaim}
                disabled={!openable || status.kind === "claiming"}
                className="w-full rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 px-5 py-4 text-base font-medium min-h-[52px]"
              >
                {status.kind === "claiming"
                  ? "Opening..."
                  : settled
                    ? "Already opened"
                    : expired
                      ? "Expired"
                      : "Open"}
              </button>
            )}

            {status.kind === "error" ? (
              <div className="rounded-lg border border-red-900 bg-red-950/30 px-4 py-3 text-sm text-red-200">
                {status.message}
              </div>
            ) : null}
          </div>
        )}
      </div>
    </main>
  );
}
