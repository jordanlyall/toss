import type { Address, PublicClient } from "viem";
import { DEMO_NFT_ABI, DEMO_NFT_ADDRESS } from "./contracts";

/**
 * Discover DemoNFT tokens currently owned by `address`. Reads nextId from
 * the contract, then checks ownerOf for every tokenId in [0, nextId).
 *
 * This is O(total supply) instead of using Transfer event logs, which the
 * public Base Sepolia RPC (sepolia.base.org) refuses for fromBlock: 0n
 * queries because the block range exceeds its eth_getLogs limit. For a
 * testnet demo with dozens of tokens this is cheap; mainnet promotion
 * should switch to an indexer.
 */
export async function discoverOwnedIds(
  publicClient: PublicClient,
  address: Address,
): Promise<bigint[]> {
  if (!DEMO_NFT_ADDRESS) return [];

  const nextId = (await publicClient.readContract({
    address: DEMO_NFT_ADDRESS,
    abi: DEMO_NFT_ABI,
    functionName: "nextId",
  })) as bigint;

  if (nextId === 0n) return [];

  const ids: bigint[] = [];
  for (let i = 0n; i < nextId; i++) ids.push(i);

  const BATCH = 8;
  const owned: bigint[] = [];
  for (let i = 0; i < ids.length; i += BATCH) {
    const chunk = ids.slice(i, i + BATCH);
    const results = await Promise.all(
      chunk.map(async (id) => {
        // Small per-token retry — the public RPC 429s under burst load.
        for (let attempt = 0; attempt < 3; attempt++) {
          try {
            const owner = (await publicClient.readContract({
              address: DEMO_NFT_ADDRESS,
              abi: DEMO_NFT_ABI,
              functionName: "ownerOf",
              args: [id],
            })) as Address;
            return { id, owner, ok: true as const };
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
      if (r.ok && r.owner.toLowerCase() === address.toLowerCase()) {
        owned.push(r.id);
      }
    }
    if (i + BATCH < ids.length) {
      await new Promise((r) => setTimeout(r, 120));
    }
  }

  // Newest first.
  owned.sort((a, b) => (b > a ? 1 : b < a ? -1 : 0));
  return owned;
}
