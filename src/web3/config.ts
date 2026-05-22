import { WagmiAdapter } from "@reown/appkit-adapter-wagmi";
import { defineChain } from "@reown/appkit/networks";
import { cookieStorage, createStorage, http } from "wagmi";

export const ROBINHOOD_CHAIN_ID = Number(process.env.NEXT_PUBLIC_ROBINHOOD_CHAIN_ID || "46630");
export const ROBINHOOD_CHAIN_NAME = "Robinhood Chain Testnet";
export const ROBINHOOD_CHAIN_EXPLORER =
  process.env.NEXT_PUBLIC_ROBINHOOD_CHAIN_EXPLORER_URL?.replace(/\/$/, "") ||
  "https://explorer.testnet.chain.robinhood.com";
export const ROBINHOOD_CHAIN_RPC_URL =
  process.env.NEXT_PUBLIC_ROBINHOOD_CHAIN_RPC_URL ||
  "https://robinhood-testnet.g.alchemy.com/v2/<ALCHEMY_KEY>";

export const reownProjectId = process.env.NEXT_PUBLIC_REOWN_PROJECT_ID || "";
export const isReownConfigured = Boolean(reownProjectId);
const projectId = reownProjectId || "00000000000000000000000000000000";

export const robinhoodChain = defineChain({
  id: ROBINHOOD_CHAIN_ID,
  caipNetworkId: `eip155:${ROBINHOOD_CHAIN_ID}`,
  chainNamespace: "eip155",
  name: ROBINHOOD_CHAIN_NAME,
  nativeCurrency: {
    decimals: 18,
    name: "Ether",
    symbol: "ETH"
  },
  rpcUrls: {
    default: {
      http: [ROBINHOOD_CHAIN_RPC_URL]
    }
  },
  blockExplorers: {
    default: {
      name: "Robinhood Explorer",
      url: ROBINHOOD_CHAIN_EXPLORER
    }
  }
});

export const networks = [robinhoodChain] as [typeof robinhoodChain];

export const wagmiAdapter = new WagmiAdapter({
  storage: createStorage({
    storage: cookieStorage
  }),
  ssr: true,
  projectId,
  networks,
  transports: {
    [robinhoodChain.id]: http(ROBINHOOD_CHAIN_RPC_URL)
  }
});

export const wagmiConfig = wagmiAdapter.wagmiConfig;
