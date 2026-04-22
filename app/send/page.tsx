"use client";

import { useEffect, useMemo, useState } from "react";
import { usePrivy, useSendTransaction, useWallets } from "@privy-io/react-auth";
import { usePublicClient } from "wagmi";
import {
  encodeFunctionData,
  decodeEventLog,
  formatEther,
  type Address,
} from "viem";
import { baseSepolia } from "wagmi/chains";
import Link from "next/link";
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

type Status =
  | { kind: "idle" }
  | { kind: "minting" }
  | { kind: "minted"; tokenId: bigint }
  | { kind: "sending"; tokenId: bigint; step: string }
  | { kind: "sent"; tokenId: bigint; escrowId: bigint; url: string }
  | { kind: "error"; message: string };

function shorten(addr: string | undefined): string {
  if (!addr) return "";
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

export default function SendPage() {
  const { ready, authenticated, login, logout } = usePrivy();
  const { wallets } = useWallets();
  const { sendTransaction } = useSendTransaction();
  const publicClient = usePublicClient({ chainId: baseSepolia.id });

  const embeddedWallet = wallets.find((w) => w.walletClientType === "privy");
  const address = (embeddedWallet?.address ?? wallets[0]?.address) as
    | Address
    | undefined;

  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const [ownedIds, setOwnedIds] = useState<bigint[]>([]);
  const [balance, setBalance] = useState<bigint | null>(null);

  async function refreshOwned(addr: Address) {
    if (!publicClient || !DEMO_NFT_ADDRESS) return;
    const filtered: bigint[] = [];
    for (const id of ownedIds) {
      try {
        const owner = (await publicClient.readContract({
          address: DEMO_NFT_ADDRESS,
          abi: DEMO_NFT_ABI,
          functionName: "ownerOf",
          args: [id],
        })) as Address;
        if (owner.toLowerCase() === addr.toLowerCase()) filtered.push(id);
      } catch {}
    }
    setOwnedIds(filtered);
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

  const canAct = useMemo(
    () => !!address && !!ESCROW_ADDRESS && !!DEMO_NFT_ADDRESS,
    [address],
  );

  async function handleMint() {
    if (!publicClient || !address) return;
    setStatus({ kind: "minting" });
    try {
      const { hash } = await sendTransaction(
        {
          to: DEMO_NFT_ADDRESS,
          data: encodeFunctionData({
            abi: DEMO_NFT_ABI,
            functionName: "mint",
            args: [],
          }),
          chainId: baseSepolia.id,
        },
        { sponsor: true },
      );
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
      setStatus({ kind: "minted", tokenId });
    } catch (err: any) {
      setStatus({
        kind: "error",
        message: err?.shortMessage || err?.message || "Mint failed",
      });
    }
  }

  async function handleSend(tokenId: bigint) {
    if (!publicClient || !address) return;
    setStatus({ kind: "sending", tokenId, step: "Checking approval" });
    try {
      const approved = (await publicClient.readContract({
        address: DEMO_NFT_ADDRESS,
        abi: DEMO_NFT_ABI,
        functionName: "isApprovedForAll",
        args: [address, ESCROW_ADDRESS],
      })) as boolean;

      if (!approved) {
        setStatus({ kind: "sending", tokenId, step: "Approving escrow" });
        const { hash: approveHash } = await sendTransaction(
          {
            to: DEMO_NFT_ADDRESS,
            data: encodeFunctionData({
              abi: DEMO_NFT_ABI,
              functionName: "setApprovalForAll",
              args: [ESCROW_ADDRESS, true],
            }),
            chainId: baseSepolia.id,
          },
          { sponsor: true },
        );
        await publicClient.waitForTransactionReceipt({ hash: approveHash });
      }

      setStatus({ kind: "sending", tokenId, step: "Creating link" });
      const secret = generateSecret();
      const secretHash = hashSecret(secret);
      const expiresAt = defaultExpiry();

      const { hash: depositHash } = await sendTransaction(
        {
          to: ESCROW_ADDRESS,
          data: encodeFunctionData({
            abi: ESCROW_ABI,
            functionName: "deposit",
            args: [DEMO_NFT_ADDRESS, tokenId, secretHash, expiresAt],
          }),
          chainId: baseSepolia.id,
        },
        { sponsor: true },
      );
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
        typeof window !== "undefined" ? window.location.origin : "https://toss.app";
      const url = buildClaimUrl(origin, escrowId, secret);
      setOwnedIds((prev) => prev.filter((id) => id !== tokenId));
      setStatus({ kind: "sent", tokenId, escrowId, url });
    } catch (err: any) {
      setStatus({
        kind: "error",
        message: err?.shortMessage || err?.message || "Send failed",
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

  return (
    <main className="min-h-screen px-6 py-10 max-w-2xl mx-auto">
      <nav className="flex items-center justify-between mb-10">
        <Link href="/" className="text-sm text-neutral-400 hover:text-white">
          Toss
        </Link>
        <div className="flex items-center gap-3 text-sm">
          <Link href="/claim" className="text-neutral-400 hover:text-white">
            Claim
          </Link>
          {authenticated ? (
            <button
              onClick={logout}
              className="text-neutral-400 hover:text-white"
            >
              Sign out
            </button>
          ) : null}
        </div>
      </nav>

      <h1 className="text-3xl font-semibold tracking-tight mb-2">Send an NFT</h1>
      <p className="text-neutral-400 mb-8">
        Mint a demo token, then generate a claim link you can text to anyone. No
        gas.
      </p>

      {!ESCROW_ADDRESS || !DEMO_NFT_ADDRESS ? (
        <div className="rounded-lg border border-amber-900 bg-amber-950/30 px-4 py-3 text-sm text-amber-200">
          Contracts not deployed. Run{" "}
          <code className="font-mono">npm run deploy:sepolia</code> first.
        </div>
      ) : !authenticated ? (
        <button
          onClick={login}
          className="w-full rounded-lg bg-blue-600 hover:bg-blue-500 px-5 py-4 text-base font-medium"
        >
          Sign in to send
        </button>
      ) : !address ? (
        <div className="text-sm text-neutral-400">Preparing wallet...</div>
      ) : (
        <div className="space-y-8">
          <section className="rounded-lg border border-neutral-800 p-4">
            <div className="flex items-center justify-between text-sm">
              <div>
                <div className="text-neutral-400">Wallet</div>
                <div className="font-mono">{shorten(address)}</div>
              </div>
              <div className="text-right">
                <div className="text-neutral-400">Balance</div>
                <div className="font-mono">
                  {balance !== null
                    ? `${Number(formatEther(balance)).toFixed(4)} ETH`
                    : "..."}
                </div>
              </div>
            </div>
          </section>

          <section>
            <button
              onClick={handleMint}
              disabled={!canAct || status.kind === "minting"}
              className="w-full rounded-lg border border-neutral-700 hover:border-neutral-500 disabled:opacity-50 px-5 py-4 text-base"
            >
              {status.kind === "minting" ? "Minting..." : "Mint a demo NFT"}
            </button>
          </section>

          {ownedIds.length > 0 ? (
            <section>
              <h2 className="text-sm text-neutral-400 mb-3">Your demo NFTs</h2>
              <ul className="space-y-2">
                {ownedIds.map((id) => {
                  const isSending =
                    status.kind === "sending" && status.tokenId === id;
                  return (
                    <li
                      key={id.toString()}
                      className="flex items-center justify-between rounded-lg border border-neutral-800 px-4 py-3"
                    >
                      <div className="font-mono text-sm">
                        Token #{id.toString()}
                      </div>
                      <button
                        onClick={() => handleSend(id)}
                        disabled={!canAct || isSending}
                        className="rounded-md bg-blue-600 hover:bg-blue-500 disabled:opacity-50 px-3 py-1.5 text-sm font-medium"
                      >
                        {isSending ? status.step : "Send"}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>
          ) : null}

          {status.kind === "sent" ? (
            <section className="rounded-lg border border-emerald-900 bg-emerald-950/30 p-4 space-y-3">
              <div className="text-sm text-emerald-200">
                Ready to share. Token #{status.tokenId.toString()} is in escrow
                as #{status.escrowId.toString()}.
              </div>
              <input
                readOnly
                value={status.url}
                onFocus={(e) => e.currentTarget.select()}
                className="w-full rounded-md bg-black border border-neutral-800 px-3 py-2 font-mono text-xs"
              />
              <div className="flex gap-2">
                <button
                  onClick={() => navigator.clipboard.writeText(status.url)}
                  className="rounded-md bg-white text-black px-3 py-1.5 text-sm font-medium"
                >
                  Copy link
                </button>
                <a
                  href={`sms:&body=${encodeURIComponent(`You got an NFT. Claim it here: ${status.url}`)}`}
                  className="rounded-md border border-neutral-700 px-3 py-1.5 text-sm"
                >
                  Share via iMessage
                </a>
              </div>
            </section>
          ) : null}

          {status.kind === "minted" ? (
            <section className="text-sm text-neutral-400">
              Minted token #{status.tokenId.toString()}. Send it below.
            </section>
          ) : null}

          {status.kind === "error" ? (
            <section className="rounded-lg border border-red-900 bg-red-950/30 px-4 py-3 text-sm text-red-200">
              {status.message}
            </section>
          ) : null}
        </div>
      )}
    </main>
  );
}
