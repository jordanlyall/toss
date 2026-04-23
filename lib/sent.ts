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

const DEPOSITED_EVENT = {
  type: "event",
  name: "Deposited",
  inputs: [
    { name: "id", type: "uint256", indexed: true },
    { name: "sender", type: "address", indexed: true },
    { name: "nftContract", type: "address", indexed: true },
    { name: "tokenId", type: "uint256", indexed: false },
    { name: "expiresAt", type: "uint64", indexed: false },
  ],
} as const;

const CLAIMED_EVENT = {
  type: "event",
  name: "Claimed",
  inputs: [
    { name: "id", type: "uint256", indexed: true },
    { name: "recipient", type: "address", indexed: true },
  ],
} as const;

const REVOKED_EVENT = {
  type: "event",
  name: "Revoked",
  inputs: [{ name: "id", type: "uint256", indexed: true }],
} as const;

export async function loadSentClaims(
  publicClient: PublicClient,
  sender: Address,
): Promise<SentClaim[]> {
  if (!ESCROW_ADDRESS) return [];

  const [deposited, claimed, revoked] = await Promise.all([
    publicClient.getLogs({
      address: ESCROW_ADDRESS,
      event: DEPOSITED_EVENT,
      args: { sender },
      fromBlock: 0n,
    }),
    publicClient.getLogs({
      address: ESCROW_ADDRESS,
      event: CLAIMED_EVENT,
      fromBlock: 0n,
    }),
    publicClient.getLogs({
      address: ESCROW_ADDRESS,
      event: REVOKED_EVENT,
      fromBlock: 0n,
    }),
  ]);

  const claimedBy = new Map<string, Address>();
  for (const log of claimed) {
    const args = log.args as { id?: bigint; recipient?: Address };
    if (args.id !== undefined && args.recipient) {
      claimedBy.set(args.id.toString(), args.recipient);
    }
  }

  const revokedIds = new Set<string>();
  for (const log of revoked) {
    const args = log.args as { id?: bigint };
    if (args.id !== undefined) revokedIds.add(args.id.toString());
  }

  const now = BigInt(Math.floor(Date.now() / 1000));
  const claims: SentClaim[] = [];
  for (const log of deposited) {
    const args = log.args as {
      id?: bigint;
      nftContract?: Address;
      tokenId?: bigint;
      expiresAt?: bigint;
    };
    if (
      args.id === undefined ||
      !args.nftContract ||
      args.tokenId === undefined ||
      args.expiresAt === undefined
    ) {
      continue;
    }
    const key = args.id.toString();
    let status: ClaimStatus;
    let recipient: Address | null = null;
    if (claimedBy.has(key)) {
      status = "claimed";
      recipient = claimedBy.get(key)!;
    } else if (revokedIds.has(key)) {
      status = "revoked";
    } else if (args.expiresAt <= now) {
      status = "expired";
    } else {
      status = "pending";
    }
    claims.push({
      id: args.id,
      nftContract: args.nftContract,
      tokenId: args.tokenId,
      expiresAt: args.expiresAt,
      status,
      recipient,
    });
  }

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
