"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { usePrivy } from "@privy-io/react-auth";
import { useSmartWallets } from "@privy-io/react-auth/smart-wallets";
import { usePublicClient } from "wagmi";
import { baseSepolia } from "wagmi/chains";
import { decodeEventLog, encodeFunctionData, type Address } from "viem";
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

type DemoStep =
  | "idle"
  | "minting"
  | "approving"
  | "depositing"
  | "sent"
  | "claiming"
  | "claimed"
  | "error";

type DemoState = {
  step: DemoStep;
  tokenId?: bigint;
  escrowId?: bigint;
  url?: string;
  secret?: `0x${string}`;
  error?: string;
};

const REPO_URL = "https://github.com/jordanlyall/toss";

export default function Landing() {
  const { ready, authenticated, login } = usePrivy();
  const { client: smartClient } = useSmartWallets();
  const publicClient = usePublicClient({ chainId: baseSepolia.id });
  const address = smartClient?.account?.address as Address | undefined;

  const [state, setState] = useState<DemoState>({ step: "idle" });

  const deployed = !!ESCROW_ADDRESS && !!DEMO_NFT_ADDRESS;

  async function runSend() {
    if (!smartClient || !publicClient || !address) return;
    try {
      setState({ step: "minting" });
      const mintHash = await smartClient.sendTransaction({
        to: DEMO_NFT_ADDRESS,
        data: encodeFunctionData({
          abi: DEMO_NFT_ABI,
          functionName: "mint",
          args: [],
        }),
      });
      const mintReceipt = await publicClient.waitForTransactionReceipt({
        hash: mintHash,
      });
      let tokenId: bigint | null = null;
      const transferTopic =
        "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";
      for (const log of mintReceipt.logs) {
        if (log.address.toLowerCase() !== DEMO_NFT_ADDRESS.toLowerCase())
          continue;
        if (log.topics[0] !== transferTopic) continue;
        if (log.topics.length < 4) continue;
        const to = ("0x" + log.topics[2]!.slice(-40)).toLowerCase();
        if (to !== address.toLowerCase()) continue;
        tokenId = BigInt(log.topics[3]!);
        break;
      }
      if (tokenId === null) throw new Error("Could not confirm the new Toss");

      const approved = (await publicClient.readContract({
        address: DEMO_NFT_ADDRESS,
        abi: DEMO_NFT_ABI,
        functionName: "isApprovedForAll",
        args: [address, ESCROW_ADDRESS],
      })) as boolean;

      if (!approved) {
        setState({ step: "approving", tokenId });
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

      setState({ step: "depositing", tokenId });
      const secret = generateSecret();
      const secretHash = hashSecret(secret);
      const depositHash = await smartClient.sendTransaction({
        to: ESCROW_ADDRESS,
        data: encodeFunctionData({
          abi: ESCROW_ABI,
          functionName: "deposit",
          args: [DEMO_NFT_ADDRESS, tokenId, secretHash, defaultExpiry()],
        }),
      });
      const depositReceipt = await publicClient.waitForTransactionReceipt({
        hash: depositHash,
      });
      let escrowId: bigint | null = null;
      for (const log of depositReceipt.logs) {
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
      setState({ step: "sent", tokenId, escrowId, url, secret });
    } catch (err: any) {
      setState({ step: "error", error: err?.shortMessage || err?.message });
    }
  }

  async function runClaim() {
    if (
      !smartClient ||
      !publicClient ||
      state.escrowId === undefined ||
      !state.secret
    )
      return;
    try {
      setState((s) => ({ ...s, step: "claiming" }));
      const hash = await smartClient.sendTransaction({
        to: ESCROW_ADDRESS,
        data: encodeFunctionData({
          abi: ESCROW_ABI,
          functionName: "claim",
          args: [state.escrowId, state.secret],
        }),
      });
      await publicClient.waitForTransactionReceipt({ hash });
      setState((s) => ({ ...s, step: "claimed" }));
    } catch (err: any) {
      setState((s) => ({
        ...s,
        step: "error",
        error: err?.shortMessage || err?.message,
      }));
    }
  }

  const senderLabel = useMemo(() => {
    switch (state.step) {
      case "minting":
        return "Making a Toss...";
      case "approving":
        return "Getting ready...";
      case "depositing":
        return "Sealing the link...";
      case "sent":
      case "claiming":
      case "claimed":
        return "Link sent";
      default:
        return "Tap to send one";
    }
  }, [state.step]);

  const recipientLabel = useMemo(() => {
    if (state.step === "claimed") return "It's yours";
    if (state.step === "claiming") return "Opening...";
    if (state.step === "sent") return "Tap to open";
    return "Waiting for a link";
  }, [state.step]);

  const showBubble =
    state.step === "sent" ||
    state.step === "claiming" ||
    state.step === "claimed";

  return (
    <main className="min-h-screen">
      <header className="max-w-6xl mx-auto px-6 pt-6 flex items-center justify-between">
        <span className="text-sm tracking-tight font-semibold">Toss</span>
        <nav className="flex items-center gap-5 text-sm text-neutral-400">
          <Link href="/collection" className="hover:text-white">
            Collection
          </Link>
          <Link href="/sent" className="hover:text-white">
            Sent
          </Link>
          <a
            href={REPO_URL}
            target="_blank"
            rel="noreferrer"
            className="hover:text-white"
          >
            GitHub
          </a>
        </nav>
      </header>

      <section className="max-w-6xl mx-auto px-6 pt-20 pb-10 text-center">
        <h1 className="text-5xl md:text-6xl font-semibold tracking-tight mb-4">
          Text a link. Tap. Keep it.
        </h1>
        <p className="text-neutral-400 text-lg max-w-xl mx-auto">
          Send a Toss to anyone with just a link. Free. No app. Sign in with
          email or phone to keep what you got.
        </p>
      </section>

      <section className="max-w-6xl mx-auto px-6 pb-16">
        <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] gap-6 md:gap-8 items-center">
          <Phone
            role="Sender"
            label={senderLabel}
            state={state}
            side="sender"
            onPrimary={
              !authenticated
                ? () => login()
                : deployed && smartClient
                  ? runSend
                  : undefined
            }
            primaryLabel={
              !authenticated
                ? "Sign in"
                : !smartClient
                  ? "Getting ready..."
                  : state.step === "idle"
                    ? "Send a Toss"
                    : state.step === "error"
                      ? "Try again"
                      : state.step === "sent" || state.step === "claimed"
                        ? "Start over"
                        : "Working..."
            }
            primaryBusy={
              state.step === "minting" ||
              state.step === "approving" ||
              state.step === "depositing"
            }
            onReset={
              state.step === "sent" ||
              state.step === "claimed" ||
              state.step === "error"
                ? () => setState({ step: "idle" })
                : undefined
            }
            ready={ready && deployed}
          />

          <Thread
            show={showBubble}
            url={state.url}
            claimed={state.step === "claimed"}
          />

          <Phone
            role="Recipient"
            label={recipientLabel}
            state={state}
            side="recipient"
            onPrimary={state.step === "sent" && smartClient ? runClaim : undefined}
            primaryLabel={
              state.step === "claimed"
                ? "Opened"
                : state.step === "claiming"
                  ? "Opening..."
                  : state.step === "sent"
                    ? "Open"
                    : "Waiting"
            }
            primaryBusy={state.step === "claiming"}
            ready={ready && deployed}
          />
        </div>

        {state.step === "error" && state.error ? (
          <div className="mt-6 max-w-xl mx-auto rounded-lg border border-red-900 bg-red-950/30 px-4 py-3 text-sm text-red-200 text-center">
            {state.error}
          </div>
        ) : null}

        {!deployed ? (
          <div className="mt-6 max-w-xl mx-auto rounded-lg border border-amber-900 bg-amber-950/30 px-4 py-3 text-sm text-amber-200 text-center">
            Not ready yet. Check back in a minute.
          </div>
        ) : null}
      </section>

      <section className="max-w-3xl mx-auto px-6 pb-24 text-center">
        <h2 className="text-2xl font-semibold tracking-tight mb-2">
          Try it yourself
        </h2>
        <p className="text-neutral-400 mb-6 text-sm">
          Send one, or open a link someone sent you.
        </p>
        <div className="flex items-center justify-center gap-3">
          <Link
            href="/collection"
            className="rounded-lg bg-white text-black px-5 py-3 text-sm font-medium"
          >
            Send a Toss
          </Link>
          <Link
            href="/claim"
            className="rounded-lg border border-neutral-700 hover:border-neutral-500 px-5 py-3 text-sm"
          >
            Have a link? Open
          </Link>
        </div>
        <div className="mt-8 text-xs text-neutral-500 space-x-4">
          <a
            className="hover:text-neutral-300"
            href={REPO_URL}
            target="_blank"
            rel="noreferrer"
          >
            Source
          </a>
        </div>
      </section>
    </main>
  );
}

type PhoneProps = {
  role: string;
  label: string;
  state: DemoState;
  side: "sender" | "recipient";
  onPrimary?: () => void;
  primaryLabel: string;
  primaryBusy: boolean;
  onReset?: () => void;
  ready: boolean;
};

function Phone({
  role,
  label,
  state,
  side,
  onPrimary,
  primaryLabel,
  primaryBusy,
  onReset,
  ready,
}: PhoneProps) {
  const showNftCard =
    (side === "sender" && (state.step === "sent" || state.step === "claimed")) ||
    (side === "recipient" && state.step === "claimed");

  const isActive =
    (side === "sender" &&
      (state.step === "minting" ||
        state.step === "approving" ||
        state.step === "depositing")) ||
    (side === "recipient" && state.step === "claiming");

  return (
    <div className="flex flex-col items-center">
      <div className="text-xs uppercase tracking-widest text-neutral-500 mb-3">
        {role}
      </div>
      <div
        className="phone-frame w-[260px] h-[500px] flex flex-col"
        style={{
          transition: "transform 300ms",
          transform: isActive ? "translateY(-4px)" : "none",
        }}
      >
        <div className="h-8 flex items-center justify-center text-[10px] text-neutral-500 border-b border-neutral-900">
          {side === "sender" ? "Me" : "Unknown"}
        </div>

        <div className="flex-1 flex flex-col items-center justify-center px-5 text-center gap-4">
          <div className="text-sm text-neutral-300">{label}</div>

          {showNftCard ? (
            <div className="w-full rounded-xl border border-neutral-800 bg-neutral-950 p-3 text-left">
              <div className="aspect-square w-full rounded-md bg-gradient-to-br from-blue-600/50 to-purple-600/40 mb-2" />
              <div className="text-xs text-neutral-300">Toss Demo</div>
              <div className="text-[10px] text-neutral-500 font-mono">
                {state.tokenId !== undefined
                  ? `#${state.tokenId.toString()}`
                  : ""}
              </div>
            </div>
          ) : null}

          {state.step === "claimed" && side === "recipient" ? (
            <div className="text-xs text-emerald-300">
              Saved to your collection.
            </div>
          ) : null}
        </div>

        <div className="p-4 border-t border-neutral-900 space-y-2">
          {onPrimary ? (
            <button
              onClick={onPrimary}
              disabled={!ready || primaryBusy}
              className="w-full rounded-md bg-blue-600 hover:bg-blue-500 disabled:opacity-40 px-3 py-2 text-sm font-medium"
            >
              {primaryLabel}
            </button>
          ) : (
            <div className="w-full rounded-md border border-neutral-800 px-3 py-2 text-sm text-neutral-500 text-center">
              {primaryLabel}
            </div>
          )}
          {onReset ? (
            <button
              onClick={onReset}
              className="w-full text-xs text-neutral-500 hover:text-neutral-300"
            >
              Reset demo
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function Thread({
  show,
  url,
  claimed,
}: {
  show: boolean;
  url: string | undefined;
  claimed: boolean;
}) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[200px] w-full md:w-[220px]">
      <div className="text-xs uppercase tracking-widest text-neutral-500 mb-3">
        iMessage
      </div>
      <div
        className="w-full rounded-2xl border border-neutral-900 bg-neutral-950 p-3 min-h-[160px] flex items-end justify-end"
        style={{ overflow: "hidden" }}
      >
        <div
          className="imessage-bubble"
          style={{
            transform: show ? "translateX(0)" : "translateX(-120%)",
            opacity: show ? 1 : 0,
            transition: "transform 600ms ease, opacity 600ms ease",
            marginLeft: "auto",
            maxWidth: "100%",
          }}
        >
          <div className="text-[13px]">You got a Toss. Open it here:</div>
          <div className="text-[11px] opacity-80 break-all mt-1">
            {url ? shortenUrl(url) : "toss.lol/t/42#s=..."}
          </div>
          {claimed ? (
            <div className="text-[10px] opacity-80 mt-1">Read</div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function shortenUrl(url: string): string {
  try {
    const u = new URL(url);
    const frag = u.hash.length > 20 ? `${u.hash.slice(0, 18)}...` : u.hash;
    return `${u.host}${u.pathname}${frag}`;
  } catch {
    return url;
  }
}
