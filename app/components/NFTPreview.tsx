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

  useEffect(() => {
    if (!publicClient || !contract) return;
    let cancelled = false;
    setImageUri(null);
    setErrored(false);
    (async () => {
      try {
        const uri = (await publicClient.readContract({
          address: contract,
          abi: DEMO_NFT_ABI,
          functionName: "tokenURI",
          args: [tokenId],
        })) as string;
        if (cancelled) return;
        const img = extractImage(uri);
        if (img) setImageUri(img);
        else setErrored(true);
      } catch {
        if (!cancelled) setErrored(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [publicClient, contract, tokenId]);

  const sizeClass = SIZE_CLASS[size];
  const wrap = `${sizeClass} rounded-lg overflow-hidden border border-neutral-800 bg-neutral-950 ${className}`;

  if (errored) {
    return (
      <div className={`${wrap} flex items-center justify-center text-xs text-neutral-600`}>
        unavailable
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
        alt={`Token #${tokenId.toString()}`}
        className="w-full h-full object-cover block"
      />
    </div>
  );
}
