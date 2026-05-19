import json
import os
import time
import urllib.error
import urllib.parse
import urllib.request
from typing import Any, Dict, List, Optional

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel


OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"
DEFAULT_MODEL = "deepseek/deepseek-v4-flash"
NUVOLARI_DOCS = {
    "swap": "https://docs.nuvolari.ai/execution-engine/swap.md",
    "yield": "https://docs.nuvolari.ai/execution-engine/yield.md",
    "liquidity": "https://docs.nuvolari.ai/execution-engine/add-liquidity.md",
    "shortcuts": "https://docs.nuvolari.ai/execution-engine/shortcuts.md",
}
CONTEXT7_NUVOLARI = "https://context7.com/websites/nuvolari_ai/llms.txt"

app = FastAPI(title="Hermes Nuvolari Agent")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


class ChatMessage(BaseModel):
    role: str
    content: str


class ChatRequest(BaseModel):
    message: str
    history: List[ChatMessage] = []
    execute: bool = False


def _env(name: str) -> str:
    return os.getenv(name, "").strip()


def _json_request(
    url: str,
    *,
    method: str = "GET",
    headers: Optional[Dict[str, str]] = None,
    body: Optional[Dict[str, Any]] = None,
    timeout: int = 45,
) -> Dict[str, Any]:
    data = None
    req_headers = {"Accept": "application/json", **(headers or {})}
    if body is not None:
        data = json.dumps(body).encode("utf-8")
        req_headers["Content-Type"] = "application/json"
    req = urllib.request.Request(url, data=data, headers=req_headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            raw = resp.read().decode("utf-8", errors="replace")
            try:
                parsed = json.loads(raw)
            except json.JSONDecodeError:
                parsed = {"text": raw}
            return {"ok": True, "status": resp.status, "data": parsed}
    except urllib.error.HTTPError as exc:
        raw = exc.read().decode("utf-8", errors="replace")
        try:
            parsed = json.loads(raw)
        except json.JSONDecodeError:
            parsed = {"text": raw}
        return {"ok": False, "status": exc.code, "data": parsed}
    except Exception as exc:
        return {"ok": False, "status": 0, "error": str(exc)}


def _nuvolari_headers() -> Dict[str, str]:
    api_key = _env("NUVOLARI_API_KEY")
    secret = _env("NUVOLARI_SECRET_API_KEY")
    headers = {
        "User-Agent": "hermes-nuvolari-agent/1.0",
        "X-Nuvolari-Client": "Gary",
    }
    if api_key:
        headers["X-API-Key"] = api_key
        headers["X-Nuvolari-API-Key"] = api_key
    if secret:
        headers["X-API-Secret"] = secret
        headers["X-Nuvolari-API-Secret"] = secret
        headers["Authorization"] = f"Bearer {secret}"
    return headers


def _nuvolari_call(path: str, payload: Dict[str, Any], method: str = "POST") -> Dict[str, Any]:
    base_url = _env("NUVOLARI_API_BASE_URL").rstrip("/")
    if not base_url:
        return {
            "ok": False,
            "needs_configuration": "NUVOLARI_API_BASE_URL",
            "message": (
                "Nuvolari credentials are configured, but the execution API base URL "
                "is not set. Add NUVOLARI_API_BASE_URL in Vercel once Nuvolari gives "
                "you the API host."
            ),
            "intended_request": {"method": method, "path": path, "body": payload},
            "available_docs": NUVOLARI_DOCS,
        }
    path = "/" + path.lstrip("/")
    return _json_request(
        f"{base_url}{path}",
        method=method.upper(),
        headers=_nuvolari_headers(),
        body=payload if method.upper() != "GET" else None,
    )


def nuvolari_swap_quote(
    input_asset: str,
    output_asset: str,
    amount: str,
    input_chain: str = "",
    output_chain: str = "",
    wallet_address: str = "",
    execute: bool = False,
) -> Dict[str, Any]:
    payload = {
        "input_asset": input_asset,
        "output_asset": output_asset,
        "amount": amount,
        "input_chain": input_chain,
        "output_chain": output_chain,
        "wallet_address": wallet_address,
        "execute": bool(execute),
    }
    return _nuvolari_call(_env("NUVOLARI_SWAP_PATH") or "/swap", payload)


def nuvolari_buy_asset(
    asset: str,
    amount: str,
    pay_with_asset: str = "USDC",
    chain: str = "",
    wallet_address: str = "",
    execute: bool = False,
) -> Dict[str, Any]:
    payload = {
        "asset": asset,
        "amount": amount,
        "pay_with_asset": pay_with_asset,
        "chain": chain,
        "wallet_address": wallet_address,
        "execute": bool(execute),
    }
    return _nuvolari_call(_env("NUVOLARI_BUY_PATH") or "/buy", payload)


def nuvolari_yield_opportunities(
    underlying_asset: str,
    risk_profile: str = "balanced",
    min_apy: str = "",
    chain: str = "",
) -> Dict[str, Any]:
    payload = {
        "underlying_asset": underlying_asset,
        "risk_profile": risk_profile,
        "min_apy": min_apy,
        "chain": chain,
    }
    return _nuvolari_call(_env("NUVOLARI_YIELD_PATH") or "/yield/opportunities", payload)


def nuvolari_enter_yield(
    strategy_id: str,
    input_asset: str,
    amount: str,
    wallet_address: str = "",
    execute: bool = False,
) -> Dict[str, Any]:
    payload = {
        "strategy_id": strategy_id,
        "input_asset": input_asset,
        "amount": amount,
        "wallet_address": wallet_address,
        "execute": bool(execute),
    }
    return _nuvolari_call(_env("NUVOLARI_ENTER_YIELD_PATH") or "/yield/enter", payload)


def nuvolari_add_liquidity(
    asset_a: str,
    asset_b: str,
    amount_a: str,
    amount_b: str = "",
    chain: str = "",
    fee_tier: str = "",
    price_range: str = "",
    wallet_address: str = "",
    execute: bool = False,
) -> Dict[str, Any]:
    payload = {
        "asset_a": asset_a,
        "asset_b": asset_b,
        "amount_a": amount_a,
        "amount_b": amount_b,
        "chain": chain,
        "fee_tier": fee_tier,
        "price_range": price_range,
        "wallet_address": wallet_address,
        "execute": bool(execute),
    }
    return _nuvolari_call(_env("NUVOLARI_ADD_LIQUIDITY_PATH") or "/liquidity/add", payload)


def nuvolari_raw_api(method: str, path: str, body: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    return _nuvolari_call(path, body or {}, method=method)


def nuvolari_docs_query(topic: str, question: str) -> Dict[str, Any]:
    url = NUVOLARI_DOCS.get(topic.lower(), NUVOLARI_DOCS["shortcuts"])
    ask_url = f"{url}?ask={urllib.parse.quote(question)}"
    req = urllib.request.Request(ask_url, headers={"Accept": "text/markdown"})
    try:
        with urllib.request.urlopen(req, timeout=20) as resp:
            return {"ok": True, "topic": topic, "answer": resp.read().decode("utf-8", errors="replace")}
    except Exception as exc:
        return {"ok": False, "topic": topic, "error": str(exc), "url": ask_url}


def nuvolari_context7_query(question: str = "") -> Dict[str, Any]:
    req = urllib.request.Request(CONTEXT7_NUVOLARI, headers={"Accept": "text/plain"})
    try:
        with urllib.request.urlopen(req, timeout=20) as resp:
            content = resp.read().decode("utf-8", errors="replace")
        return {
            "ok": True,
            "source": CONTEXT7_NUVOLARI,
            "question": question,
            "content": content[:14000],
            "truncated": len(content) > 14000,
        }
    except Exception as exc:
        return {"ok": False, "source": CONTEXT7_NUVOLARI, "error": str(exc)}


TOOL_HANDLERS = {
    "nuvolari_swap_quote": nuvolari_swap_quote,
    "nuvolari_buy_asset": nuvolari_buy_asset,
    "nuvolari_yield_opportunities": nuvolari_yield_opportunities,
    "nuvolari_enter_yield": nuvolari_enter_yield,
    "nuvolari_add_liquidity": nuvolari_add_liquidity,
    "nuvolari_raw_api": nuvolari_raw_api,
    "nuvolari_docs_query": nuvolari_docs_query,
    "nuvolari_context7_query": nuvolari_context7_query,
}

TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "nuvolari_swap_quote",
            "description": "Quote or prepare a Nuvolari swap route across assets/chains. Use execute=false unless the user explicitly asks to execute.",
            "parameters": {
                "type": "object",
                "properties": {
                    "input_asset": {"type": "string"},
                    "output_asset": {"type": "string"},
                    "amount": {"type": "string"},
                    "input_chain": {"type": "string"},
                    "output_chain": {"type": "string"},
                    "wallet_address": {"type": "string"},
                    "execute": {"type": "boolean"},
                },
                "required": ["input_asset", "output_asset", "amount"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "nuvolari_buy_asset",
            "description": "Buy an asset through Nuvolari using another asset as payment.",
            "parameters": {
                "type": "object",
                "properties": {
                    "asset": {"type": "string"},
                    "amount": {"type": "string"},
                    "pay_with_asset": {"type": "string"},
                    "chain": {"type": "string"},
                    "wallet_address": {"type": "string"},
                    "execute": {"type": "boolean"},
                },
                "required": ["asset", "amount"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "nuvolari_yield_opportunities",
            "description": "Find Nuvolari risk-adjusted yield opportunities by underlying asset, APY, chain, and risk profile.",
            "parameters": {
                "type": "object",
                "properties": {
                    "underlying_asset": {"type": "string"},
                    "risk_profile": {"type": "string"},
                    "min_apy": {"type": "string"},
                    "chain": {"type": "string"},
                },
                "required": ["underlying_asset"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "nuvolari_enter_yield",
            "description": "Prepare or execute entry into a chosen Nuvolari yield strategy.",
            "parameters": {
                "type": "object",
                "properties": {
                    "strategy_id": {"type": "string"},
                    "input_asset": {"type": "string"},
                    "amount": {"type": "string"},
                    "wallet_address": {"type": "string"},
                    "execute": {"type": "boolean"},
                },
                "required": ["strategy_id", "input_asset", "amount"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "nuvolari_add_liquidity",
            "description": "Prepare or execute a Nuvolari LP position with assets, fee tier, and range.",
            "parameters": {
                "type": "object",
                "properties": {
                    "asset_a": {"type": "string"},
                    "asset_b": {"type": "string"},
                    "amount_a": {"type": "string"},
                    "amount_b": {"type": "string"},
                    "chain": {"type": "string"},
                    "fee_tier": {"type": "string"},
                    "price_range": {"type": "string"},
                    "wallet_address": {"type": "string"},
                    "execute": {"type": "boolean"},
                },
                "required": ["asset_a", "asset_b", "amount_a"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "nuvolari_raw_api",
            "description": "Call a specific Nuvolari API path with authenticated headers when an exact endpoint is known.",
            "parameters": {
                "type": "object",
                "properties": {
                    "method": {"type": "string", "enum": ["GET", "POST", "PUT", "PATCH", "DELETE"]},
                    "path": {"type": "string"},
                    "body": {"type": "object"},
                },
                "required": ["method", "path"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "nuvolari_docs_query",
            "description": "Ask Nuvolari GitBook docs a specific question about swap, yield, liquidity, or shortcuts.",
            "parameters": {
                "type": "object",
                "properties": {
                    "topic": {"type": "string", "enum": ["swap", "yield", "liquidity", "shortcuts"]},
                    "question": {"type": "string"},
                },
                "required": ["topic", "question"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "nuvolari_context7_query",
            "description": "Fetch Nuvolari.ai Context7 LLM documentation context from context7.com/websites/nuvolari_ai.",
            "parameters": {
                "type": "object",
                "properties": {
                    "question": {"type": "string"},
                },
            },
        },
    },
]


SYSTEM_PROMPT = """You are Gary's Nuvolari execution agent.
Use the Nuvolari tools whenever the user asks about swaps, buys, yield, LPs, routes, positions, or execution.
Never invent filled trades. If execute is false or the Nuvolari API base URL is missing, explain what is ready and what config is missing.
Before real execution, require an explicit user confirmation that includes asset, amount, chain, and wallet.
Use nuvolari_context7_query or docs_query when the exact Nuvolari behavior is unclear."""


def _openrouter_chat(messages: List[Dict[str, Any]]) -> Dict[str, Any]:
    api_key = _env("OPENROUTER_API_KEY")
    if not api_key:
        raise HTTPException(status_code=500, detail="OPENROUTER_API_KEY is not configured")
    payload = {
        "model": _env("OPENROUTER_MODEL") or DEFAULT_MODEL,
        "messages": messages,
        "tools": TOOLS,
        "tool_choice": "auto",
        "temperature": 0.2,
    }
    return _json_request(
        OPENROUTER_URL,
        method="POST",
        headers={
            "Authorization": f"Bearer {api_key}",
            "HTTP-Referer": _env("VERCEL_URL") or "https://vercel.app",
            "X-Title": "Hermes Nuvolari Agent",
        },
        body=payload,
        timeout=60,
    )


def _coerce_tool_args(raw: str) -> Dict[str, Any]:
    try:
        parsed = json.loads(raw or "{}")
        return parsed if isinstance(parsed, dict) else {}
    except json.JSONDecodeError:
        return {}


@app.get("/api/health")
def health() -> Dict[str, Any]:
    return {
        "ok": True,
        "model": _env("OPENROUTER_MODEL") or DEFAULT_MODEL,
        "openrouter_configured": bool(_env("OPENROUTER_API_KEY")),
        "nuvolari_credentials_configured": bool(_env("NUVOLARI_API_KEY") and _env("NUVOLARI_SECRET_API_KEY")),
        "nuvolari_base_url_configured": bool(_env("NUVOLARI_API_BASE_URL")),
        "context7_nuvolari": CONTEXT7_NUVOLARI,
    }


@app.post("/api/chat")
def chat(req: ChatRequest) -> JSONResponse:
    messages: List[Dict[str, Any]] = [{"role": "system", "content": SYSTEM_PROMPT}]
    for item in req.history[-12:]:
        if item.role in {"user", "assistant"} and item.content:
            messages.append({"role": item.role, "content": item.content})
    messages.append({"role": "user", "content": req.message})

    tool_trace = []
    for _ in range(6):
        response = _openrouter_chat(messages)
        if not response.get("ok"):
            raise HTTPException(status_code=502, detail=response)
        choice = response["data"]["choices"][0]
        assistant_message = choice["message"]
        messages.append(assistant_message)
        tool_calls = assistant_message.get("tool_calls") or []
        if not tool_calls:
            return JSONResponse(
                {
                    "reply": assistant_message.get("content", ""),
                    "tool_trace": tool_trace,
                    "health": health(),
                    "timestamp": int(time.time()),
                }
            )
        for call in tool_calls:
            fn = call.get("function", {})
            name = fn.get("name", "")
            args = _coerce_tool_args(fn.get("arguments", ""))
            if name in {"nuvolari_swap_quote", "nuvolari_buy_asset", "nuvolari_enter_yield", "nuvolari_add_liquidity"}:
                args["execute"] = bool(args.get("execute")) and bool(req.execute)
            handler = TOOL_HANDLERS.get(name)
            result = handler(**args) if handler else {"ok": False, "error": f"Unknown tool {name}"}
            tool_trace.append({"name": name, "args": {k: v for k, v in args.items() if "key" not in k.lower()}, "result": result})
            messages.append(
                {
                    "role": "tool",
                    "tool_call_id": call.get("id"),
                    "name": name,
                    "content": json.dumps(result),
                }
            )

    return JSONResponse({"reply": "I reached the tool-call limit. Narrow the request and try again.", "tool_trace": tool_trace})


@app.get("/api/docs/{topic}")
def docs(topic: str, ask: str = "") -> Dict[str, Any]:
    if ask:
        return nuvolari_docs_query(topic, ask)
    url = NUVOLARI_DOCS.get(topic.lower())
    if not url:
        raise HTTPException(status_code=404, detail="Unknown docs topic")
    req = urllib.request.Request(url, headers={"Accept": "text/markdown"})
    with urllib.request.urlopen(req, timeout=20) as resp:
        return {"ok": True, "topic": topic, "markdown": resp.read().decode("utf-8", errors="replace")}
