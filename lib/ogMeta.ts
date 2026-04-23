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

// Server-side: resolve the sender's display name for a given escrow id. Used
// by both OG metadata generation and by the claim page to warm the body
// with the sender's name. Returns null on any miss (invalid id, no sender
// resolvable, no displayName set, Privy lookup failure).
export async function resolveSenderDisplayName(
  idParam: string | undefined,
): Promise<string | null> {
  if (!idParam) return null;
  try {
    const id = BigInt(idParam);
    const sender = await resolveSender(id);
    if (!sender) return null;
    return await getDisplayNameForAddress(sender);
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
  const senderName = await resolveSenderDisplayName(idParam);
  if (senderName) title = `${senderName} sent you a Field Note`;

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
