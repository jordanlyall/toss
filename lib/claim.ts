import { keccak256, toHex, bytesToHex, hexToBytes } from "viem";

/** Generate a fresh 32-byte secret as hex. */
export function generateSecret(): `0x${string}` {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return bytesToHex(bytes);
}

/** Hash the secret the same way the contract does: keccak256(abi.encodePacked(bytes32)). */
export function hashSecret(secret: `0x${string}`): `0x${string}` {
  return keccak256(hexToBytes(secret));
}

/** Build a shareable claim URL. Secret is in the URL fragment, never sent to server. */
export function buildClaimUrl(origin: string, id: bigint, secret: `0x${string}`): string {
  return `${origin}/claim#id=${id.toString()}&s=${secret}`;
}

/** Parse a claim URL fragment. */
export function parseClaimFragment(fragment: string): { id: bigint; secret: `0x${string}` } | null {
  const f = fragment.startsWith("#") ? fragment.slice(1) : fragment;
  const params = new URLSearchParams(f);
  const idStr = params.get("id");
  const secret = params.get("s");
  if (!idStr || !secret) return null;
  if (!/^0x[0-9a-fA-F]{64}$/.test(secret)) return null;
  try {
    return { id: BigInt(idStr), secret: secret as `0x${string}` };
  } catch {
    return null;
  }
}

/** Default expiry: 7 days from now, as uint64. */
export function defaultExpiry(): bigint {
  return BigInt(Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60);
}
