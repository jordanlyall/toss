"use client";

import { useEffect, useState } from "react";
import { useSmartWallets } from "@privy-io/react-auth/smart-wallets";
import { usePublicClient } from "wagmi";
import { baseSepolia } from "wagmi/chains";
import {
  decodeEventLog,
  encodeFunctionData,
  type Address,
} from "viem";
import {
  DEMO_NFT_ABI,
  DEMO_NFT_ADDRESS,
  ESCROW_ABI,
  ESCROW_ADDRESS,
} from "@/lib/contracts";
import {
  buildClaimUrl,
  defaultExpiry,
  generateSecret,
  hashSecret,
} from "@/lib/claim";
import { NFTPreview } from "@/app/components/NFTPreview";

type Phase =
  | { kind: "idle" }
  | { kind: "sending"; step: string }
  | { kind: "ready"; escrowId: bigint; url: string }
  | { kind: "error"; message: string };

type Props = {
  tokenId: bigint | null;
  onClose: () => void;
  onSent: (tokenId: bigint) => void;
};

export function SendSheet({ tokenId, onClose, onSent }: Props) {
  const { client: smartClient } = useSmartWallets();
  const publicClient = usePublicClient({ chainId: baseSepolia.id });
  const address = smartClient?.account?.address as Address | undefined;

  const [phase, setPhase] = useState<Phase>({ kind: "idle" });
  const [mounted, setMounted] = useState(false);

  const open = tokenId !== null;

  // Reset phase whenever a new token opens.
  useEffect(() => {
    if (tokenId !== null) setPhase({ kind: "idle" });
  }, [tokenId]);

  // Animate in/out: mount as soon as a token is selected, keep mounted
  // briefly while closing so the slide-down transition can run.
  useEffect(() => {
    if (open) {
      setMounted(true);
      return;
    }
    if (!mounted) return;
    const t = setTimeout(() => setMounted(false), 200);
    return () => clearTimeout(t);
  }, [open, mounted]);

  // Lock body scroll while open.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  async function handleSend() {
    if (!smartClient || !publicClient || !address || tokenId === null) return;
    try {
      setPhase({ kind: "sending", step: "Checking approval" });
      const approved = (await publicClient.readContract({
        address: DEMO_NFT_ADDRESS,
        abi: DEMO_NFT_ABI,
        functionName: "isApprovedForAll",
        args: [address, ESCROW_ADDRESS],
      })) as boolean;

      if (!approved) {
        setPhase({ kind: "sending", step: "Approving escrow" });
        const approveHash = await smartClient.sendTransaction({
          to: DEMO_NFT_ADDRESS,
          data: encodeFunctionData({
            abi: DEMO_NFT_ABI,
            functionName: "setApprovalForAll",
            args: [ESCROW_ADDRESS, true],
          }),
        });
        await publicClient.waitForTransactionReceipt({ hash: approveHash });
      }

      setPhase({ kind: "sending", step: "Creating link" });
      const secret = generateSecret();
      const secretHash = hashSecret(secret);
      const expiresAt = defaultExpiry();

      const depositHash = await smartClient.sendTransaction({
        to: ESCROW_ADDRESS,
        data: encodeFunctionData({
          abi: ESCROW_ABI,
          functionName: "deposit",
          args: [DEMO_NFT_ADDRESS, tokenId, secretHash, expiresAt],
        }),
      });
      const receipt = await publicClient.waitForTransactionReceipt({
        hash: depositHash,
      });

      let escrowId: bigint | null = null;
      for (const log of receipt.logs) {
        if (log.address.toLowerCase() !== ESCROW_ADDRESS.toLowerCase())
          continue;
        try {
          const decoded = decodeEventLog({
            abi: ESCROW_ABI,
            data: log.data,
            topics: log.topics,
          });
          if (decoded.eventName === "Deposited") {
            escrowId = (decoded.args as any).id as bigint;
            break;
          }
        } catch {}
      }
      if (escrowId === null) throw new Error("Deposited event not found");

      const origin =
        typeof window !== "undefined"
          ? window.location.origin
          : "https://toss.app";
      const url = buildClaimUrl(origin, escrowId, secret);
      onSent(tokenId);
      setPhase({ kind: "ready", escrowId, url });
    } catch (err: any) {
      setPhase({
        kind: "error",
        message: err?.shortMessage || err?.message || "Send failed",
      });
    }
  }

  function handleCopy(url: string) {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      void navigator.clipboard.writeText(url);
    }
  }

  if (!mounted) return null;

  const sending = phase.kind === "sending";
  const ready = phase.kind === "ready";

  return (
    <div
      className={`fixed inset-0 z-50 transition-opacity duration-200 ${
        open ? "opacity-100" : "opacity-0 pointer-events-none"
      }`}
      aria-hidden={!open}
    >
      <button
        type="button"
        aria-label="Close"
        onClick={sending ? undefined : onClose}
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
      />
      <div
        className={`absolute inset-x-0 bottom-0 sm:inset-0 sm:flex sm:items-center sm:justify-center pointer-events-none`}
      >
        <div
          className={`pointer-events-auto bg-neutral-950 border-t border-neutral-800 sm:border sm:rounded-2xl rounded-t-2xl w-full sm:max-w-md shadow-2xl transform transition-transform duration-200 ${
            open ? "translate-y-0" : "translate-y-full sm:translate-y-4"
          }`}
        >
          <div className="flex items-center justify-between px-5 pt-4 pb-2">
            <div className="w-10 h-1 rounded-full bg-neutral-800 mx-auto sm:hidden" />
            <div className="hidden sm:block text-sm text-neutral-400">
              {ready ? "Ready to share" : "Send this NFT"}
            </div>
            <button
              onClick={onClose}
              disabled={sending}
              aria-label="Close"
              className="hidden sm:flex w-8 h-8 items-center justify-center rounded-full hover:bg-neutral-900 text-neutral-400 hover:text-white disabled:opacity-30"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path
                  d="M4 4l8 8M12 4l-8 8"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                />
              </svg>
            </button>
          </div>

          <div className="px-5 pb-6 pt-2 space-y-5">
            {tokenId !== null ? (
              <div className="flex justify-center">
                <div className="w-full max-w-[260px]">
                  <NFTPreview
                    contract={DEMO_NFT_ADDRESS}
                    tokenId={tokenId}
                    size="lg"
                  />
                </div>
              </div>
            ) : null}

            {tokenId !== null ? (
              <div className="text-center">
                <div className="font-mono text-sm text-neutral-400">
                  Token #{tokenId.toString()}
                </div>
              </div>
            ) : null}

            {phase.kind === "idle" ? (
              <button
                onClick={handleSend}
                className="w-full rounded-xl bg-blue-600 hover:bg-blue-500 px-5 py-4 text-base font-medium min-h-[52px]"
              >
                Send it
              </button>
            ) : null}

            {phase.kind === "sending" ? (
              <button
                disabled
                className="w-full rounded-xl bg-blue-600/60 px-5 py-4 text-base font-medium min-h-[52px]"
              >
                {phase.step}...
              </button>
            ) : null}

            {phase.kind === "ready" ? (
              <div className="space-y-3">
                <input
                  readOnly
                  value={phase.url}
                  onFocus={(e) => e.currentTarget.select()}
                  className="w-full rounded-lg bg-black border border-neutral-800 px-3 py-3 font-mono text-xs"
                />
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => handleCopy(phase.url)}
                    className="rounded-xl bg-white text-black px-4 py-3.5 text-sm font-medium min-h-[48px]"
                  >
                    Copy link
                  </button>
                  <a
                    href={`sms:&body=${encodeURIComponent(
                      `You got an NFT. Claim it here: ${phase.url}`,
                    )}`}
                    className="rounded-xl bg-blue-600 hover:bg-blue-500 px-4 py-3.5 text-sm font-medium min-h-[48px] flex items-center justify-center"
                  >
                    Share
                  </a>
                </div>
                <button
                  onClick={onClose}
                  className="w-full rounded-xl border border-neutral-800 hover:border-neutral-700 px-4 py-3 text-sm text-neutral-400 hover:text-white"
                >
                  Done
                </button>
              </div>
            ) : null}

            {phase.kind === "error" ? (
              <div className="space-y-3">
                <div className="rounded-lg border border-red-900 bg-red-950/30 px-4 py-3 text-sm text-red-200">
                  {phase.message}
                </div>
                <button
                  onClick={() => setPhase({ kind: "idle" })}
                  className="w-full rounded-xl border border-neutral-800 hover:border-neutral-700 px-5 py-3 text-sm"
                >
                  Try again
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
