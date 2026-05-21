import { env } from "./env";
import { fetchJson } from "./http";
import { buildStockIntel } from "./intel";

type OpenRouterResponse = {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
  error?: unknown;
};

type OpenRouterChatResult = {
  configured: boolean;
  ok: boolean;
  model: string;
  reply: string | null;
  status?: number;
  error?: string;
};

export const DEFAULT_HERMES_OUTPUT_PROMPT =
  "For Tesla, Amazon, Palantir, Netflix, and AMD, should I prepare any Robinhood Chain stock-token quote right now? Use all stock feeds and Kalshi only as supporting evidence.";

function formatMoney(value?: number) {
  if (!Number.isFinite(value)) return "n/a";
  return `$${Number(value).toFixed(Number(value) >= 100 ? 2 : 4)}`;
}

function formatVolume(value?: number) {
  if (!Number.isFinite(value)) return "n/a";
  if (Number(value) >= 1_000_000) return `${(Number(value) / 1_000_000).toFixed(1)}M`;
  if (Number(value) >= 1_000) return `${(Number(value) / 1_000).toFixed(1)}K`;
  return String(value);
}

function fallbackReply(intel: Awaited<ReturnType<typeof buildStockIntel>>) {
  const decision = intel.hermes_decision;
  const degraded = intel.pipeline.degraded_sources.length ? ` Degraded sources: ${intel.pipeline.degraded_sources.join(", ")}.` : "";
  const recommendations = decision.stocks
    .map((row) => {
      const route = `official route ready`;
      const price = row.price?.close
        ? `price ${formatMoney(row.price.close)} close${row.price.date ? ` on ${row.price.date}` : ""}${row.price.volume ? `, ${formatVolume(row.price.volume)} volume` : ""}`
        : "price source unavailable";
      const filing = row.latest_filing
        ? `SEC ${row.latest_filing.form}${row.latest_filing.filing_date ? ` filed ${row.latest_filing.filing_date}` : ""}`
        : "no latest SEC filing returned";
      const pricing = row.yes_no_prices
        ? `Kalshi ${row.yes_no_prices.yes_bid || "n/a"}/${row.yes_no_prices.yes_ask || "n/a"} YES, ${row.yes_no_prices.no_bid || "n/a"}/${row.yes_no_prices.no_ask || "n/a"} NO`
        : "no clean YES/NO market price";
      return `- ${row.symbol}: ${row.action} (${row.confidence}%). ${route}; ${price}; ${filing}; ${pricing}. Next: ${row.user_action}`;
    })
    .join("\n");
  const searched = intel.kalshi.searched_terms?.length ? ` Filtered Kalshi terms: ${intel.kalshi.searched_terms.join(", ")}.` : "";
  return [
    `Verdict: ${decision.verdict}.`,
    decision.summary,
    `Context: ${intel.robinhood_chain.stock_count} Robinhood Chain stock tokens, ${intel.robinhood_chain.payment_tokens.length} payment tokens, ${intel.kalshi.scanned_markets} public Kalshi markets fetched, ${intel.stock_signals.prices.filter((row) => row.ok).length} public quote snapshots, ${intel.stock_signals.filings.filter((row) => row.ok).length} SEC filing streams, and ${intel.calendars.length} public calendar feeds.${searched} Source policy: ${intel.hermes_decision.source_note}${degraded}`,
    "Per stock:",
    recommendations,
    `Action: ${decision.user_action}`
  ].join("\n");
}

function safeOpenRouterError(response: OpenRouterResponse | undefined): string | undefined {
  if (!response?.error) return undefined;
  if (typeof response.error === "string") return response.error.slice(0, 240);
  if (typeof response.error === "object" && response.error && "message" in response.error) {
    const message = (response.error as { message?: unknown }).message;
    return typeof message === "string" ? message.slice(0, 240) : undefined;
  }
  return "openrouter_error";
}

async function askHermes(message: string, intel: Awaited<ReturnType<typeof buildStockIntel>>): Promise<OpenRouterChatResult> {
  const apiKey = env("OPENROUTER_API_KEY");
  const model = env("OPENROUTER_MODEL", "deepseek/deepseek-v4-flash");
  if (!apiKey) {
    return { configured: false, ok: false, model, reply: null, error: "OPENROUTER_API_KEY is not configured" };
  }

  const maxTokens = Number(env("OPENROUTER_MAX_TOKENS", "1200"));
  const response = await fetchJson<OpenRouterResponse>("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    timeoutMs: 30000,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "HTTP-Referer": "https://hermes-agent-backend.vercel.app",
      "X-Title": "Hermes Robinhood Chain"
    },
    body: {
      model,
      max_tokens: Number.isFinite(maxTokens) ? Math.min(Math.max(Math.trunc(maxTokens), 256), 4096) : 1200,
      messages: [
        {
          role: "system",
          content: [
            "You are Hermes Agent for Robinhood Chain stock-token execution research.",
            "Use only DATA_PIPELINE_JSON for chain contracts, supporting market context, and calendars.",
            "Your recommendation is about whether to buy, watch, or not buy the Robinhood Chain stock-token. Stooq, SEC EDGAR, GDELT, calendars, and Kalshi are only supporting evidence, never the object of the recommendation.",
            "Kalshi website search pages are not treated as machine-readable source data. Use only the public Trade API records in DATA_PIPELINE_JSON and the local stock-term filter metadata.",
            "Never imply that you can sign or execute a wallet transaction. You only prepare quote payloads.",
            "For quotes, require exact source_asset, target_asset, wallet_address, amount, and chainId 46630.",
            "Every stock has a hermes_decision action: BUY, WATCH, NO_BUY, or CONFIG_NEEDED. Use those actions and evidence instead of inventing investment advice.",
            "When supporting Kalshi yes/no prices exist, explain what they support for the Robinhood Chain buy decision. When no clean Kalshi market exists, recommend NO_BUY or WATCH instead of forcing a buy.",
            "If a source is degraded, say so directly instead of inventing missing data."
          ].join(" ")
        },
        {
          role: "system",
          content: `DATA_PIPELINE_JSON=${JSON.stringify({
            timestamp: intel.timestamp,
            pipeline: intel.pipeline,
            agent_context: intel.agent_context,
            hermes_decision: intel.hermes_decision
          })}`
        },
        { role: "user", content: message }
      ]
    }
  });

  const reply = response.data?.choices?.[0]?.message?.content?.trim() || null;
  if (response.ok && reply) return { configured: true, ok: true, model, reply, status: response.status };
  return {
    configured: true,
    ok: false,
    model,
    reply: null,
    status: response.status,
    error: safeOpenRouterError(response.data) || (response.ok ? "openrouter_empty_response" : "openrouter_request_failed")
  };
}

export async function buildHermesOutput(message = DEFAULT_HERMES_OUTPUT_PROMPT) {
  const intel = await buildStockIntel();
  const chat = await askHermes(message, intel);
  const reply = chat.reply || fallbackReply(intel);
  return {
    reply,
    hermes_decision: intel.hermes_decision,
    data: intel,
    tool_trace: [
      { name: "buildStockIntel", ok: intel.ok, degraded_sources: intel.pipeline.degraded_sources },
      {
        name: "openrouter_chat",
        ok: chat.ok,
        configured: chat.configured,
        model: chat.model,
        status: chat.status,
        error: chat.error
      }
    ]
  };
}
