"use client";

import { useEffect, useState } from "react";
import { usePublicClient } from "wagmi";
import { baseSepolia } from "wagmi/chains";
import type { Address } from "viem";
import { DEMO_NFT_ABI } from "@/lib/contracts";

type Props = {
  contract: Address;
  tokenId: bigint;
  size?: "sm" | "md" | "lg";
  className?: string;
};

const SIZE_CLASS: Record<NonNullable<Props["size"]>, string> = {
  sm: "w-16 h-16",
  md: "w-32 h-32",
  lg: "w-full aspect-square max-w-sm",
};

// Takes a tokenURI that looks like `data:application/json;base64,<...>`
// and pulls out the image data URI.
function extractImage(uri: string): string | null {
  if (!uri.startsWith("data:application/json;base64,")) return null;
  try {
    const json = atob(uri.slice("data:application/json;base64,".length));
    const meta = JSON.parse(json) as { image?: string };
    return meta.image ?? null;
  } catch {
    return null;
  }
}

export function NFTPreview({ contract, tokenId, size = "lg", className = "" }: Props) {
  const publicClient = usePublicClient({ chainId: baseSepolia.id });
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [errored, setErrored] = useState(false);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    if (!publicClient || !contract) return;
    let cancelled = false;
    setImageUri(null);
    setErrored(false);

    // Retry schedule in ms: 0, 500, 1200, 2500, 5000. Covers both bursty
    // rate-limit 429s and RPC nodes that are a block behind for a freshly
    // minted tokenId.
    const DELAYS = [0, 500, 1200, 2500, 5000];

    async function load(attempt: number): Promise<void> {
      if (cancelled) return;
      if (DELAYS[attempt] > 0) {
        await new Promise((r) => setTimeout(r, DELAYS[attempt]));
        if (cancelled) return;
      }
      try {
        const uri = (await publicClient!.readContract({
          address: contract,
          abi: DEMO_NFT_ABI,
          functionName: "tokenURI",
          args: [tokenId],
        })) as string;
        if (cancelled) return;
        const img = extractImage(uri);
        if (img) {
          setImageUri(img);
        } else {
          console.warn(
            `NFTPreview: unrecognized tokenURI format for token ${tokenId}`,
            uri.slice(0, 80),
          );
          setErrored(true);
        }
      } catch (err) {
        if (cancelled) return;
        if (attempt + 1 < DELAYS.length) return load(attempt + 1);
        console.warn(`NFTPreview: tokenURI failed for token ${tokenId}`, err);
        setErrored(true);
      }
    }

    void load(0);
    return () => {
      cancelled = true;
    };
  }, [publicClient, contract, tokenId, nonce]);

  const sizeClass = SIZE_CLASS[size];
  const wrap = `${sizeClass} rounded-lg overflow-hidden border border-neutral-800 bg-neutral-950 ${className}`;

  if (errored) {
    return (
      <div
        role="button"
        tabIndex={0}
        onClick={(e) => {
          e.stopPropagation();
          setErrored(false);
          setImageUri(null);
          setNonce((n) => n + 1);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            e.stopPropagation();
            setErrored(false);
            setImageUri(null);
            setNonce((n) => n + 1);
          }
        }}
        className={`${wrap} flex flex-col items-center justify-center gap-1 text-xs text-neutral-500 hover:text-neutral-300 cursor-pointer`}
      >
        <span>unavailable</span>
        <span className="text-[10px] text-neutral-600">tap to retry</span>
      </div>
    );
  }

  if (!imageUri) {
    return <div className={`${wrap} animate-pulse bg-neutral-900`} />;
  }

  return (
    <div className={wrap}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={imageUri}
        alt={`Toss #${tokenId.toString()}`}
        className="w-full h-full object-cover block"
      />
    </div>
  );
}
