"use client";

/* eslint-disable @next/next/no-img-element */
import * as React from "react";
import { isAddress } from "viem";

export const CHART_RANGES = [
  { label: "1D", range: "1d", interval: "5m" },
  { label: "1W", range: "5d", interval: "15m" },
  { label: "1M", range: "1mo", interval: "1d" },
  { label: "1Y", range: "1y", interval: "1wk" }
];

const InteractiveStockChart = React.lazy(() =>
  import("./InteractiveStockChart.jsx").then((module) => ({ default: module.InteractiveStockChart }))
);

const SUPPORTED_SWAP_PAYMENT_SYMBOLS = new Set(["WETH"]);
export const FRONTEND_ERC20_ABI = [
  {
    type: "function",
    name: "balanceOf",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "balance", type: "uint256" }]
  },
  {
    type: "function",
    name: "decimals",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "decimals", type: "uint8" }]
  }
];

const stockPresentation = [
  {
    symbol: "TSLA",
    name: "Tesla",
    address: "0xC9f9c86933092BbbfFF3CCb4b105A4A94bf3Bd4E",
    logoText: "T",
    logoUrl: "/logos/tesla.svg",
    logoBg: "#f7eeee",
    logoFg: "#c9252d",
    score: 0
  },
  {
    symbol: "AMZN",
    name: "Amazon",
    address: "0x5884aD2f920c162CFBbACc88C9C51AA75eC09E02",
    logoText: "a",
    logoUrl: "/logos/amazon.svg",
    logoBg: "#fff3d9",
    logoFg: "#111111",
    score: 0
  },
  {
    symbol: "PLTR",
    name: "Palantir",
    address: "0x1FBE1a0e43594b3455993B5dE5Fd0A7A266298d0",
    logoText: "P",
    logoUrl: "/logos/palantir.svg",
    logoBg: "#edf0f4",
    logoFg: "#20242a",
    score: 0
  },
  {
    symbol: "NFLX",
    name: "Netflix",
    address: "0x3b8262A63d25f0477c4DDE23F83cfe22Cb768C93",
    logoText: "N",
    logoUrl: "/logos/netflix.svg",
    logoBg: "#fae8e6",
    logoFg: "#e50914",
    score: 0
  },
  {
    symbol: "AMD",
    name: "Advanced Micro Devices",
    address: "0x71178BAc73cBeb415514eB542a8995b82669778d",
    logoText: "AMD",
    logoUrl: "/logos/amd.svg",
    logoBg: "#eef4ee",
    logoFg: "#0b6b3a",
    score: 0
  }
];

export function Logo({ stock }) {
  const label = stock.name || stock.symbol || "Asset";
  return (
    <span
      className={`logo ${stock.logoUrl ? "image-logo" : ""}`}
      role="img"
      aria-label={`${label} logo`}
      style={{ "--logo-bg": stock.logoBg || "#fff", "--logo-fg": stock.logoFg || "#202621" }}
    >
      {stock.logoUrl ? <img src={stock.logoUrl} alt="" loading="lazy" /> : stock.logoText || stock.symbol.slice(0, 2)}
    </span>
  );
}

export function ChevronDownIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="m6 9 6 6 6-6"></path>
    </svg>
  );
}

export function ChevronLeftIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="m15 18-6-6 6-6"></path>
    </svg>
  );
}

export function ChevronRightIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="m9 18 6-6-6-6"></path>
    </svg>
  );
}

export function sourceHref(value) {
  const match = String(value || "").match(/https?:\/\/[^\s+]+/);
  return match ? match[0] : null;
}

export function ArrowDownIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 5v14"></path>
      <path d="m19 12-7 7-7-7"></path>
    </svg>
  );
}

export function PlusIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M5 12h14"></path>
      <path d="M12 5v14"></path>
    </svg>
  );
}

export function MinusIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M5 12h14"></path>
    </svg>
  );
}

export function XIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M18 6 6 18"></path>
      <path d="m6 6 12 12"></path>
    </svg>
  );
}

export function GithubIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.4 5.4 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4"></path>
      <path d="M9 18c-4.51 2-5-2-7-2"></path>
    </svg>
  );
}

export function MotionAsset({ src, webmSrc, className }) {
  return (
    <video
      className={className}
      autoPlay
      muted
      loop
      playsInline
      preload="metadata"
      aria-hidden="true"
    >
      {webmSrc ? <source src={webmSrc} type="video/webm" /> : null}
      {src ? <source src={src} type="video/mp4" /> : null}
    </video>
  );
}

export function splitReasoningText(value) {
  const text = String(value || "").trim();
  if (!text) return [];
  return text
    .split(/(?:\n+|;\s+|\.\s+| · )/)
    .map((part) => part.trim().replace(/\.$/, ""))
    .filter(Boolean)
    .slice(0, 5);
}

export function formatReadableDate(value) {
  if (!value) return "";
  const match = String(value).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return "";
  const [, year, month, day] = match;
  const date = new Date(Number(year), Number(month) - 1, Number(day));
  if (Number.isNaN(date.getTime())) return String(value);
  const monthName = date.toLocaleDateString("en-US", { month: "long" }).toLowerCase();
  return `${Number(day)} ${monthName} ${year}`;
}

export function formatReadableDateText(value) {
  return String(value || "").replace(/\b(\d{4})-(\d{2})-(\d{2})\b/g, (match) => formatReadableDate(match));
}

export function shortenAddress(value) {
  return value ? `${value.slice(0, 6)}...${value.slice(-4)}` : "";
}

export function toBigIntValue(value) {
  if (value === undefined || value === null || value === "" || value === "0" || value === "0x0") return undefined;
  if (typeof value === "bigint") return value;
  if (typeof value === "number" && Number.isFinite(value)) return BigInt(Math.trunc(value));
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  try {
    if (/^0x[0-9a-fA-F]+$/.test(trimmed) || /^\d+$/.test(trimmed)) return BigInt(trimmed);
  } catch {
    return undefined;
  }
  return undefined;
}

export function swapPaymentTokens(tokens) {
  return (tokens || []).filter((token) => SUPPORTED_SWAP_PAYMENT_SYMBOLS.has(String(token.symbol || "").toUpperCase()));
}

export function formatTokenUnits(rawValue, decimals = 18, maxFractionDigits = 6) {
  const value = toBigIntValue(rawValue);
  if (value === undefined) return null;
  const parsedDecimals = Number(decimals);
  const safeDecimals = Number.isInteger(parsedDecimals) && parsedDecimals >= 0 ? parsedDecimals : 18;
  const scale = 10n ** BigInt(safeDecimals);
  const whole = value / scale;
  const fraction = value % scale;
  if (fraction === 0n) return whole.toString();

  const padded = fraction.toString().padStart(safeDecimals, "0");
  const trimmed = padded.slice(0, maxFractionDigits).replace(/0+$/, "");
  return trimmed ? `${whole}.${trimmed}` : whole.toString();
}

export function quoteOutputDisplay(quote, targetSymbol) {
  const payload = quote?.quote;
  if (!quote?.ok || !payload?.amount_out) return null;
  const amount = formatTokenUnits(payload.amount_out, payload.output_decimals);
  return amount ? `${amount} ${payload.output_asset || targetSymbol || ""}`.trim() : null;
}

export function quoteOutputParts(quote, targetSymbol) {
  const payload = quote?.quote;
  if (!quote?.ok || !payload?.amount_out) return null;
  const amount = formatTokenUnits(payload.amount_out, payload.output_decimals);
  if (!amount) return null;
  return { amount, asset: payload.output_asset || targetSymbol || "" };
}

export function normalizeTransactionRequest(value, fallbackLabel) {
  if (!value || typeof value !== "object") return null;
  const request = value.transactionRequest || value.request || value.tx || value;
  const to = request.to || request.toAddress || request.target || request.router || request.routerAddress;
  if (!to || !isAddress(to)) return null;

  const data = request.data || request.callData || request.calldata || request.input;
  const transaction = {
    label: request.label || request.type || fallbackLabel || "Transaction",
    to,
    data: typeof data === "string" && data ? data : undefined,
    value: toBigIntValue(request.value || request.valueWei || request.nativeValue),
    gas: toBigIntValue(request.gas || request.gasLimit)
  };

  if (!transaction.data && !transaction.value) return null;
  return transaction;
}

export function extractTransactionRequests(payload) {
  const transactions = [];
  const seenObjects = new Set();
  const seenTransactions = new Set();

  function visit(value, label = "Transaction", depth = 0) {
    if (!value || depth > 7) return;
    if (Array.isArray(value)) {
      value.forEach((item, index) => visit(item, `${label} ${index + 1}`, depth + 1));
      return;
    }
    if (typeof value !== "object" || seenObjects.has(value)) return;
    seenObjects.add(value);

    const transaction = normalizeTransactionRequest(value, label);
    if (transaction) {
      const key = `${transaction.to}:${transaction.data || ""}:${transaction.value?.toString() || "0"}`;
      if (!seenTransactions.has(key)) {
        seenTransactions.add(key);
        transactions.push(transaction);
      }
    }

    for (const [key, nested] of Object.entries(value)) {
      if (/abi|logs?|stock_universe/i.test(key)) continue;
      const nextLabel = /approve|allowance/i.test(key)
        ? "Approval"
        : /swap|trade|execute|transaction|tx/i.test(key)
        ? "Swap"
        : label;
      visit(nested, nextLabel, depth + 1);
    }
  }

  visit(payload);
  return transactions;
}

export function TokenButton({ token, placeholder, onClick, accent }) {
  return (
    <button className={`swap-token-button ${accent ? "accent" : ""}`} type="button" onClick={onClick}>
      {token ? <Logo stock={token} /> : null}
      <span>{token ? token.symbol : placeholder}</span>
      <ChevronDownIcon />
    </button>
  );
}

export function TokenPicker({ open, title, items, selectedSymbol, onSelect, onClose }) {
  React.useEffect(() => {
    if (!open) return undefined;

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <section className="token-picker-panel" aria-label={title}>
      <div className="token-list" role="listbox" aria-label={title}>
        {items.map((item) => {
          const active = item.symbol === selectedSymbol;
          return (
            <button className={`token-row ${active ? "active" : ""}`} type="button" role="option" aria-selected={active} key={item.address || item.symbol} onClick={() => onSelect(item)}>
              <Logo stock={item} />
              <span className="token-row-symbol">{item.symbol}</span>
              <span className={`token-change ${(item.score || 0) >= 68 ? "up" : ""}`}>{item.score ? `▲ ${(item.score / 100).toFixed(2)}%` : "0.00%"}</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

export function StockChartView({ data, ticker, status, selectedRange }) {
  return data?.length ? (
    <div className="chart-shell">
      <React.Suspense fallback={<div className="chart-fallback" />}>
        <InteractiveStockChart chartData={data} ticker={ticker} selectedRange={selectedRange} key={`${ticker}-${selectedRange}-${data.length}`} />
      </React.Suspense>
    </div>
  ) : (
    <div className="chart-fallback chart-state">
      {status === "loading" ? "Loading chart" : "Chart unavailable from Yahoo."}
    </div>
  );
}

export function ChartRangeControls({ selectedRange, onRangeChange }) {
  return (
    <div className="chart-range-controls" aria-label="Chart range">
      {CHART_RANGES.map((item) => (
        <button
          className={selectedRange === item.label ? "active" : ""}
          type="button"
          key={item.label}
          onClick={() => onRangeChange(item.label)}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}

export function MiniStockChart({ data }) {
  const points = React.useMemo(() => {
    const closes = (data || []).slice(-24).map((item) => Number(item.close)).filter(Number.isFinite);
    if (closes.length < 2) return "";
    const min = Math.min(...closes);
    const max = Math.max(...closes);
    const range = max - min || 1;
    return closes
      .map((value, index) => {
        const x = (index / (closes.length - 1)) * 86 + 2;
        const y = 30 - ((value - min) / range) * 24 + 3;
        return `${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(" ");
  }, [data]);

  return (
    <svg className="mini-stock-chart" viewBox="0 0 90 36" aria-hidden="true">
      {points ? <polyline points={points} /> : <line x1="4" y1="24" x2="86" y2="24" />}
    </svg>
  );
}

const SCORE_RADIAL_SEGMENTS = Array.from({ length: 25 }, (_, index) => index);

function scoreRadialColor(index) {
  if (index < 5) return "var(--primary)";
  const mix = Math.max(5, 100 - Math.floor((index - 3) / 2) * 10);
  return `color-mix(in oklab, var(--primary) ${mix}%, var(--background))`;
}

export function ScoreRadial({ value }) {
  const radius = 72;
  const circumference = 2 * Math.PI * radius;
  const segmentLength = circumference / SCORE_RADIAL_SEGMENTS.length - 3;

  return (
    <svg role="img" className="recharts-surface" width="282" height="180" viewBox="0 0 282 180">
      <title>Hermes confidence {value}%</title>
      <g className="recharts-layer recharts-pie" transform="translate(141 100)">
        {SCORE_RADIAL_SEGMENTS.map((index) => (
          <circle
            key={index}
            className="recharts-sector"
            cx="0"
            cy="0"
            r={radius}
            fill="none"
            stroke={scoreRadialColor(index)}
            strokeWidth="25"
            strokeDasharray={`${segmentLength} ${circumference - segmentLength}`}
            strokeDashoffset={-(index * circumference) / SCORE_RADIAL_SEGMENTS.length}
            transform="rotate(-88)"
          />
        ))}
        <text textAnchor="middle" dominantBaseline="middle">
          <tspan x="0" y="4" className="score-radial-value">{value}%</tspan>
        </text>
      </g>
    </svg>
  );
}

export async function readJsonResponse(response) {
  const contentType = response.headers.get("content-type") || "";
  if (!response.ok || !contentType.includes("application/json")) return null;
  try {
    return await response.json();
  } catch {
    return null;
  }
}

export function decorateStock(item, index, recommendation, price) {
  const presentation = stockPresentation.find((stock) => stock.symbol === item.symbol) || stockPresentation[index % stockPresentation.length] || {};
  return {
    ...item,
    logoText: presentation.logoText || item.symbol.slice(0, 2),
    logoUrl: presentation.logoUrl || item.logoUrl,
    logoBg: presentation.logoBg || "#fff",
    logoFg: presentation.logoFg || "#202621",
    score: recommendation?.confidence || 0,
    bullets: [
      recommendation?.reason,
      recommendation?.next_step,
      price?.ok && price.close ? `Public quote close ${price.close}${price.date ? ` on ${price.date}` : ""}.` : null
    ].filter(Boolean)
  };
}
