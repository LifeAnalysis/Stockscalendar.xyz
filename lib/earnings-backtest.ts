import { env } from "./env";
import { fetchJson } from "./http";
import { KalshiMarket, fetchKalshiMarkets } from "./kalshi";
import { getPostgresPool, isPostgresConfigured } from "./postgres";
import { RobinhoodToken, robinhoodStockTokens } from "./robinhood";
import { ChartPoint, fetchYahooChart } from "./stock-signals";

type GdeltResponse = {
  articles?: Array<{
    title?: string;
    url?: string;
    domain?: string;
    seendate?: string;
  }>;
};

type OpenRouterResponse = {
  choices?: Array<{ message?: { content?: string } }>;
  error?: unknown;
};

export type EarningsBacktestRow = {
  symbol: string;
  earnings_date: string;
  quarter: string;
  price_before?: number;
  price_after?: number;
  move_percent?: number;
  benchmark: "beat" | "miss" | "mixed" | "unknown";
  kalshi: {
    matched: boolean;
    market_count: number;
    top_market?: {
      ticker: string;
      title?: string;
      close_time?: string;
      yes_bid?: string;
      yes_ask?: string;
      no_bid?: string;
      no_ask?: string;
    };
  };
  news: {
    article_count: number;
    top_headlines: string[];
  };
  analysis: string;
  sources: string[];
};

type CacheRow = {
  symbol: string;
  payload: EarningsBacktestRow[];
  source_summary: string;
  updated_at: string;
};

const EARNINGS_DATES: Record<string, string[]> = {
  TSLA: [
    "2020-01-29", "2020-04-29", "2020-07-22", "2020-10-21",
    "2021-01-27", "2021-04-26", "2021-07-26", "2021-10-20",
    "2022-01-26", "2022-04-20", "2022-07-20", "2022-10-19",
    "2023-01-25", "2023-04-19", "2023-07-19", "2023-10-18",
    "2024-01-24", "2024-04-23", "2024-07-23", "2024-10-23",
    "2025-01-29", "2025-04-22", "2025-07-23", "2025-10-22",
    "2026-01-28", "2026-04-22", "2026-07-22", "2026-10-21"
  ],
  AMZN: [
    "2020-01-30", "2020-04-30", "2020-07-30", "2020-10-29",
    "2021-02-02", "2021-04-29", "2021-07-29", "2021-10-28",
    "2022-02-03", "2022-04-28", "2022-07-28", "2022-10-27",
    "2023-02-02", "2023-04-27", "2023-08-03", "2023-10-26",
    "2024-02-01", "2024-04-30", "2024-08-01", "2024-10-31",
    "2025-02-06", "2025-05-01", "2025-07-31", "2025-10-30",
    "2026-02-05", "2026-04-30", "2026-07-30", "2026-10-29"
  ],
  PLTR: [
    "2021-02-16", "2021-05-11", "2021-08-12", "2021-11-09",
    "2022-02-17", "2022-05-09", "2022-08-08", "2022-11-07",
    "2023-02-13", "2023-05-08", "2023-08-07", "2023-11-02",
    "2024-02-05", "2024-05-06", "2024-08-05", "2024-11-04",
    "2025-02-03", "2025-05-05", "2025-08-04", "2025-11-03",
    "2026-02-02", "2026-05-04", "2026-08-03", "2026-11-02"
  ],
  NFLX: [
    "2020-01-21", "2020-04-21", "2020-07-16", "2020-10-20",
    "2021-01-19", "2021-04-20", "2021-07-20", "2021-10-19",
    "2022-01-20", "2022-04-19", "2022-07-19", "2022-10-18",
    "2023-01-19", "2023-04-18", "2023-07-19", "2023-10-18",
    "2024-01-23", "2024-04-18", "2024-07-18", "2024-10-17",
    "2025-01-21", "2025-04-17", "2025-07-17", "2025-10-16",
    "2026-01-20", "2026-04-16", "2026-07-16", "2026-10-15"
  ],
  AMD: [
    "2020-01-28", "2020-04-28", "2020-07-28", "2020-10-27",
    "2021-01-26", "2021-04-27", "2021-07-27", "2021-10-26",
    "2022-02-01", "2022-05-03", "2022-08-02", "2022-11-01",
    "2023-01-31", "2023-05-02", "2023-08-01", "2023-10-31",
    "2024-01-30", "2024-04-30", "2024-07-30", "2024-10-29",
    "2025-02-04", "2025-05-06", "2025-08-05", "2025-11-04",
    "2026-02-03", "2026-05-05", "2026-08-04", "2026-11-03"
  ]
};

const memoryCache = new Map<string, { ts: number; rows: EarningsBacktestRow[] }>();

function backtestCacheMs(): number {
  const hours = Number(env("EARNINGS_BACKTEST_CACHE_HOURS", "24"));
  return (Number.isFinite(hours) ? Math.max(0, hours) : 24) * 60 * 60 * 1000;
}

function previousEarningsDates(symbol: string, today = new Date()): string[] {
  const cutoff = today.toISOString().slice(0, 10);
  return (EARNINGS_DATES[symbol] || [])
    .filter((date) => date >= "2020-01-01" && date < cutoff)
    .sort((a, b) => b.localeCompare(a))
    .slice(0, 3);
}

function quarterLabel(date: string): string {
  const parsed = new Date(`${date}T12:00:00Z`);
  return `Q${Math.floor(parsed.getUTCMonth() / 3) + 1} ${parsed.getUTCFullYear()}`;
}

function addDays(date: string, days: number): string {
  const parsed = new Date(`${date}T12:00:00Z`);
  parsed.setUTCDate(parsed.getUTCDate() + days);
  return parsed.toISOString().slice(0, 10);
}

function gdeltDate(date: string): string {
  return date.replaceAll("-", "") + "000000";
}

function marketText(market: KalshiMarket): string {
  return [
    market.ticker,
    market.event_ticker,
    market.series_ticker,
    market.series_title,
    market.title,
    market.yes_sub_title,
    market.no_sub_title,
    market.rules_primary,
    market.close_time
  ].filter(Boolean).join(" ").toLowerCase();
}

function findPointBefore(data: ChartPoint[], date: string): ChartPoint | undefined {
  return [...data].reverse().find((point) => point.date <= date);
}

function findPointAfter(data: ChartPoint[], date: string): ChartPoint | undefined {
  return data.find((point) => point.date > date) || data.find((point) => point.date >= date);
}

function inferBenchmark(movePercent?: number, newsTitles: string[] = []): EarningsBacktestRow["benchmark"] {
  const newsText = newsTitles.join(" ").toLowerCase();
  if (/\b(beat|beats|tops|strong|record|surge|raises guidance)\b/.test(newsText)) return "beat";
  if (/\b(miss|misses|weak|cuts guidance|falls short|disappoint)\b/.test(newsText)) return "miss";
  if (/\b(mixed|in line)\b/.test(newsText)) return "mixed";
  if (typeof movePercent !== "number") return "unknown";
  if (movePercent >= 2) return "beat";
  if (movePercent <= -2) return "miss";
  return "mixed";
}

async function fetchEventNews(stock: RobinhoodToken, date: string) {
  const params = new URLSearchParams({
    query: `("${stock.name}" OR ${stock.symbol}) earnings`,
    mode: "artlist",
    format: "json",
    maxrecords: env("EARNINGS_BACKTEST_NEWS_MAX_RECORDS", "8"),
    sort: "HybridRel",
    startdatetime: gdeltDate(addDays(date, -2)),
    enddatetime: gdeltDate(addDays(date, 3))
  });
  const response = await fetchJson<GdeltResponse>(`https://api.gdeltproject.org/api/v2/doc/doc?${params.toString()}`, {
    timeoutMs: Number(env("GDELT_TIMEOUT_MS", "3000")) || 3000
  });
  const articles = response.data?.articles || [];
  return {
    ok: response.ok,
    source: "https://api.gdeltproject.org/api/v2/doc/doc",
    article_count: articles.length,
    top_headlines: articles.slice(0, 3).map((article) => article.title || "Untitled article").filter(Boolean),
    urls: articles.slice(0, 3).map((article) => article.url).filter((url): url is string => Boolean(url))
  };
}

function matchKalshiForEvent(markets: KalshiMarket[], stock: RobinhoodToken, date: string) {
  const year = date.slice(0, 4);
  const candidates = markets.filter((market) => {
    const text = marketText(market);
    return (
      (text.includes(stock.symbol.toLowerCase()) || stock.aliases.some((alias) => text.includes(alias.toLowerCase()))) &&
      /earnings|revenue|eps|profit|guidance|close above|stock price/.test(text) &&
      (text.includes(year) || market.close_time?.startsWith(year) || market.expected_expiration_time?.startsWith(year))
    );
  });
  const top = candidates[0];
  return {
    matched: Boolean(top),
    market_count: candidates.length,
    top_market: top
      ? {
          ticker: top.ticker,
          title: top.title,
          close_time: top.close_time || top.expected_expiration_time,
          yes_bid: top.yes_bid_dollars,
          yes_ask: top.yes_ask_dollars,
          no_bid: top.no_bid_dollars,
          no_ask: top.no_ask_dollars
        }
      : undefined
  };
}

async function analyzeWithOpenRouter(stock: RobinhoodToken, rows: Omit<EarningsBacktestRow, "analysis">[]): Promise<string[]> {
  const apiKey = env("OPENROUTER_API_KEY");
  if (!apiKey) {
    return rows.map((row) => `${row.symbol} moved ${typeof row.move_percent === "number" ? `${row.move_percent.toFixed(2)}%` : "n/a"} after ${row.quarter}; benchmark inferred from price/news, no OpenRouter narrative configured.`);
  }
  const response = await fetchJson<OpenRouterResponse>("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    timeoutMs: Number(env("OPENROUTER_TIMEOUT_MS", "45000")) || 45000,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "HTTP-Referer": env("NEXT_PUBLIC_SITE_URL", "https://stockcalendar.xyz"),
      "X-Title": "StockCalendar.xyz Earnings Backtest"
    },
    body: {
      model: env("OPENROUTER_MODEL", "deepseek/deepseek-v4-flash"),
      max_tokens: 900,
      messages: [
        {
          role: "system",
          content: "Return strict JSON only: {\"analyses\":[\"...\"]}. Write one concise sentence per earnings event. Do not invent EPS, revenue, or Kalshi settlement facts that are not present."
        },
        {
          role: "user",
          content: JSON.stringify({
            task: "Analyze the previous three earnings events for a Robinhood Chain supported tokenized stock. Benchmark against price reaction, available Kalshi market evidence, and date-bounded news headlines.",
            stock: { symbol: stock.symbol, name: stock.name },
            rows
          })
        }
      ]
    }
  });
  const content = response.data?.choices?.[0]?.message?.content || "";
  try {
    const parsed = JSON.parse(content) as { analyses?: string[] };
    if (Array.isArray(parsed.analyses) && parsed.analyses.length) return parsed.analyses;
  } catch {
    return rows.map((row) => content || `${row.symbol} ${row.quarter}: analysis unavailable from OpenRouter.`);
  }
  return rows.map((row) => `${row.symbol} ${row.quarter}: analysis unavailable from OpenRouter.`);
}

async function ensureBacktestTable() {
  const pool = await getPostgresPool();
  if (!pool) return null;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS hermes_earnings_backtests (
      symbol text PRIMARY KEY,
      payload jsonb NOT NULL,
      source_summary text NOT NULL,
      updated_at timestamptz NOT NULL DEFAULT now()
    )
  `);
  return pool;
}

async function readCachedBacktest(symbol: string): Promise<EarningsBacktestRow[] | null> {
  const ttlMs = backtestCacheMs();
  const memory = memoryCache.get(symbol);
  if (memory && Date.now() - memory.ts < ttlMs) return memory.rows;
  if (!isPostgresConfigured()) return null;
  const pool = await ensureBacktestTable();
  if (!pool) return null;
  const result = await pool.query<CacheRow>(
    "SELECT symbol, payload, source_summary, updated_at FROM hermes_earnings_backtests WHERE symbol = $1 AND updated_at > now() - ($2::text || ' hours')::interval",
    [symbol, String(Math.max(1, Math.round(ttlMs / 60 / 60 / 1000)))]
  );
  const row = result.rows[0];
  if (!row) return null;
  memoryCache.set(symbol, { ts: Date.now(), rows: row.payload });
  return row.payload;
}

async function writeCachedBacktest(symbol: string, rows: EarningsBacktestRow[]) {
  memoryCache.set(symbol, { ts: Date.now(), rows });
  const pool = await ensureBacktestTable();
  if (!pool) return;
  await pool.query(
    `INSERT INTO hermes_earnings_backtests (symbol, payload, source_summary, updated_at)
     VALUES ($1, $2::jsonb, $3, now())
     ON CONFLICT (symbol) DO UPDATE SET payload = EXCLUDED.payload, source_summary = EXCLUDED.source_summary, updated_at = now()`,
    [symbol, JSON.stringify(rows), "Yahoo chart, GDELT news, Kalshi public markets, OpenRouter analysis"]
  );
}

export async function buildEarningsBacktest(symbol: string, options: { refresh?: boolean } = {}) {
  const normalizedSymbol = symbol.toUpperCase();
  const stock = robinhoodStockTokens.find((item) => item.symbol === normalizedSymbol);
  if (!stock) {
    return {
      ok: false,
      symbol: normalizedSymbol,
      error: "unsupported_symbol",
      supported_symbols: robinhoodStockTokens.map((item) => item.symbol),
      rows: []
    };
  }

  if (!options.refresh) {
    const cached = await readCachedBacktest(stock.symbol);
    if (cached) {
      return { ok: true, symbol: stock.symbol, cached: true, postgres: isPostgresConfigured(), rows: cached };
    }
  }

  const dates = previousEarningsDates(stock.symbol);
  const [chart, newsRows, kalshi] = await Promise.all([
    fetchYahooChart(stock, "2y", "1d"),
    Promise.all(dates.map((date) => fetchEventNews(stock, date))),
    fetchKalshiMarkets()
  ]);

  const rowsWithoutAnalysis = dates.map((date, index): Omit<EarningsBacktestRow, "analysis"> => {
    const before = findPointBefore(chart.data || [], date);
    const after = findPointAfter(chart.data || [], addDays(date, 1));
    const priceBefore = before?.close;
    const priceAfter = after?.close;
    const movePercent = typeof priceBefore === "number" && typeof priceAfter === "number"
      ? ((priceAfter - priceBefore) / priceBefore) * 100
      : undefined;
    const news = newsRows[index];
    const kalshiMatch = matchKalshiForEvent(kalshi.markets || [], stock, date);
    return {
      symbol: stock.symbol,
      earnings_date: date,
      quarter: quarterLabel(date),
      price_before: priceBefore,
      price_after: priceAfter,
      move_percent: typeof movePercent === "number" ? Number(movePercent.toFixed(2)) : undefined,
      benchmark: inferBenchmark(movePercent, news.top_headlines),
      kalshi: kalshiMatch,
      news: {
        article_count: news.article_count,
        top_headlines: news.top_headlines
      },
      sources: [
        chart.source,
        news.source,
        kalshi.source
      ]
    };
  });

  const analyses = await analyzeWithOpenRouter(stock, rowsWithoutAnalysis);
  const rows = rowsWithoutAnalysis.map((row, index) => ({
    ...row,
    analysis: analyses[index] || `${row.symbol} ${row.quarter}: no model analysis returned.`
  }));

  await writeCachedBacktest(stock.symbol, rows);

  return {
    ok: true,
    symbol: stock.symbol,
    cached: false,
    postgres: isPostgresConfigured(),
    source_policy: "Previous 3 supported-stock earnings since 2020; price reaction from Yahoo Chart; news from date-bounded GDELT; Kalshi from public market feed when matching contracts are available.",
    rows
  };
}
