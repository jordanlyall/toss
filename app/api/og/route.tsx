import { ImageResponse } from "next/og";
import { createPublicClient, http, type Address } from "viem";
import { baseSepolia } from "viem/chains";
import {
  DEMO_NFT_ABI,
  ESCROW_ABI,
  ESCROW_ADDRESS,
} from "@/lib/contracts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const WIDTH = 1200;
const HEIGHT = 1200;

type Escrow = {
  sender: `0x${string}`;
  nftContract: `0x${string}`;
  tokenId: bigint;
  secretHash: `0x${string}`;
  expiresAt: bigint;
  settled: boolean;
};

type State = "ready" | "claimed" | "expired" | "notfound";

function extractImage(tokenUri: string): string | null {
  const prefix = "data:application/json;base64,";
  if (!tokenUri.startsWith(prefix)) return null;
  try {
    const jsonStr = atob(tokenUri.slice(prefix.length));
    const meta = JSON.parse(jsonStr) as { image?: string };
    return meta.image ?? null;
  } catch {
    return null;
  }
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const idParam = searchParams.get("id");

  let state: State = "ready";
  let nftImage: string | null = null;

  if (!idParam || !ESCROW_ADDRESS) {
    state = "notfound";
  } else {
    try {
      const id = BigInt(idParam);
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
        state = "notfound";
      } else if (escrow.settled) {
        state = "claimed";
      } else if (BigInt(Math.floor(Date.now() / 1000)) > escrow.expiresAt) {
        state = "expired";
      } else {
        state = "ready";
      }

      if (state !== "notfound") {
        try {
          const uri = (await client.readContract({
            address: escrow.nftContract as Address,
            abi: DEMO_NFT_ABI,
            functionName: "tokenURI",
            args: [escrow.tokenId],
          })) as string;
          nftImage = extractImage(uri);
        } catch {}
      }
    } catch {
      state = "notfound";
    }
  }

  const dimmed = state !== "ready";
  const stateLabel =
    state === "claimed"
      ? "Already opened"
      : state === "expired"
        ? "Expired"
        : null;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          position: "relative",
          background: "#0e0e0d",
          overflow: "hidden",
        }}
      >
        {nftImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={nftImage}
            width={WIDTH}
            height={HEIGHT}
            alt=""
            style={{
              width: WIDTH,
              height: HEIGHT,
              display: "block",
              opacity: dimmed ? 0.4 : 1,
            }}
          />
        ) : (
          <div
            style={{
              width: "100%",
              height: "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#5c5a54",
              fontSize: 64,
              fontFamily: "sans-serif",
              letterSpacing: -2,
            }}
          >
            Toss
          </div>
        )}

        {stateLabel ? (
          <div
            style={{
              position: "absolute",
              top: 48,
              left: 48,
              right: 48,
              display: "flex",
              justifyContent: "center",
            }}
          >
            <div
              style={{
                background: "rgba(14, 14, 13, 0.88)",
                color: "#faf9f5",
                fontFamily: "sans-serif",
                fontSize: 44,
                fontWeight: 600,
                letterSpacing: -1,
                padding: "18px 36px",
                borderRadius: 999,
              }}
            >
              {stateLabel}
            </div>
          </div>
        ) : null}
      </div>
    ),
    {
      width: WIDTH,
      height: HEIGHT,
      headers: {
        "Cache-Control": "public, max-age=60, s-maxage=60",
      },
    },
  );
}
