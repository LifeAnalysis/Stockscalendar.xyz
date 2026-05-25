import { jsonResponse } from "@/lib/env";
import { buildStockIntel, compactStockIntel } from "@/lib/intel";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const intel = await buildStockIntel({ bypassCache: searchParams.get("cache") === "0" });
  return jsonResponse(searchParams.get("compact") === "1" ? compactStockIntel(intel) : intel);
}
