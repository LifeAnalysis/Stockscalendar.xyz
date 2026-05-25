import { NextResponse } from "next/server";

import { buildEarningsBacktest } from "@/lib/earnings-backtest";
import { robinhoodStockTokens } from "@/lib/robinhood";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const symbol = (searchParams.get("symbol") || "TSLA").trim().toUpperCase();
  const refresh = searchParams.get("refresh") === "1";
  const stock = robinhoodStockTokens.find((item) => item.symbol === symbol);

  if (!stock) {
    return NextResponse.json(
      {
        ok: false,
        error: "unsupported_symbol",
        supported_symbols: robinhoodStockTokens.map((item) => item.symbol)
      },
      { status: 400 }
    );
  }

  const payload = await buildEarningsBacktest(symbol, { refresh });
  return NextResponse.json(payload);
}

