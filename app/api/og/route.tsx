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
const HEIGHT = 630;

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

  const headline =
    state === "ready"
      ? "You got a Toss"
      : state === "claimed"
        ? "Already opened"
        : state === "expired"
          ? "Link expired"
          : "Toss";
  const subline =
    state === "ready"
      ? "Open to keep it. Free. Takes seconds."
      : state === "claimed"
        ? "Someone already opened this one."
        : state === "expired"
          ? "Ask the sender for a fresh link."
          : "Send a Toss by link.";

  const ACCENT = state === "ready" ? "#6a9bcc" : "#8a8882";
  const dimmed = state !== "ready";

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          background: "linear-gradient(135deg, #0e0e0d 0%, #191817 100%)",
          color: "#faf9f5",
          fontFamily: "sans-serif",
          padding: 64,
          alignItems: "center",
          gap: 64,
        }}
      >
        <div
          style={{
            width: 480,
            height: 480,
            borderRadius: 20,
            background: "#1a1a18",
            border: "1px solid #2b2a27",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            overflow: "hidden",
            flexShrink: 0,
            opacity: dimmed ? 0.55 : 1,
          }}
        >
          {nftImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={nftImage}
              width={480}
              height={480}
              alt=""
              style={{ display: "block" }}
            />
          ) : (
            <div style={{ color: "#5c5a54", fontSize: 24 }}>Toss</div>
          )}
        </div>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            flex: 1,
            gap: 20,
          }}
        >
          <div
            style={{
              fontSize: 24,
              fontWeight: 500,
              letterSpacing: 4,
              textTransform: "uppercase",
              color: ACCENT,
            }}
          >
            TOSS
          </div>
          <div
            style={{
              fontSize: 78,
              fontWeight: 700,
              lineHeight: 1.05,
              letterSpacing: -2,
              color: "#faf9f5",
            }}
          >
            {headline}
          </div>
          <div
            style={{
              fontSize: 34,
              color: "#c9c7bf",
              lineHeight: 1.3,
              marginTop: 8,
            }}
          >
            {subline}
          </div>
        </div>
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
