import type { Address, PublicClient } from "viem";
import { DEMO_NFT_ABI, DEMO_NFT_ADDRESS } from "./contracts";

const TRANSFER_EVENT = {
  type: "event",
  name: "Transfer",
  inputs: [
    { name: "from", type: "address", indexed: true },
    { name: "to", type: "address", indexed: true },
    { name: "tokenId", type: "uint256", indexed: true },
  ],
} as const;

/**
 * Discover DemoNFT tokens currently owned by `address`. Finds every Transfer
 * ever sent to this address, then confirms current ownership (skips tokens
 * the user has since sent back out).
 */
export async function discoverOwnedIds(
  publicClient: PublicClient,
  address: Address,
): Promise<bigint[]> {
  if (!DEMO_NFT_ADDRESS) return [];

  const logs = await publicClient.getLogs({
    address: DEMO_NFT_ADDRESS,
    event: TRANSFER_EVENT,
    args: { to: address },
    fromBlock: 0n,
  });

  const candidates = new Set<string>();
  for (const log of logs) {
    const args = log.args as { tokenId?: bigint };
    if (args.tokenId !== undefined) candidates.add(args.tokenId.toString());
  }

  const owned: bigint[] = [];
  for (const key of candidates) {
    const id = BigInt(key);
    try {
      const owner = (await publicClient.readContract({
        address: DEMO_NFT_ADDRESS,
        abi: DEMO_NFT_ABI,
        functionName: "ownerOf",
        args: [id],
      })) as Address;
      if (owner.toLowerCase() === address.toLowerCase()) owned.push(id);
    } catch {
      // Token burned or ownership check reverted — skip.
    }
  }

  // Newest first.
  owned.sort((a, b) => (b > a ? 1 : b < a ? -1 : 0));
  return owned;
}
