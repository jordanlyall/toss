"use client";

import { PrivyProvider } from "@privy-io/react-auth";
import { WagmiProvider } from "@privy-io/wagmi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { baseSepolia } from "wagmi/chains";
import { useState } from "react";
import { wagmiConfig } from "@/lib/wagmi";

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());
  const appId = process.env.NEXT_PUBLIC_PRIVY_APP_ID || "";

  if (!appId) {
    return (
      <main className="min-h-screen flex items-center justify-center p-6">
        <div className="max-w-md text-center space-y-3">
          <h1 className="text-xl font-semibold">Privy not configured</h1>
          <p className="text-sm text-neutral-400">
            Set <code className="font-mono">NEXT_PUBLIC_PRIVY_APP_ID</code> in{" "}
            <code className="font-mono">.env.local</code> (see README) and
            reload.
          </p>
        </div>
      </main>
    );
  }

  return (
    <PrivyProvider
      appId={appId}
      config={{
        loginMethods: ["email", "sms", "wallet"],
        embeddedWallets: {
          ethereum: {
            createOnLogin: "users-without-wallets",
          },
        },
        defaultChain: baseSepolia,
        supportedChains: [baseSepolia],
        appearance: {
          theme: "dark",
          accentColor: "#3b82f6",
          logo: undefined,
        },
      }}
    >
      <QueryClientProvider client={queryClient}>
        <WagmiProvider config={wagmiConfig}>{children}</WagmiProvider>
      </QueryClientProvider>
    </PrivyProvider>
  );
}
