import { fetchStockCalendars } from "./calendar";
import { matchStockMarkets } from "./kalshi";
import { discoverExplorerStockTokens, robinhoodPaymentTokens, robinhoodStockTokens } from "./robinhood";

type PipelineCheck = {
  name: string;
  ok: boolean;
  required: boolean;
  source: string;
  records: number;
  error?: string;
};

function buildPipelineChecks(
  kalshi: Awaited<ReturnType<typeof matchStockMarkets>>,
  calendars: Awaited<ReturnType<typeof fetchStockCalendars>>,
  explorerDiscovery: Awaited<ReturnType<typeof discoverExplorerStockTokens>>
): PipelineCheck[] {
  return [
    {
      name: "robinhood_chain_tokens",
      ok: robinhoodStockTokens.length > 0 && robinhoodPaymentTokens.length > 0,
      required: true,
      source: "https://docs.robinhood.com/chain/contracts/",
      records: robinhoodStockTokens.length + robinhoodPaymentTokens.length
    },
    {
      name: "kalshi_public_markets",
      ok: kalshi.ok,
      required: false,
      source: kalshi.source,
      records: kalshi.scanned_markets,
      error: kalshi.error
    },
    {
      name: "public_event_calendars",
      ok: calendars.every((calendar) => calendar.ok || calendar.public_links.length > 0),
      required: false,
      source: "Yahoo Finance calendarEvents with public fallback links",
      records: calendars.length,
      error: calendars
        .filter((calendar) => !calendar.ok && calendar.error)
        .map((calendar) => `${calendar.symbol}: ${calendar.error}`)
        .join("; ") || undefined
    },
    {
      name: "explorer_stock_like_tokens",
      ok: explorerDiscovery.ok,
      required: false,
      source: explorerDiscovery.source,
      records: explorerDiscovery.stock_like_count,
      error: explorerDiscovery.error
    }
  ];
}

function buildAgentContext(
  kalshi: Awaited<ReturnType<typeof matchStockMarkets>>,
  calendars: Awaited<ReturnType<typeof fetchStockCalendars>>,
  explorerDiscovery: Awaited<ReturnType<typeof discoverExplorerStockTokens>>
) {
  return {
    execution_boundary: "quote_preparation_only_wallet_signature_required",
    trust_policy: "only official Robinhood docs contracts are routed; explorer-discovered tokens are context only",
    quote_endpoint: "/api/robinhood/trade",
    stock_tokens: robinhoodStockTokens.map((stock) => ({
      symbol: stock.symbol,
      name: stock.name,
      address: stock.address,
      chainId: stock.chainId,
      aliases: stock.aliases
    })),
    payment_tokens: robinhoodPaymentTokens.map((token) => ({
      symbol: token.symbol,
      name: token.name,
      address: token.address,
      chainId: token.chainId,
      aliases: token.aliases
    })),
    kalshi_matches: kalshi.stocks.map((row) => ({
      symbol: row.stock.symbol,
      match_count: row.match_count,
      top_markets: row.markets.slice(0, 3)
    })),
    calendars: calendars.map((calendar) => ({
      symbol: calendar.symbol,
      ok: calendar.ok,
      earnings_dates: calendar.earnings_dates,
      estimates: calendar.estimates,
      public_links: calendar.public_links
    })),
    explorer_discovered_tokens: explorerDiscovery.tokens.map((token) => ({
      symbol: token.symbol,
      name: token.name,
      address: token.address,
      trust_level: token.trust_level,
      routed_by_agent: token.routed_by_agent
    }))
  };
}

export async function buildStockIntel() {
  const [kalshi, calendars, explorerDiscovery] = await Promise.all([
    matchStockMarkets(robinhoodStockTokens),
    fetchStockCalendars(robinhoodStockTokens),
    discoverExplorerStockTokens()
  ]);
  const checks = buildPipelineChecks(kalshi, calendars, explorerDiscovery);

  return {
    ok: checks.every((check) => !check.required || check.ok),
    timestamp: new Date().toISOString(),
    pipeline: {
      ok: checks.every((check) => !check.required || check.ok),
      checks,
      required_ok: checks.filter((check) => check.required).every((check) => check.ok),
      degraded_sources: checks.filter((check) => !check.ok).map((check) => check.name)
    },
    robinhood_chain: {
      stock_count: robinhoodStockTokens.length,
      payment_tokens: robinhoodPaymentTokens,
      stocks: robinhoodStockTokens,
      source: "https://docs.robinhood.com/chain/contracts/"
    },
    explorer_discovery: explorerDiscovery,
    kalshi,
    calendars,
    agent_context: buildAgentContext(kalshi, calendars, explorerDiscovery)
  };
}
