import type { Metadata } from "next";
import { createPublicClient, http, type Address } from "viem";
import { baseSepolia, mainnet } from "viem/chains";
import { ESCROW_ABI, ESCROW_ADDRESS } from "./contracts";

const DEFAULT_TITLE = "You got a Toss";
const DEFAULT_DESCRIPTION = "Open to keep it. Free. Takes seconds.";

type Escrow = {
  sender: `0x${string}`;
  nftContract: `0x${string}`;
  tokenId: bigint;
  secretHash: `0x${string}`;
  expiresAt: bigint;
  settled: boolean;
};

async function resolveSenderEns(sender: Address): Promise<string | null> {
  try {
    const client = createPublicClient({
      chain: mainnet,
      transport: http(
        process.env.NEXT_PUBLIC_MAINNET_RPC || "https://cloudflare-eth.com",
      ),
    });
    const name = await client.getEnsName({ address: sender });
    return name ?? null;
  } catch {
    return null;
  }
}

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

export async function buildClaimMetadata(idParam: string | undefined): Promise<Metadata> {
  const ogUrl = idParam
    ? `/api/og?id=${encodeURIComponent(idParam)}`
    : "/api/og";

  let title = DEFAULT_TITLE;

  if (idParam) {
    try {
      const id = BigInt(idParam);
      const sender = await resolveSender(id);
      if (sender) {
        const ens = await resolveSenderEns(sender);
        if (ens) title = `${ens} sent you a Toss`;
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
