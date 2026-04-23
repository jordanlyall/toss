"use client";

import { useEffect, useMemo, useState } from "react";
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
import { haptic } from "@/lib/haptic";
import { deriveTraits } from "@/lib/traits";

type Phase =
  | { kind: "idle" }
  | { kind: "sending"; step: string }
  | { kind: "ready"; escrowId: bigint; url: string }
  | { kind: "undoing" }
  | { kind: "error"; message: string };

const UNDO_WINDOW_MS = 5000;

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
  const [detailsOpen, setDetailsOpen] = useState(false);

  const traits = useMemo(
    () => (tokenId !== null ? deriveTraits(tokenId) : null),
    [tokenId],
  );

  const open = tokenId !== null;

  // Reset phase and details disclosure whenever a new token opens.
  useEffect(() => {
    if (tokenId !== null) {
      setPhase({ kind: "idle" });
      setDetailsOpen(false);
    }
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
    haptic.press();
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
          : "https://toss.lol";
      const url = buildClaimUrl(origin, escrowId, secret);
      onSent(tokenId);
      setPhase({ kind: "ready", escrowId, url });
      setUndoDeadline(Date.now() + UNDO_WINDOW_MS);
      haptic.success();
    } catch (err: any) {
      haptic.error();
      setPhase({
        kind: "error",
        message: err?.shortMessage || err?.message || "Send failed",
      });
    }
  }

  const [copied, setCopied] = useState(false);
  const [canNativeShare, setCanNativeShare] = useState(false);
  const [undoDeadline, setUndoDeadline] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (typeof navigator !== "undefined" && "share" in navigator) {
      setCanNativeShare(true);
    }
  }, []);

  function handleCopy(url: string) {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      void navigator.clipboard.writeText(url);
      setCopied(true);
      haptic.tap();
      setTimeout(() => setCopied(false), 1500);
    }
  }

  async function handleShare(url: string) {
    setUndoDeadline(null); // Sharing commits — drop the undo window.
    const text = "You got a Field Note. Open it here:";
    if (canNativeShare) {
      try {
        await navigator.share({ url, title: "Field Note", text });
        return;
      } catch (err: any) {
        if (err?.name === "AbortError") return;
      }
    }
    handleCopy(url);
  }

  async function handleUndo(escrowId: bigint) {
    if (!smartClient || !publicClient) return;
    haptic.press();
    setUndoDeadline(null);
    setPhase({ kind: "undoing" });
    try {
      const hash = await smartClient.sendTransaction({
        to: ESCROW_ADDRESS,
        data: encodeFunctionData({
          abi: ESCROW_ABI,
          functionName: "revoke",
          args: [escrowId],
        }),
      });
      await publicClient.waitForTransactionReceipt({ hash });
      haptic.success();
      onClose();
    } catch (err: any) {
      haptic.error();
      setPhase({
        kind: "error",
        message: err?.shortMessage || err?.message || "Could not undo",
      });
    }
  }

  // Tick once a second while the undo window is open so the countdown
  // re-renders. Stops as soon as the deadline passes.
  useEffect(() => {
    if (!undoDeadline) return;
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, [undoDeadline]);

  const undoRemaining =
    undoDeadline != null ? Math.max(0, undoDeadline - now) : 0;
  const undoActive = undoRemaining > 0 && phase.kind === "ready";
  const undoSeconds = Math.ceil(undoRemaining / 1000);

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
              {ready ? "Ready to share" : "Send this Field Note"}
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
              <div className="text-center space-y-1">
                <div className="text-[11px] uppercase tracking-[0.14em] text-neutral-500">
                  Jordan Lyall
                </div>
                <div className="text-sm text-neutral-200">
                  Note #{tokenId.toString()}, 2026
                </div>
              </div>
            ) : null}

            {phase.kind === "idle" ? (
              <button
                onClick={handleSend}
                className="w-full rounded-xl bg-blue-600 hover:bg-blue-500 px-5 py-4 text-base font-medium min-h-[52px]"
              >
                Send
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

            {phase.kind === "undoing" ? (
              <button
                disabled
                className="w-full rounded-xl bg-neutral-800 px-5 py-4 text-base font-medium min-h-[52px]"
              >
                Taking it back...
              </button>
            ) : null}

            {phase.kind === "ready" ? (
              <div className="space-y-3">
                {undoActive ? (
                  <button
                    onClick={() => handleUndo(phase.escrowId)}
                    className="w-full rounded-xl border border-neutral-800 hover:border-neutral-700 bg-neutral-950 px-4 py-3 text-sm text-neutral-200 min-h-[44px] flex items-center justify-center gap-2"
                  >
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 14 14"
                      fill="none"
                      aria-hidden="true"
                    >
                      <path
                        d="M4 3L1 6l3 3M1 6h8a3 3 0 010 6H7"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                    <span>Undo</span>
                    <span className="text-neutral-500">· {undoSeconds}s</span>
                  </button>
                ) : (
                  <input
                    readOnly
                    value={phase.url}
                    onFocus={(e) => e.currentTarget.select()}
                    className="w-full rounded-lg bg-black border border-neutral-800 px-3 py-3 font-mono text-xs"
                  />
                )}
                <button
                  onClick={() => handleShare(phase.url)}
                  className="w-full rounded-xl bg-blue-600 hover:bg-blue-500 px-5 py-4 text-base font-medium min-h-[52px] flex items-center justify-center gap-2"
                >
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 16 16"
                    fill="none"
                    aria-hidden="true"
                  >
                    <path
                      d="M8 2v8M5 5l3-3 3 3M3 10v3a1 1 0 001 1h8a1 1 0 001-1v-3"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                  {canNativeShare ? "Share" : "Copy link"}
                </button>
                {canNativeShare && !undoActive ? (
                  <button
                    onClick={() => handleCopy(phase.url)}
                    className="w-full rounded-xl border border-neutral-800 hover:border-neutral-700 px-4 py-3 text-sm text-neutral-300 hover:text-white min-h-[44px]"
                  >
                    {copied ? "Copied" : "Copy link"}
                  </button>
                ) : null}
                <button
                  onClick={onClose}
                  className="w-full rounded-xl px-4 py-2 text-xs text-neutral-500 hover:text-neutral-300"
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

            {traits ? (
              <div className="-mx-5 -mb-6 pt-2 border-t border-neutral-900">
                <button
                  type="button"
                  onClick={() => setDetailsOpen((v) => !v)}
                  aria-expanded={detailsOpen}
                  className="w-full px-5 py-3 text-center text-xs uppercase tracking-[0.14em] text-neutral-500 hover:text-neutral-300 min-h-11"
                >
                  {detailsOpen ? "Hide details" : "Details"}
                </button>
                {detailsOpen ? (
                  <dl className="px-5 pb-5 pt-1 space-y-2 text-sm">
                    <div className="flex justify-between items-baseline">
                      <dt className="text-neutral-500">Palette</dt>
                      <dd className="text-neutral-200">{traits.palette}</dd>
                    </div>
                    <div className="flex justify-between items-baseline">
                      <dt className="text-neutral-500">Grid</dt>
                      <dd className="text-neutral-200">
                        {traits.gridSize} × {traits.gridSize}
                      </dd>
                    </div>
                    <div className="flex justify-between items-baseline">
                      <dt className="text-neutral-500">Chain</dt>
                      <dd className="text-neutral-200">Base</dd>
                    </div>
                  </dl>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
