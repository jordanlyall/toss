import type { Address, PublicClient } from "viem";
import { ESCROW_ABI, ESCROW_ADDRESS } from "./contracts";

export type ClaimStatus = "pending" | "claimed" | "expired" | "revoked";

export type SentClaim = {
  id: bigint;
  nftContract: Address;
  tokenId: bigint;
  expiresAt: bigint;
  status: ClaimStatus;
  recipient: Address | null;
};

type EscrowStruct = {
  sender: Address;
  nftContract: Address;
  tokenId: bigint;
  secretHash: `0x${string}`;
  expiresAt: bigint;
  settled: boolean;
};

// Minimal IERC721.ownerOf for distinguishing claimed vs revoked on settled
// escrows. Inlined so this module doesn't couple to a specific NFT ABI; any
// ERC-721 in an escrow exposes ownerOf.
const OWNER_OF_ABI = [
  {
    type: "function",
    name: "ownerOf",
    stateMutability: "view",
    inputs: [{ name: "tokenId", type: "uint256" }],
    outputs: [{ type: "address" }],
  },
] as const;

/**
 * Load every escrow created by `sender`, annotated with status and (for
 * claimed escrows) the current token owner as the recipient.
 *
 * Why nextId iteration instead of event logs: the public Base Sepolia RPC
 * (sepolia.base.org) refuses eth_getLogs with fromBlock: 0n because the
 * range exceeds its limit. Same workaround pattern as lib/owned.ts. For a
 * testnet demo with dozens of escrows this is cheap; mainnet promotion
 * should switch to an indexer.
 *
 * For settled escrows, claimed vs revoked is disambiguated via ownerOf:
 * if the token is back with the sender, it was revoked; otherwise it was
 * claimed and the current owner is reported as the recipient. If the
 * recipient later transfers the token, we'd show the new owner. Fine for
 * testnet, not for production.
 */
export async function loadSentClaims(
  publicClient: PublicClient,
  sender: Address,
): Promise<SentClaim[]> {
  if (!ESCROW_ADDRESS) return [];

  const nextId = (await publicClient.readContract({
    address: ESCROW_ADDRESS,
    abi: ESCROW_ABI,
    functionName: "nextId",
  })) as bigint;

  if (nextId === 0n) return [];

  const ids: bigint[] = [];
  for (let i = 0n; i < nextId; i++) ids.push(i);

  const BATCH = 8;
  const senderLower = sender.toLowerCase();
  const mine: Array<{ id: bigint; e: EscrowStruct }> = [];

  for (let i = 0; i < ids.length; i += BATCH) {
    const chunk = ids.slice(i, i + BATCH);
    const results = await Promise.all(
      chunk.map(async (id) => {
        for (let attempt = 0; attempt < 3; attempt++) {
          try {
            const e = (await publicClient.readContract({
              address: ESCROW_ADDRESS,
              abi: ESCROW_ABI,
              functionName: "getEscrow",
              args: [id],
            })) as EscrowStruct;
            return { id, e, ok: true as const };
          } catch {
            if (attempt < 2) {
              await new Promise((r) => setTimeout(r, 250 * (attempt + 1)));
            }
          }
        }
        return { id, ok: false as const };
      }),
    );
    for (const r of results) {
      if (r.ok && r.e.sender.toLowerCase() === senderLower) {
        mine.push({ id: r.id, e: r.e });
      }
    }
    if (i + BATCH < ids.length) {
      await new Promise((r) => setTimeout(r, 120));
    }
  }

  const now = BigInt(Math.floor(Date.now() / 1000));
  const claims: SentClaim[] = await Promise.all(
    mine.map(async ({ id, e }) => {
      let status: ClaimStatus;
      let recipient: Address | null = null;
      if (!e.settled) {
        status = e.expiresAt <= now ? "expired" : "pending";
      } else {
        try {
          const owner = (await publicClient.readContract({
            address: e.nftContract,
            abi: OWNER_OF_ABI,
            functionName: "ownerOf",
            args: [e.tokenId],
          })) as Address;
          if (owner.toLowerCase() === senderLower) {
            status = "revoked";
          } else {
            status = "claimed";
            recipient = owner;
          }
        } catch {
          status = "claimed";
        }
      }
      return {
        id,
        nftContract: e.nftContract,
        tokenId: e.tokenId,
        expiresAt: e.expiresAt,
        status,
        recipient,
      };
    }),
  );

  // Newest first.
  claims.sort((a, b) => (b.id > a.id ? 1 : b.id < a.id ? -1 : 0));
  return claims;
}

export function formatExpiry(expiresAt: bigint): string {
  const now = Math.floor(Date.now() / 1000);
  const diff = Number(expiresAt) - now;
  if (diff <= 0) return "expired";
  const days = Math.floor(diff / 86400);
  if (days >= 1) return `${days}d left`;
  const hours = Math.floor(diff / 3600);
  if (hours >= 1) return `${hours}h left`;
  const minutes = Math.floor(diff / 60);
  return `${Math.max(1, minutes)}m left`;
}
