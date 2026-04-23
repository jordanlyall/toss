import { createPublicClient, http } from "viem";
import { baseSepolia } from "viem/chains";
import { DEMO_NFT_ABI, ESCROW_ABI, ESCROW_ADDRESS } from "./contracts";
import { getDisplayNameForAddress } from "./privyServer";

export type PrefetchedClaim = {
  sender: `0x${string}`;
  nftContract: `0x${string}`;
  tokenId: bigint;
  expiresAt: bigint;
  settled: boolean;
  imageUri: string | null;
  senderName: string | null;
};

type EscrowStruct = {
  sender: `0x${string}`;
  nftContract: `0x${string}`;
  tokenId: bigint;
  secretHash: `0x${string}`;
  expiresAt: bigint;
  settled: boolean;
};

function extractImage(uri: string): string | null {
  if (!uri.startsWith("data:application/json;base64,")) return null;
  try {
    const json = Buffer.from(
      uri.slice("data:application/json;base64,".length),
      "base64",
    ).toString("utf-8");
    const meta = JSON.parse(json) as { image?: string };
    return meta.image ?? null;
  } catch {
    return null;
  }
}

// Server-side prefetch for the claim page. Grabs escrow metadata + tokenURI +
// sender display name in parallel so the recipient's first paint already
// contains the art and the 'From X' line. Client hydration still does its
// own fragment parse and fresh escrow check for correctness (state may have
// changed since the render), but the recipient never sees a 'Loading...'
// flash first.
//
// Returns null on any failure — the client component falls back to its
// existing loading + fetch behavior.
export async function prefetchClaim(
  idParam: string | undefined,
): Promise<PrefetchedClaim | null> {
  if (!idParam || !ESCROW_ADDRESS) return null;
  let id: bigint;
  try {
    id = BigInt(idParam);
  } catch {
    return null;
  }

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
    })) as EscrowStruct;

    if (escrow.sender === "0x0000000000000000000000000000000000000000") {
      return null;
    }

    const [tokenURI, senderName] = await Promise.all([
      client
        .readContract({
          address: escrow.nftContract,
          abi: DEMO_NFT_ABI,
          functionName: "tokenURI",
          args: [escrow.tokenId],
        })
        .then((u) => u as string)
        .catch(() => null),
      getDisplayNameForAddress(escrow.sender).catch(() => null),
    ]);

    return {
      sender: escrow.sender,
      nftContract: escrow.nftContract,
      tokenId: escrow.tokenId,
      expiresAt: escrow.expiresAt,
      settled: escrow.settled,
      imageUri: tokenURI ? extractImage(tokenURI) : null,
      senderName,
    };
  } catch {
    return null;
  }
}
