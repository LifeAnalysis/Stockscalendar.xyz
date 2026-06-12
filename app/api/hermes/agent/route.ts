import { jsonResponse } from "@/lib/env";
import { runHermesAgent } from "@/lib/hermes-agent";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const message = String(body.message || "").trim();
  if (!message) {
    return jsonResponse({
      ok: false,
      needs_input: ["message"],
      message: "Send a Hermes Agent message."
    }, { status: 400 });
  }

  return jsonResponse(
    await runHermesAgent({
      message,
      context: typeof body.context === "object" && body.context ? body.context as Record<string, unknown> : {},
      history: Array.isArray(body.history) ? body.history as Array<{ role?: string; content?: string }> : []
    })
  );
}
