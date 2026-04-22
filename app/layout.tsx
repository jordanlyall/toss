import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "./providers";

export const metadata: Metadata = {
  title: "Toss. Send NFTs by link.",
  description: "Text a link. Tap. Own. Passkey-native NFT transfer on Base.",
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
