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

  return (
    <PrivyProvider
      appId={appId}
      config={{
        loginMethods: ["email", "sms", "wallet"],
        embeddedWallets: {
          createOnLogin: "users-without-wallets",
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
