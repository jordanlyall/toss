"use client";

import { useEffect, useMemo, useState } from "react";
import { usePrivy, useSendTransaction, useWallets } from "@privy-io/react-auth";
import { usePublicClient } from "wagmi";
import { baseSepolia } from "wagmi/chains";
import { encodeFunctionData } from "viem";
import Link from "next/link";
import { ESCROW_ABI, ESCROW_ADDRESS } from "@/lib/contracts";
import { parseClaimFragment } from "@/lib/claim";

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
  | { kind: "claimed"; txHash: `0x${string}` }
  | { kind: "error"; message: string };

const BASESCAN = "https://sepolia.basescan.org";

function shorten(addr: string): string {
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

export default function ClaimPage() {
  const { ready, authenticated, login } = usePrivy();
  const { wallets } = useWallets();
  const { sendTransaction } = useSendTransaction();
  const publicClient = usePublicClient({ chainId: baseSepolia.id });

  const embeddedWallet = wallets.find((w) => w.walletClientType === "privy");
  const address = embeddedWallet?.address ?? wallets[0]?.address;

  const [parsed, setParsed] = useState<Parsed | null>(null);
  const [fragmentRead, setFragmentRead] = useState(false);
  const [escrow, setEscrow] = useState<EscrowData | null>(null);
  const [escrowErr, setEscrowErr] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>({ kind: "idle" });

  useEffect(() => {
    if (typeof window === "undefined") return;
    const result = parseClaimFragment(window.location.hash);
    setParsed(result);
    setFragmentRead(true);
  }, []);

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
          setEscrowErr(err?.shortMessage || err?.message || "Lookup failed");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [parsed, publicClient]);

  const now = Math.floor(Date.now() / 1000);
  const expired = escrow ? Number(escrow.expiresAt) < now : false;
  const settled = escrow?.settled ?? false;
  const claimable = !!escrow && !expired && !settled;

  async function handleClaim() {
    if (!publicClient || !parsed) return;
    setStatus({ kind: "claiming" });
    try {
      const { hash } = await sendTransaction(
        {
          to: ESCROW_ADDRESS,
          data: encodeFunctionData({
            abi: ESCROW_ABI,
            functionName: "claim",
            args: [parsed.id, parsed.secret],
          }),
          chainId: baseSepolia.id,
        },
        { sponsor: true },
      );
      await publicClient.waitForTransactionReceipt({ hash });
      setStatus({ kind: "claimed", txHash: hash });
    } catch (err: any) {
      setStatus({
        kind: "error",
        message: err?.shortMessage || err?.message || "Claim failed",
      });
    }
  }

  const nftLink = useMemo(() => {
    if (!escrow) return null;
    return `${BASESCAN}/token/${escrow.nftContract}?a=${escrow.tokenId.toString()}`;
  }, [escrow]);

  if (!ready || !fragmentRead) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <div className="text-neutral-500 text-sm">Loading...</div>
      </main>
    );
  }

  return (
    <main className="min-h-screen px-6 py-10 max-w-xl mx-auto">
      <nav className="flex items-center justify-between mb-10">
        <Link href="/" className="text-sm text-neutral-400 hover:text-white">
          Toss
        </Link>
        <Link href="/send" className="text-sm text-neutral-400 hover:text-white">
          Send
        </Link>
      </nav>

      {!parsed ? (
        <div className="text-center">
          <h1 className="text-2xl font-semibold mb-3">Invalid claim link</h1>
          <p className="text-neutral-400 text-sm">
            This link is missing an id or secret. Ask the sender to resend.
          </p>
        </div>
      ) : !ESCROW_ADDRESS ? (
        <div className="rounded-lg border border-amber-900 bg-amber-950/30 px-4 py-3 text-sm text-amber-200">
          Contracts not deployed yet.
        </div>
      ) : (
        <>
          <h1 className="text-3xl font-semibold tracking-tight mb-6">
            You got an NFT
          </h1>

          <section className="rounded-lg border border-neutral-800 p-4 mb-6 space-y-2 text-sm">
            {escrow ? (
              <>
                <Row label="Escrow" value={`#${parsed.id.toString()}`} />
                <Row label="Contract" value={shorten(escrow.nftContract)} />
                <Row label="Token ID" value={`#${escrow.tokenId.toString()}`} />
                <Row label="From" value={shorten(escrow.sender)} />
                <Row
                  label="Status"
                  value={
                    settled
                      ? "Already claimed or revoked"
                      : expired
                        ? "Expired"
                        : "Ready"
                  }
                />
                {nftLink ? (
                  <a
                    href={nftLink}
                    target="_blank"
                    rel="noreferrer"
                    className="block text-blue-400 hover:text-blue-300 text-xs pt-1"
                  >
                    View on Basescan
                  </a>
                ) : null}
              </>
            ) : escrowErr ? (
              <div className="text-red-300">{escrowErr}</div>
            ) : (
              <div className="text-neutral-500">Looking up escrow...</div>
            )}
          </section>

          {status.kind === "claimed" ? (
            <div className="rounded-lg border border-emerald-900 bg-emerald-950/30 p-5 space-y-3">
              <div className="text-lg font-semibold text-emerald-100">
                You own it.
              </div>
              <div className="text-sm text-emerald-200">
                The NFT is in your wallet. No gas paid.
              </div>
              <div className="flex gap-3 text-sm pt-1">
                <a
                  href={`${BASESCAN}/tx/${status.txHash}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-blue-400 hover:text-blue-300"
                >
                  View transaction
                </a>
                <Link href="/" className="text-neutral-300 hover:text-white">
                  Back home
                </Link>
              </div>
            </div>
          ) : !authenticated ? (
            <button
              onClick={login}
              disabled={!claimable}
              className="w-full rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 px-5 py-4 text-base font-medium"
            >
              Sign in to claim
            </button>
          ) : !address ? (
            <div className="text-sm text-neutral-400 text-center">
              Preparing wallet...
            </div>
          ) : (
            <button
              onClick={handleClaim}
              disabled={!claimable || status.kind === "claiming"}
              className="w-full rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 px-5 py-4 text-base font-medium"
            >
              {status.kind === "claiming"
                ? "Claiming..."
                : settled
                  ? "Unavailable"
                  : expired
                    ? "Expired"
                    : "Claim this NFT"}
            </button>
          )}

          {status.kind === "error" ? (
            <div className="mt-4 rounded-lg border border-red-900 bg-red-950/30 px-4 py-3 text-sm text-red-200">
              {status.message}
            </div>
          ) : null}
        </>
      )}
    </main>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-neutral-400">{label}</span>
      <span className="font-mono">{value}</span>
    </div>
  );
}
