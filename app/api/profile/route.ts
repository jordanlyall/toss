import { NextResponse } from "next/server";
import { getPrivyServerClient } from "@/lib/privyServer";

const MAX_LEN = 40;

export async function POST(req: Request) {
  const client = getPrivyServerClient();
  if (!client) {
    return NextResponse.json(
      { error: "Server not configured" },
      { status: 500 },
    );
  }

  const auth = req.headers.get("authorization");
  const token = auth?.replace(/^Bearer /, "");
  if (!token) {
    return NextResponse.json({ error: "Missing auth" }, { status: 401 });
  }

  let userId: string;
  try {
    const claims = await client.verifyAuthToken(token);
    userId = claims.userId;
  } catch {
    return NextResponse.json({ error: "Invalid auth" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const raw = body?.displayName;
  if (typeof raw !== "string") {
    return NextResponse.json({ error: "Invalid name" }, { status: 400 });
  }
  const displayName = raw.trim().slice(0, MAX_LEN);

  try {
    await client.setCustomMetadata(userId, { displayName });
    return NextResponse.json({ ok: true, displayName });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Update failed" },
      { status: 500 },
    );
  }
}
