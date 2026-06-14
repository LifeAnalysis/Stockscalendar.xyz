"use client";

import { createAppKit } from "@reown/appkit/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";
import { cookieToInitialState, WagmiProvider, type Config } from "wagmi";
import {
  isReownConfigured,
  networks,
  reownProjectId,
  robinhoodChain,
  wagmiAdapter,
  wagmiConfig
} from "@/src/web3/config";

const queryClient = new QueryClient();
const projectId = reownProjectId || "00000000000000000000000000000000";

createAppKit({
  adapters: [wagmiAdapter],
  projectId,
  networks,
  defaultNetwork: robinhoodChain,
  metadata: {
    name: "Stockscalendar.xyz",
    description: "Discover and trade Robinhood Chain stocks, powered by the Hermes research agent.",
    url: process.env.NEXT_PUBLIC_SITE_URL || "https://stockscalendar.xyz",
    icons: ["/media/icons/hermes-thinking.webm"]
  },
  features: {
    analytics: isReownConfigured,
    email: false,
    socials: []
  }
});

export default function Providers({ children, cookies }: { children: React.ReactNode; cookies: string | null }) {
  const initialState = cookieToInitialState(wagmiConfig as Config, cookies);

  return (
    <WagmiProvider config={wagmiConfig as Config} initialState={initialState}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </WagmiProvider>
  );
}
