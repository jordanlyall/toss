import type { Metadata } from "next";
import { createPublicClient, http, type Address } from "viem";
import { baseSepolia } from "viem/chains";
import { ESCROW_ABI, ESCROW_ADDRESS } from "./contracts";
import { getDisplayNameForAddress } from "./privyServer";

const DEFAULT_TITLE = "You got a Field Note";
const DEFAULT_DESCRIPTION = "Open to keep it. Free. Takes seconds.";

type Escrow = {
  sender: `0x${string}`;
  nftContract: `0x${string}`;
  tokenId: bigint;
  secretHash: `0x${string}`;
  expiresAt: bigint;
  settled: boolean;
};

async function resolveSender(id: bigint): Promise<Address | null> {
  if (!ESCROW_ADDRESS) return null;
  try {
    const client = createPublicClient({
      chain: baseSepolia,
      transport: http(),
    });
    const escrow = (await client.readContract({
      address: ESCROW_ADDRESS,
      abi: ESCROW_ABI,
      functionName: "getEscrow",
      args: [id],
    })) as Escrow;
    if (escrow.sender === "0x0000000000000000000000000000000000000000") {
      return null;
    }
    return escrow.sender;
  } catch {
    return null;
  }
}

export async function buildClaimMetadata(
  idParam: string | undefined,
): Promise<Metadata> {
  const ogUrl = idParam
    ? `/api/og?id=${encodeURIComponent(idParam)}`
    : "/api/og";

  let title = DEFAULT_TITLE;

  if (idParam) {
    try {
      const id = BigInt(idParam);
      const sender = await resolveSender(id);
      if (sender) {
        const name = await getDisplayNameForAddress(sender);
        if (name) title = `${name} sent you a Field Note`;
      }
    } catch {
      // Invalid id -> keep default title.
    }
  }

  return {
    title,
    description: DEFAULT_DESCRIPTION,
    openGraph: {
      title,
      description: DEFAULT_DESCRIPTION,
      images: [
        {
          url: ogUrl,
          width: 1200,
          height: 1200,
          alt: title,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description: DEFAULT_DESCRIPTION,
      images: [ogUrl],
    },
  };
}
