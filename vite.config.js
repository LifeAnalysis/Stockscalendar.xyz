import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const supportedSymbols = new Set(["TSLA", "AMZN", "PLTR", "NFLX", "AMD"]);

function sendJson(res, statusCode, payload) {
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.end(JSON.stringify(payload));
}

async function fetchStockChart(symbol, range = "3mo", interval = "1d") {
  const ticker = String(symbol || "").trim().toUpperCase();
  if (!supportedSymbols.has(ticker)) {
    return { ok: false, symbol: ticker, error: "Unsupported stock symbol" };
  }

  const params = new URLSearchParams({ range, interval });
  const response = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?${params}`);
  if (!response.ok) {
    return { ok: false, symbol: ticker, source: "yahoo_chart", status: response.status };
  }
  const payload = await response.json();
  const result = payload?.chart?.result?.[0];
  const timestamps = result?.timestamp || [];
  const quote = result?.indicators?.quote?.[0] || {};
  const points = timestamps
    .map((timestamp, index) => {
      const close = Number(quote.close?.[index]);
      if (!Number.isFinite(close)) return null;
      const open = Number.isFinite(Number(quote.open?.[index])) ? Number(quote.open[index]) : close;
      const high = Number.isFinite(Number(quote.high?.[index])) ? Number(quote.high[index]) : Math.max(open, close);
      const low = Number.isFinite(Number(quote.low?.[index])) ? Number(quote.low[index]) : Math.min(open, close);
      return {
        date: new Date(timestamp * 1000).toISOString(),
        open,
        high,
        low,
        close
      };
    })
    .filter(Boolean);

  return points.length
    ? { ok: true, symbol: ticker, source: "yahoo_chart", range, interval, points }
    : { ok: false, symbol: ticker, source: "yahoo_chart", error: "Chart data contained no usable OHLC points" };
}

function liveStockDataPlugin() {
  return {
    name: "live-stock-data",
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url?.startsWith("/api/stocks/chart")) {
          next();
          return;
        }

        try {
          const url = new URL(req.url, "http://127.0.0.1");
          const payload = await fetchStockChart(
            url.searchParams.get("symbol"),
            url.searchParams.get("range") || "3mo",
            url.searchParams.get("interval") || "1d"
          );
          sendJson(res, 200, payload);
        } catch (error) {
          sendJson(res, 200, { ok: false, source: "yahoo_chart", error: error.message });
        }
      });
    }
  };
}

export default defineConfig({
  plugins: [react(), liveStockDataPlugin()],
});
