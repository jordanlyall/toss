import { PrivyClient } from "@privy-io/server-auth";

const appId = process.env.NEXT_PUBLIC_PRIVY_APP_ID;
const appSecret = process.env.PRIVY_APP_SECRET;

let client: PrivyClient | null = null;

export function getPrivyServerClient(): PrivyClient | null {
  if (!appId || !appSecret) return null;
  if (!client) client = new PrivyClient(appId, appSecret);
  return client;
}

// TTL cache so repeated OG renders for the same sender don't hit Privy every
// time. 60s is plenty for link-preview fanout.
const cache = new Map<string, { name: string | null; expires: number }>();
const TTL_MS = 60_000;

export async function getDisplayNameForAddress(
  address: string,
): Promise<string | null> {
  const key = address.toLowerCase();
  const now = Date.now();
  const hit = cache.get(key);
  if (hit && hit.expires > now) return hit.name;

  const c = getPrivyServerClient();
  if (!c) return null;

  let name: string | null = null;
  try {
    // Deposits come from the smart wallet, so try that lookup first.
    let user = await c.getUserBySmartWalletAddress(address);
    if (!user) user = await c.getUserByWalletAddress(address);
    const raw = user?.customMetadata?.displayName;
    if (typeof raw === "string" && raw.trim()) {
      name = raw.trim();
    }
  } catch (err) {
    // Never break OG rendering. Cache the miss so we don't retry hot.
    console.warn("getDisplayNameForAddress failed", err);
  }

  cache.set(key, { name, expires: now + TTL_MS });
  return name;
}
