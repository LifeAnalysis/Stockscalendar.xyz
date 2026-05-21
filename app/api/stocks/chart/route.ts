import { NextResponse } from "next/server";

import { fetchYahooChart } from "../../../../lib/stock-signals";
import { robinhoodStockTokens } from "../../../../lib/robinhood";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const symbols = (searchParams.get("symbols") || searchParams.get("symbol") || "")
    .split(",")
    .map((symbol) => symbol.trim().toUpperCase())
    .filter(Boolean);
  const range = searchParams.get("range") || undefined;
  const interval = searchParams.get("interval") || undefined;
  const requested = symbols.length ? symbols : robinhoodStockTokens.map((stock) => stock.symbol);
  const stocks = requested
    .map((symbol) => robinhoodStockTokens.find((stock) => stock.symbol === symbol))
    .filter((stock): stock is (typeof robinhoodStockTokens)[number] => Boolean(stock));

  if (!stocks.length) {
    return NextResponse.json(
      {
        ok: false,
        source: "https://query1.finance.yahoo.com/v8/finance/chart/",
        error: "unsupported_symbol",
        supported_symbols: robinhoodStockTokens.map((stock) => stock.symbol)
      },
      { status: 400 }
    );
  }

  const charts = await Promise.all(stocks.map((stock) => fetchYahooChart(stock, range, interval)));
  return NextResponse.json({
    ok: charts.every((chart) => chart.ok),
    source: "https://query1.finance.yahoo.com/v8/finance/chart/",
    charts
  });
}
