import { buildHermesOutput } from "@/lib/hermes-output";
import { jsonResponse } from "@/lib/env";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  return jsonResponse(
    await buildHermesOutput(undefined, {
      debug: searchParams.get("debug") === "1",
      bypassCache: searchParams.get("cache") === "0"
    })
  );
}
