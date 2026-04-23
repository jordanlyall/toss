import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "./providers";

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ||
  (process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : "http://localhost:3000");

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: "Field Notes — small compositions, made to be shared.",
  description: "On-chain glyph grids by Jordan Lyall. Free to make. Sent by link.",
};

// Privy initializes with runtime env vars. Static prerender would fail when
// NEXT_PUBLIC_PRIVY_APP_ID is not set at build time.
export const dynamic = "force-dynamic";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
