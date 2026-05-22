"use client";

/* eslint-disable @next/next/no-img-element */
import { useAppKit, useAppKitAccount, useAppKitNetwork, useDisconnect } from "@reown/appkit/react";
import * as React from "react";
import { isAddress } from "viem";
import { usePublicClient, useSendTransaction } from "wagmi";
import { earningsEvents } from "./earningsData.js";
import {
  ROBINHOOD_CHAIN_EXPLORER,
  ROBINHOOD_CHAIN_ID,
  isReownConfigured,
  robinhoodChain
} from "./web3/config";

const Dither = React.lazy(() => import("./Dither.jsx"));
const InteractiveStockChart = React.lazy(() =>
  import("./components/InteractiveStockChart.jsx").then((module) => ({ default: module.InteractiveStockChart }))
);

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

function Logo({ stock }) {
  return (
    <span
      className={`logo ${stock.logoUrl ? "image-logo" : ""}`}
      role="img"
      aria-label={`${stock.name} logo`}
      style={{ "--logo-bg": stock.logoBg || "#fff", "--logo-fg": stock.logoFg || "#202621" }}
    >
      {stock.logoUrl ? <img src={stock.logoUrl} alt="" loading="lazy" /> : stock.logoText || stock.symbol.slice(0, 2)}
    </span>
  );
}

function SearchIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="11" cy="11" r="7"></circle>
      <path d="m16.5 16.5 4 4"></path>
    </svg>
  );
}

function ChevronDownIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="m6 9 6 6 6-6"></path>
    </svg>
  );
}

function ArrowDownIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 5v14"></path>
      <path d="m19 12-7 7-7-7"></path>
    </svg>
  );
}

function shortenAddress(value) {
  return value ? `${value.slice(0, 6)}...${value.slice(-4)}` : "";
}

function toBigIntValue(value) {
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

function normalizeTransactionRequest(value, fallbackLabel) {
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

function extractTransactionRequests(payload) {
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

function TokenButton({ token, placeholder, onClick, accent }) {
  return (
    <button className={`swap-token-button ${accent ? "accent" : ""}`} type="button" onClick={onClick}>
      {token ? <Logo stock={token} /> : null}
      <span>{token ? token.symbol : placeholder}</span>
      <ChevronDownIcon />
    </button>
  );
}

function TokenPicker({ open, title, items, selectedSymbol, onSelect, onClose }) {
  const [query, setQuery] = React.useState("");
  const modalRef = React.useRef(null);

  React.useEffect(() => {
    if (open) setQuery("");
  }, [open]);

  React.useEffect(() => {
    if (!open) return undefined;

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        onClose();
        return;
      }

      if (event.key !== "Tab" || !modalRef.current) return;
      const focusable = modalRef.current.querySelectorAll("button, input");
      if (!focusable.length) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  const filtered = items.filter((item) => {
    const haystack = `${item.symbol} ${item.name} ${item.address}`.toLowerCase();
    return haystack.includes(query.trim().toLowerCase());
  });

  return (
    <div className="token-modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section ref={modalRef} className="token-modal" role="dialog" aria-modal="true" aria-label={title} onMouseDown={(event) => event.stopPropagation()}>
        <div className="token-modal-head">
          <h3>{title}</h3>
          <button className="icon-button" type="button" aria-label="Close token picker" onClick={onClose}>×</button>
        </div>
        <label className="token-search">
          <SearchIcon />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search token or paste address" autoFocus />
        </label>
        <div className="token-list" role="listbox" aria-label={title}>
          {filtered.map((item) => {
            const active = item.symbol === selectedSymbol;
            return (
              <button className={`token-row ${active ? "active" : ""}`} type="button" role="option" aria-selected={active} key={item.address || item.symbol} onClick={() => onSelect(item)}>
                <Logo stock={item} />
                <span className="token-row-main">
                  <strong>{item.name}</strong>
                  <span>{item.symbol}</span>
                </span>
                <span className={`token-change ${(item.score || 0) >= 68 ? "up" : ""}`}>{item.score ? `▲ ${(item.score / 100).toFixed(2)}%` : "0.00%"}</span>
              </button>
            );
          })}
        </div>
      </section>
    </div>
  );
}

function StockChartView({ data, ticker, status }) {
  return data?.length ? (
    <React.Suspense fallback={<div className="chart-fallback" />}>
      <InteractiveStockChart chartData={data} ticker={ticker} />
    </React.Suspense>
  ) : (
    <div className="chart-fallback chart-state">
      {status === "loading" ? "Loading Yahoo chart..." : "Chart unavailable from Yahoo."}
    </div>
  );
}

function MiniStockChart({ data }) {
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

async function readJsonResponse(response) {
  const contentType = response.headers.get("content-type") || "";
  if (!response.ok || !contentType.includes("application/json")) return null;
  try {
    return await response.json();
  } catch {
    return null;
  }
}

function decorateStock(item, index, recommendation, price) {
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

function HermesOutputBar({ stock, hermesOutput }) {
  const score = Math.max(0, Math.min(stock.score || 0, 100));
  const decision = hermesOutput?.hermes_decision?.stocks?.find((item) => item.symbol === stock.symbol);
  const stance = decision?.action || (score >= 72 ? "WATCH" : score >= 64 ? "WATCH" : "NO_BUY");
  return (
    <div className="cn-card score-card">
      <div className="cn-card-content">
        <div className="score-head">
          <div>
            <span className="text-muted-foreground text-sm">Hermes agent output</span>
            <strong>{decision ? `${decision.confidence}%` : `${score}/100`}</strong>
          </div>
          <span>{stance}</span>
        </div>
        <div className="score-meter" aria-label={`Hermes confidence ${decision?.confidence || score} out of 100`}>
          <div style={{ width: `${decision?.confidence || score}%` }}></div>
        </div>
        <div className="score-note">
          {decision?.reason || hermesOutput?.reply || `${stock.symbol} selected. Contract is ready for Robinhood testnet quote prep.`}
        </div>
      </div>
    </div>
  );
}

function formatNumber(value) {
  if (value === undefined || value === null || value === "") return "n/a";
  const number = Number(value);
  return Number.isFinite(number) ? number.toLocaleString("en-US") : String(value);
}

function formatMoney(value) {
  if (value === undefined || value === null || value === "") return "n/a";
  const number = Number(value);
  return Number.isFinite(number) ? `$${number.toLocaleString("en-US")}` : String(value);
}

function formatConfidence(value) {
  if (value === undefined || value === null || value === "") return "No score";
  const number = Number(value);
  return Number.isFinite(number) ? `${number}/100 confidence` : `${value} confidence`;
}

function formatEarningsDate(value) {
  if (!value) return "n/a";
  const date = new Date(`${value}T12:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function earningsSummary(symbol) {
  const today = dateKey(new Date());
  const events = earningsEvents.filter((event) => event.symbol === symbol).sort((a, b) => a.date.localeCompare(b.date));
  const latest = [...events].reverse().find((event) => event.date <= today);
  const next = events.find((event) => event.date > today);
  return { latest, next };
}

function HermesDataTable({ stocks, hermesOutput }) {
  const intel = hermesOutput?.data;
  const calendars = new Map((intel?.calendars || []).map((item) => [item.symbol, item]));
  const prices = new Map((intel?.stock_signals?.prices || []).map((item) => [item.symbol, item]));
  const filings = new Map((intel?.stock_signals?.filings || []).map((item) => [item.symbol, item]));
  const news = new Map((intel?.stock_signals?.news || []).map((item) => [item.symbol, item]));
  const decisionRows = hermesOutput?.hermes_decision?.stocks || intel?.hermes_decision?.stocks || [];
  const decisions = new Map(decisionRows.map((item) => [item.symbol, item]));
  const kalshi = new Map((intel?.kalshi?.stocks || []).map((item) => [item.stock?.symbol, item]));

  return (
    <section className="panel hermes-data-section" aria-label="Hermes stock data table">
      <div className="hermes-table-wrap">
        <table className="hermes-data-table">
          <thead>
            <tr>
              <th>Stock</th>
              <th>Earnings</th>
              <th>Hermes</th>
              <th>Latest quote</th>
              <th>SEC filing</th>
              <th>News</th>
              <th>Kalshi</th>
            </tr>
          </thead>
          <tbody>
            {stocks.map((stock) => {
              const calendar = calendars.get(stock.symbol);
              const price = prices.get(stock.symbol);
              const filing = filings.get(stock.symbol);
              const latestFiling = filing?.latest_material || decisions.get(stock.symbol)?.latest_filing;
              const newsRow = news.get(stock.symbol);
              const decision = decisions.get(stock.symbol);
              const kalshiRow = kalshi.get(stock.symbol);
              const topMarket = kalshiRow?.markets?.[0];
              const earnings = earningsSummary(stock.symbol);
              const backendDate = calendar?.earnings_dates?.[0];
              const nextEarnings = backendDate || earnings.next?.date;
              const latestEarnings = earnings.latest?.date;
              const estimates = [
                calendar?.estimates?.earnings_average ? `EPS ${calendar.estimates.earnings_average}` : null,
                calendar?.estimates?.revenue_average ? `Rev ${calendar.estimates.revenue_average}` : null
              ].filter(Boolean).join(" / ");
              const topArticles = (newsRow?.top_articles || []).slice(0, 2);

              return (
                <tr key={stock.symbol}>
                  <td>
                    <div className="table-stock">
                      <Logo stock={stock} />
                      <span>{stock.symbol}</span>
                    </div>
                  </td>
                  <td>
                    <div>{nextEarnings ? `Next ${formatEarningsDate(nextEarnings)}` : "No upcoming date"}</div>
                    <small>{latestEarnings ? `Last ${formatEarningsDate(latestEarnings)}` : "No 2020+ history"}{estimates ? ` · ${estimates}` : ""}</small>
                  </td>
                  <td>
                    <div>{decision?.action || "n/a"}</div>
                    <small>{formatConfidence(decision?.confidence)}</small>
                  </td>
                  <td>
                    <div>{price?.ok ? formatMoney(price.close) : "n/a"}</div>
                    <small>{price?.ok ? `${formatNumber(price.volume)} vol · ${price.date || "no date"}` : price?.error || "No quote"}</small>
                  </td>
                  <td>
                    {latestFiling?.document_url ? (
                      <a href={latestFiling.document_url} target="_blank" rel="noreferrer">{latestFiling.form}</a>
                    ) : (
                      <span>{latestFiling?.form || "n/a"}</span>
                    )}
                    <small>{latestFiling?.filing_date || filing?.error || "No filing"}</small>
                  </td>
                  <td>
                    <div>{newsRow?.article_count ?? decision?.news_count ?? 0} articles</div>
                    <small>
                      {topArticles.length
                        ? topArticles.map((article) => article.title).join(" | ")
                        : newsRow?.error || "No recent articles"}
                    </small>
                  </td>
                  <td>
                    <div>
                      {topMarket
                        ? `YES ${topMarket.yes_bid_dollars || "n/a"}/${topMarket.yes_ask_dollars || "n/a"}`
                        : "No match"}
                    </div>
                    <small>
                      {topMarket
                        ? `NO ${topMarket.no_bid_dollars || "n/a"}/${topMarket.no_ask_dollars || "n/a"} · ${topMarket.ticker}`
                      : `${kalshiRow?.match_count || 0} matched markets`}
                    </small>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function dateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function monthStart(date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function addMonths(date, amount) {
  return new Date(date.getFullYear(), date.getMonth() + amount, 1);
}

function monthTitle(date) {
  return date.toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

function buildCalendarDays(monthDate) {
  const first = monthStart(monthDate);
  const start = new Date(first);
  start.setDate(first.getDate() - first.getDay());
  return Array.from({ length: 42 }, (_, index) => {
    const day = new Date(start);
    day.setDate(start.getDate() + index);
    return day;
  });
}

function EarningsCalendar({ events, stocks, monthDate, onMonthChange }) {
  const supported = React.useMemo(() => new Map(stocks.map((item) => [item.symbol, item])), [stocks]);
  const eventsByDate = React.useMemo(() => {
    const grouped = new Map();
    events
      .filter((event) => supported.has(event.symbol))
      .filter((event) => event.date >= "2020-01-01")
      .forEach((event) => {
        const group = grouped.get(event.date) || [];
        group.push(event);
        grouped.set(event.date, group);
      });
    return grouped;
  }, [events, supported]);
  const today = new Date();
  const days = buildCalendarDays(monthDate);
  const weekdayLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  return (
    <section className="earnings-calendar" aria-label="Supported stock earnings calendar">
      <div className="earnings-calendar-toolbar">
        <button type="button" onClick={() => onMonthChange(monthStart(today))}>Today</button>
        <button className="calendar-icon-button" type="button" aria-label="Previous month" onClick={() => onMonthChange(addMonths(monthDate, -1))}>‹</button>
        <button className="calendar-icon-button" type="button" aria-label="Next month" onClick={() => onMonthChange(addMonths(monthDate, 1))}>›</button>
        <h3>{monthTitle(monthDate)}</h3>
        <span className="calendar-view-chip">Month</span>
      </div>
      <div className="earnings-calendar-weekdays">
        {weekdayLabels.map((label) => <span key={label}>{label}</span>)}
      </div>
      <div className="earnings-calendar-grid">
        {days.map((day) => {
          const key = dateKey(day);
          const inMonth = day.getMonth() === monthDate.getMonth();
          const isToday = key === dateKey(today);
          const dayEvents = eventsByDate.get(key) || [];
          return (
            <div className={`earnings-day ${inMonth ? "" : "outside"} ${isToday ? "today" : ""}`} key={key}>
              <div className="earnings-day-number">{day.getDate()}</div>
              <div className="earnings-day-events">
                {dayEvents.map((event) => {
                  const eventStock = supported.get(event.symbol);
                  return (
                    <div className={`earnings-event ${event.symbol.toLowerCase()}`} key={`${event.symbol}-${event.date}`}>
                      {eventStock ? <Logo stock={eventStock} /> : null}
                      <span>{event.symbol}</span>
                      <small>Earnings</small>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function App() {
  const { open } = useAppKit();
  const { address, isConnected } = useAppKitAccount({ namespace: "eip155" });
  const { chainId, switchNetwork } = useAppKitNetwork();
  const { disconnect } = useDisconnect();
  const publicClient = usePublicClient({ chainId: ROBINHOOD_CHAIN_ID });
  const { sendTransactionAsync, isPending: walletPending } = useSendTransaction();

  const [selected, setSelected] = React.useState("TSLA");
  const [side, setSide] = React.useState("buy");
  const [stocks, setStocks] = React.useState([]);
  const [payTokens, setPayTokens] = React.useState([]);
  const [payTokenSymbol, setPayTokenSymbol] = React.useState("USDG");
  const [amount, setAmount] = React.useState("");
  const [tokenPicker, setTokenPicker] = React.useState(null);
  const [backend, setBackend] = React.useState({ health: false, intel: false, trade: false });
  const [hermesOutput, setHermesOutput] = React.useState(null);
  const [charts, setCharts] = React.useState({});
  const [chartStatus, setChartStatus] = React.useState("idle");
  const [calendarMonth, setCalendarMonth] = React.useState(() => monthStart(new Date()));
  const [quote, setQuote] = React.useState(null);
  const [quoteTransactions, setQuoteTransactions] = React.useState([]);
  const [tradeStatus, setTradeStatus] = React.useState("");
  const [tradeError, setTradeError] = React.useState("");
  const [txHashes, setTxHashes] = React.useState([]);
  const [isPreparingQuote, setIsPreparingQuote] = React.useState(false);
  const [isExecutingQuote, setIsExecutingQuote] = React.useState(false);

  const stock = stocks.find((item) => item.symbol === selected);
  const payToken = payTokens.find((token) => token.symbol === payTokenSymbol) || payTokens[0];
  const sourceToken = side === "sell" ? stock : payToken;
  const targetToken = side === "sell" ? payToken : stock;
  const amountNumber = Number(amount || 0);
  const selectedScore = stock ? stock.score : 0;
  const estimatedOutput = stock && amountNumber > 0 ? (amountNumber / Math.max(stock.score, 1)).toFixed(6) : "0";
  const selectedChartData = stock ? charts[stock.symbol] || [] : [];
  const wallet = address || "";
  const connectedToRobinhood = Number(chainId) === ROBINHOOD_CHAIN_ID;
  const tradeBusy = isPreparingQuote || isExecutingQuote || walletPending;

  const loadYahooCharts = React.useCallback(async (symbols) => {
    if (!symbols.length) {
      setCharts({});
      setChartStatus("idle");
      return;
    }
    setChartStatus("loading");
    try {
      const res = await fetch(`/api/stocks/chart?symbols=${encodeURIComponent(symbols.join(","))}`);
      const payload = await readJsonResponse(res);
      const entries = (payload?.charts || [])
        .filter((chart) => chart.ok && chart.data?.length)
        .map((chart) => [chart.symbol, chart.data]);
      setCharts(Object.fromEntries(entries));
      setChartStatus(entries.length ? "ready" : "error");
    } catch (error) {
      console.warn("Yahoo chart API unavailable", error);
      setCharts({});
      setChartStatus("error");
    }
  }, []);

  React.useEffect(() => {
    async function loadBackend() {
      const nextBackend = { health: false, intel: false, trade: false };
      try {
        const healthRes = await fetch("/api/health");
        const health = await readJsonResponse(healthRes);
        nextBackend.health = Boolean(health);
        if (health) {
          nextBackend.trade = Boolean(health.robinhood_chain && health.robinhood_chain.stock_trade_tool);
        }
      } catch (error) {
        console.warn("Health API unavailable", error);
      }

      try {
        const stockRes = await fetch("/api/robinhood/stocks");
        const catalog = await readJsonResponse(stockRes);
        const loadedStocks = catalog?.stocks || [];
        const loadedTokens = catalog?.payment_tokens || [];
        if (loadedStocks.length) {
          const nextStocks = loadedStocks.map((item, index) => decorateStock(item, index));
          setStocks(nextStocks);
          if (!nextStocks.some((item) => item.symbol === selected)) setSelected(nextStocks[0]?.symbol || "");
        }
        if (loadedTokens.length) {
          setPayTokens(loadedTokens);
          if (!loadedTokens.some((token) => token.symbol === payTokenSymbol)) setPayTokenSymbol(loadedTokens[0]?.symbol || "");
        }
      } catch (error) {
        console.warn("Robinhood stock API unavailable", error);
      }

      try {
        const outputRes = await fetch("/api/hermes/output");
        const output = await readJsonResponse(outputRes);
        const intel = output?.data;
        if (output) setHermesOutput(output);
        if (intel) {
          const recommendations = new Map((intel.recommendations || []).map((item) => [item.symbol, item]));
          const prices = new Map((intel.stock_signals?.prices || []).map((item) => [item.symbol, item]));
          const loadedStocks = intel.robinhood_chain?.stocks || [];
          const loadedTokens = intel.robinhood_chain?.payment_tokens || [];
          if (loadedStocks.length) {
            const nextStocks = loadedStocks.map((item, index) => {
              const recommendation = recommendations.get(item.symbol);
              const price = prices.get(item.symbol);
              return decorateStock(item, index, recommendation, price);
            });
            setStocks(nextStocks);
            nextBackend.intel = true;
          }
          if (loadedTokens.length) setPayTokens(loadedTokens);
        }
      } catch (error) {
        console.warn("Stock intel unavailable", error);
      }
      setBackend(nextBackend);
    }
    loadBackend();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  React.useEffect(() => {
    loadYahooCharts(stocks.map((item) => item.symbol));
  }, [loadYahooCharts, stocks]);

  React.useEffect(() => {
    setQuote(null);
    setQuoteTransactions([]);
    setTxHashes([]);
    setTradeStatus("");
    setTradeError("");
  }, [selected, payTokenSymbol, side, amount]);

  function routePayload() {
    if (!stock || !payToken) return null;
    const isSell = side === "sell";
    return {
      action: side,
      source_asset: isSell ? stock.address : payToken.address,
      target_asset: isSell ? payToken.address : stock.address,
      amount: amount.trim(),
      wallet_address: wallet,
      provider: "auto",
      strategy: `Hermes Robinhood Chain ${side} route for ${stock.symbol}`
    };
  }

  async function connectWallet() {
    if (!isReownConfigured) {
      setTradeError("Set NEXT_PUBLIC_REOWN_PROJECT_ID before connecting a wallet.");
      return;
    }
    setTradeError("");
    await open({ view: "Connect", namespace: "eip155" });
  }

  async function switchToRobinhood() {
    setTradeError("");
    setTradeStatus("Requesting Robinhood Chain in wallet...");
    await switchNetwork(robinhoodChain);
  }

  async function executeQuoteTransactions() {
    if (!quoteTransactions.length) {
      setTradeError("Quote did not include an executable wallet transaction.");
      return;
    }
    setIsExecutingQuote(true);
    setTradeError("");
    setTxHashes([]);
    try {
      const hashes = [];
      for (const transaction of quoteTransactions) {
        setTradeStatus(`Waiting for wallet signature: ${transaction.label}`);
        const hash = await sendTransactionAsync({
          to: transaction.to,
          data: transaction.data,
          value: transaction.value,
          gas: transaction.gas,
          chainId: ROBINHOOD_CHAIN_ID
        });
        hashes.push(hash);
        setTxHashes([...hashes]);
        setTradeStatus(`Confirming ${transaction.label}...`);
        if (publicClient) await publicClient.waitForTransactionReceipt({ hash });
      }
      setTradeStatus("Swap transaction confirmed on Robinhood Chain.");
      setQuoteTransactions([]);
    } catch (error) {
      setTradeError(error?.shortMessage || error?.message || "Wallet transaction failed.");
    } finally {
      setIsExecutingQuote(false);
    }
  }

  async function copy(value) {
    try {
      await navigator.clipboard.writeText(value);
    } catch (error) {
      console.warn("Clipboard copy failed", error);
    }
  }

  async function submitTrade(event) {
    event.preventDefault();
    if (!isConnected) {
      await connectWallet();
      return;
    }
    if (!connectedToRobinhood) {
      await switchToRobinhood();
      return;
    }
    if (quoteTransactions.length) {
      await executeQuoteTransactions();
      return;
    }

    const payload = routePayload();
    if (!payload) {
      setTradeError("Select a stock before preparing a quote.");
      return;
    }
    if (!payload.wallet_address || !payload.amount) {
      setTradeError("Connect wallet and enter an amount to prepare a Nuvolari quote.");
      return;
    }
    setIsPreparingQuote(true);
    setTradeError("");
    setTradeStatus("Preparing Nuvolari quote...");
    try {
      const res = await fetch("/api/robinhood/trade", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const payload = await readJsonResponse(res);
      if (!res.ok || !payload) {
        setTradeError(`Quote request failed with status ${res.status}.`);
        return;
      }
      if (payload.ok === false) {
        setQuote(payload);
        setQuoteTransactions([]);
        setTradeError(payload.message || payload.error || "Quote request was rejected.");
        return;
      }
      const transactions = extractTransactionRequests(payload);
      setQuote(payload);
      setQuoteTransactions(transactions);
      setTradeStatus(
        transactions.length
          ? `Quote ready. ${transactions.length === 1 ? "Sign the swap transaction" : `Sign ${transactions.length} wallet transactions`}.`
          : "Quote prepared, but the response did not include an executable wallet transaction."
      );
    } catch (error) {
      setTradeError(`Quote request failed: ${error.message}`);
    } finally {
      setIsPreparingQuote(false);
    }
  }

  function submitLabel() {
    if (!isReownConfigured) return "Add Reown project ID";
    if (!isConnected) return "Connect wallet";
    if (!connectedToRobinhood) return "Switch to Robinhood";
    if (isPreparingQuote) return "Preparing quote";
    if (isExecutingQuote || walletPending) return "Waiting for wallet";
    if (quoteTransactions.length) return quoteTransactions.length === 1 ? "Sign swap" : `Sign ${quoteTransactions.length} txs`;
    return "Prepare quote";
  }

  function selectToken(kind, item) {
    if (kind === "stock") setSelected(item.symbol);
    if (kind === "pay") setPayTokenSymbol(item.symbol);
    setTokenPicker(null);
  }

  return (
    <>
      <div className="app-dither-background" aria-hidden="true">
        <React.Suspense fallback={null}>
          <Dither
            waveColor={[0.8, 1, 0]}
            disableAnimation={false}
            enableMouseInteraction
            mouseRadius={0.2}
            colorNum={4.9}
            waveAmplitude={0.3}
            waveFrequency={3}
            waveSpeed={0.05}
          />
        </React.Suspense>
      </div>
      <header className="topbar">
        <div className="topbar-inner">
          <div className="ticker-carousel" aria-label="Supported stock carousel">
            <div className="ticker-track">
              {[...stocks, ...stocks].map((item, index) => {
                const duplicate = index >= stocks.length;
                return (
                  <button
                    className={`ticker-pill ${item.symbol === selected ? "active" : ""}`}
                    type="button"
                    key={`${item.symbol}-${index}`}
                    tabIndex={duplicate ? -1 : undefined}
                    aria-hidden={duplicate ? "true" : undefined}
                    onClick={() => setSelected(item.symbol)}
                  >
                    <Logo stock={item} />
                    <span><strong>{item.symbol}</strong><span>{item.name}</span></span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </header>

      <main className={`workspace ${stock ? "revealed" : ""}`}>
        <section className="control-stack">
          <form className="panel trade-ticket" onSubmit={submitTrade}>
            <div className="swap-shell">
              <div className="swap-toolbar">
                <div className="swap-tabs" aria-label="Trade side">
                  <button className={side === "buy" ? "active" : ""} type="button" onClick={() => setSide("buy")}>Buy</button>
                  <button className={side === "sell" ? "active sell" : ""} type="button" onClick={() => setSide("sell")}>Sell</button>
                </div>
              </div>

              <div className="swap-card">
                <div className="swap-leg">
                  <TokenButton
                    token={sourceToken}
                    placeholder={side === "sell" ? "Select stock" : "Select token"}
                    accent={side === "buy"}
                    onClick={() => setTokenPicker(side === "sell" ? "stock" : "pay")}
                  />
                  <label className="amount-entry">
                    <input inputMode="decimal" aria-label="Trade amount" placeholder="0" value={amount} onChange={(event) => setAmount(event.target.value)} />
                    <span>${amountNumber ? amountNumber.toLocaleString() : "0"}</span>
                  </label>
                </div>

                <button
                  className="swap-flip"
                  type="button"
                  aria-label="Switch buy and sell direction"
                  onClick={() => setSide((current) => (current === "buy" ? "sell" : "buy"))}
                >
                  <ArrowDownIcon />
                </button>

                <div className="swap-leg output">
                  <TokenButton
                    token={targetToken}
                    placeholder={side === "sell" ? "Select token" : "Select stock"}
                    onClick={() => setTokenPicker(side === "sell" ? "pay" : "stock")}
                  />
                  <div className="amount-entry readout" aria-label="Estimated output amount">
                    <strong>{stock && amountNumber ? estimatedOutput : "0"}</strong>
                    <span>${stock && amountNumber ? Math.max(amountNumber * selectedScore * 0.01, 0).toFixed(2) : "0"}</span>
                  </div>
                </div>
              </div>

              <div className="wallet-route-stack">
                <div className="wallet-row wallet-connect-row">
                  <span>Wallet</span>
                  {isConnected ? (
                    <div className="wallet-actions">
                      <button className="wallet-address-button" type="button" onClick={() => open({ view: "Account" })}>
                        {shortenAddress(wallet)}
                      </button>
                      <button className="wallet-link-button" type="button" onClick={() => disconnect()}>
                        Disconnect
                      </button>
                    </div>
                  ) : (
                    <button className="wallet-address-button" type="button" onClick={connectWallet}>
                      Connect
                    </button>
                  )}
                </div>
                {isConnected && (
                  <div className={`network-row ${connectedToRobinhood ? "ready" : ""}`}>
                    <span>{connectedToRobinhood ? "Robinhood Chain" : "Wrong network"}</span>
                    {!connectedToRobinhood && (
                      <button type="button" onClick={switchToRobinhood}>
                        Switch
                      </button>
                    )}
                  </div>
                )}
                {(tradeStatus || tradeError || txHashes.length > 0 || quote) && (
                  <div className={`quote-status ${tradeError ? "error" : ""}`}>
                    {tradeError || tradeStatus}
                    {txHashes.length > 0 && (
                      <div className="tx-links">
                        {txHashes.map((hash) => (
                          <a key={hash} href={`${ROBINHOOD_CHAIN_EXPLORER}/tx/${hash}`} target="_blank" rel="noreferrer">
                            {shortenAddress(hash)}
                          </a>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              <button className="swap-submit" type="submit" disabled={tradeBusy || !isReownConfigured}>
                {submitLabel()}
              </button>
            </div>
          </form>

          <section className="panel stock-section">
            <div className="stocks-grid">
              {stocks.map((item) => (
                <article className={`stock-card ${item.symbol === selected ? "active" : ""}`} key={item.symbol}>
                  <button className="stock-select" type="button" onClick={() => setSelected(item.symbol)}>
                    <div className="stock-top">
                      <Logo stock={item} />
                      <div className="ticker">{item.symbol}</div>
                    </div>
                    <MiniStockChart data={charts[item.symbol] || []} />
                  </button>
                  <div className="contract-row">
                    <button className="copy-btn" type="button" aria-label={`Copy ${item.symbol} contract`} onClick={() => copy(item.address)}>
                      <span className="copy-icon"></span>
                    </button>
                  </div>
                </article>
              ))}
            </div>
          </section>
          <HermesDataTable stocks={stocks} hermesOutput={hermesOutput} />
          <EarningsCalendar
            events={earningsEvents}
            stocks={stocks}
            monthDate={calendarMonth}
            onMonthChange={setCalendarMonth}
          />
        </section>

        {stock && (
          <section className="panel research-panel" aria-label="Selected stock research">
              <div className="research-heading">
              <div className="research-title">
                <Logo stock={stock} />
                <div>
                  <h2>{stock.symbol}</h2>
                  <div className="company">{stock.name}</div>
                </div>
              </div>
              </div>
            <div className="detail-stack">
              <StockChartView data={selectedChartData} ticker={stock.symbol} status={chartStatus} />
              <HermesOutputBar stock={stock} hermesOutput={hermesOutput} />
              <div className="cn-card">
                <div className="cn-card-content flex flex-col gap-3">
                  <span className="font-medium">Research brief</span>
                  <ul className="research-list">{(stock.bullets || []).map((item) => <li key={item}>{item}</li>)}</ul>
                </div>
              </div>
            </div>
          </section>
        )}
      </main>
      <TokenPicker
        open={tokenPicker === "stock"}
        title={side === "sell" ? "Sell token" : "Buy token"}
        items={stocks}
        selectedSymbol={stock ? stock.symbol : ""}
        onSelect={(item) => selectToken("stock", item)}
        onClose={() => setTokenPicker(null)}
      />
      <TokenPicker
        open={tokenPicker === "pay"}
        title={side === "sell" ? "Receive token" : "Pay token"}
        items={payTokens.map((token, index) => ({
          logoText: token.symbol.slice(0, 2),
          logoBg: index === 0 ? "#f0fff4" : "#edf0ff",
          logoFg: index === 0 ? "#08763d" : "#343cff",
          score: index === 0 ? 0 : 23,
          ...token
        }))}
        selectedSymbol={payToken ? payToken.symbol : ""}
        onSelect={(item) => selectToken("pay", item)}
        onClose={() => setTokenPicker(null)}
      />
    </>
  );
}

export default App;
