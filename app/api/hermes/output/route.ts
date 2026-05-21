import { buildHermesOutput } from "@/lib/hermes-output";
import { jsonResponse } from "@/lib/env";

export const dynamic = "force-dynamic";

export async function GET() {
  return jsonResponse(await buildHermesOutput());
}
