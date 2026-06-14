"use client";

/* eslint-disable @next/next/no-img-element */
import * as React from "react";
import { earningsEvents } from "../earningsData.js";
import { ROBINHOOD_CHAIN_EXPLORER } from "../web3/config";
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  Logo,
  MinusIcon,
  MotionAsset,
  PlusIcon,
  ScoreRadial,
  formatReadableDate,
  formatReadableDateText,
  sourceHref,
  splitReasoningText,
  shortenAddress
} from "./HermesShared.jsx";

const HERMES_LOADING_WORDS = ["Thinking", "Pondering", "Assessing", "Scoring"];

export function HermesOutputBar({ stock, hermesOutput, loading, progress, overlay = true }) {
  const score = Math.max(0, Math.min(stock.score || 0, 100));
  const decision = hermesOutput?.hermes_decision?.stocks?.find((item) => item.symbol === stock.symbol);
  const [loadingWordIndex, setLoadingWordIndex] = React.useState(0);

  React.useEffect(() => {
    if (!loading) return undefined;
    const timer = window.setInterval(() => {
      setLoadingWordIndex((current) => (current + 1) % HERMES_LOADING_WORDS.length);
    }, 900);
    return () => window.clearInterval(timer);
  }, [loading]);

  const fallbackStance = decision?.action || (score >= 64 ? "WATCH" : "NO_BUY");
  const stance = loading ? HERMES_LOADING_WORDS[loadingWordIndex] : fallbackStance;
  const displayScore = loading ? Math.max(4, Math.min(progress?.percent || 0, 99)) : decision?.confidence || score;

  return (
    <div className="cn-card score-card">
      <div className="cn-card-content">
        <div className="score-head">
          <div className={`score-left${overlay ? "" : " score-left-overlay-off"}`}>
            <div className="score-radial" aria-label={`Hermes confidence ${displayScore}%`}>
              <ScoreRadial value={displayScore} />
            </div>
            <div className="score-copy">
              <span className="score-why-label">{overlay ? "Hermes vote" : "Hermes vote · off"}</span>
              <button className="score-action-pill" type="button" disabled={loading}>
                <span key={stance} className={loading ? "rotating-word" : ""}>{stance}</span>
              </button>
            </div>
          </div>
        </div>
        {loading ? (
          <div className="thinking-state">
            <MotionAsset src="/media/icons/hermes-thinking.mp4" webmSrc="/media/icons/hermes-thinking.webm" className="thinking-motion" />
            <div className="hermes-progress-copy">
              <span>{progress?.label || "Hermes thinking..."}</span>
            </div>
          </div>
        ) : null}
        {loading ? (
          <div className="hermes-progress-track" aria-label={`Hermes output progress ${progress?.percent || 0}%`}>
            <div style={{ width: `${Math.max(4, Math.min(progress?.percent || 0, 100))}%` }}></div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function HermesFinalOutput() {
  return null;
}

export function formatNumber(value) {
  if (value === undefined || value === null || value === "") return "n/a";
  const number = Number(value);
  return Number.isFinite(number) ? number.toLocaleString("en-US") : String(value);
}

export function formatMoney(value) {
  if (value === undefined || value === null || value === "") return "n/a";
  const number = Number(value);
  return Number.isFinite(number) ? `$${number.toLocaleString("en-US")}` : String(value);
}

export function formatCompactMoney(value) {
  if (value === undefined || value === null || value === "") return "n/a";
  const number = Number(value);
  return Number.isFinite(number)
    ? new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", notation: "compact", maximumFractionDigits: 2 }).format(number)
    : String(value);
}

export function formatSignedNumber(value, suffix = "") {
  if (value === undefined || value === null || value === "") return "n/a";
  const number = Number(value);
  if (!Number.isFinite(number)) return String(value);
  const sign = number > 0 ? "+" : "";
  return `${sign}${number.toLocaleString("en-US", { maximumFractionDigits: 2 })}${suffix}`;
}

export function formatConfidence(value) {
  if (value === undefined || value === null || value === "") return "No score";
  const number = Number(value);
  return Number.isFinite(number) ? `${number}/100 confidence` : `${value} confidence`;
}

export function formatEarningsDate(value) {
  if (!value) return "n/a";
  const formatted = formatReadableDate(value);
  if (formatted) return formatted;
  const date = new Date(`${value}T12:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return `${date.getDate()} ${date.toLocaleDateString("en-US", { month: "long" }).toLowerCase()} ${date.getFullYear()}`;
}

export function formatDateTime(value) {
  if (!value) return "n/a";
  const formatted = formatReadableDate(value);
  if (formatted) return formatted;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return `${date.getDate()} ${date.toLocaleDateString("en-US", { month: "long" }).toLowerCase()} ${date.getFullYear()}`;
}

export function formatJournalDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "n/a";
  return `${date.getDate()} of ${date.toLocaleDateString("en-US", { month: "long" }).toLowerCase()} ${date.getFullYear()}`;
}

export function titleCaseAction(value) {
  const clean = String(value || "").toLowerCase();
  if (!clean) return "Trade";
  return clean.charAt(0).toUpperCase() + clean.slice(1);
}

export function splitDisplayAmount(value) {
  const text = String(value || "").trim();
  if (!text) return null;
  const parts = text.split(/\s+/);
  if (parts.length < 2) return { amount: text, symbol: "" };
  return {
    amount: parts.slice(0, -1).join(" "),
    symbol: parts.at(-1)
  };
}

export function formatKalshiVolume(value) {
  if (value === undefined || value === null || value === "") return "n/a";
  const number = Number(value);
  if (!Number.isFinite(number)) return String(value);
  if (number <= 0) return "n/a";
  if (number >= 1_000_000_000) return `${(number / 1_000_000_000).toLocaleString("en-US", { maximumFractionDigits: 1 })}B`;
  if (number >= 1_000_000) return `${(number / 1_000_000).toLocaleString("en-US", { maximumFractionDigits: 1 })}M`;
  if (number >= 1_000) return `${(number / 1_000).toLocaleString("en-US", { maximumFractionDigits: 1 })}K`;
  return number.toLocaleString("en-US", { maximumFractionDigits: 0 });
}

export function firstNonZeroValue(...values) {
  return values.find((value) => {
    const number = Number(value);
    return Number.isFinite(number) && number > 0;
  });
}

export function averagePricePercent(bid, ask) {
  const values = [bid, ask].map(Number).filter((value) => Number.isFinite(value));
  if (!values.length) return null;
  return Math.round((values.reduce((sum, value) => sum + value, 0) / values.length) * 100);
}

export function kalshiMarketUrl(market) {
  const ticker = market?.ticker || market?.event_ticker;
  return ticker ? `https://kalshi.com/markets/${ticker}` : "https://kalshi.com/markets";
}

export function earningsSummary(symbol) {
  const today = dateKey(new Date());
  const events = earningsEvents.filter((event) => event.symbol === symbol).sort((a, b) => a.date.localeCompare(b.date));
  const latest = [...events].reverse().find((event) => event.date <= today);
  const next = events.find((event) => event.date > today);
  return { latest, next };
}

export function eventQuarter(date) {
  if (!date) return "n/a";
  const parsed = new Date(`${date}T12:00:00`);
  if (Number.isNaN(parsed.getTime())) return "n/a";
  return `Q${Math.floor(parsed.getMonth() / 3) + 1} ${parsed.getFullYear()}`;
}

export function HermesDataTable({ stocks, hermesOutput }) {
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

export function EarningsBacktestTable({ stock, backtest, loading }) {
  const [expanded, setExpanded] = React.useState(false);
  const rows = backtest?.rows || [];
  const actionLabel = loading ? "In progress" : expanded ? "Collapse" : "Expand";
  const numberCoverage = rows.filter((row) => row.earnings_numbers?.source_status && row.earnings_numbers.source_status !== "unavailable").length;
  return (
    <section className={`hermes-module earnings-backtest ${expanded ? "expanded" : ""} ${loading ? "loading" : ""}`} aria-label="Hermes backtest">
      <button className="backtest-toggle" type="button" aria-expanded={expanded} onClick={() => setExpanded((current) => !current)}>
        <div>
          <div className="menu-title-row">
            <MotionAsset src="/media/icons/hermes-output-orb.mp4" webmSrc="/media/icons/hermes-output-orb.webm" className="menu-title-motion" />
            <h3>Hermes Backtest</h3>
          </div>
          <span>{loading ? "Running" : rows.length ? `Previous 3 earnings · ${numberCoverage}/3 with numbers` : "No rows yet"}</span>
        </div>
        <span className={`expand-action ${loading ? "loading" : ""}`} aria-busy={loading ? "true" : undefined}>
          <span>{actionLabel}</span>
          {loading ? null : expanded ? <MinusIcon /> : <PlusIcon />}
        </span>
      </button>
      {expanded ? (
        <>
          {loading ? (
            <div className="backtest-loading">
              <MotionAsset src="/media/icons/hermes-output-orb.mp4" webmSrc="/media/icons/hermes-output-orb.webm" className="backtest-motion" />
              <div>
                <strong>Hermes is benchmarking {stock?.symbol || "stock"} earnings</strong>
                <span>Checking price reaction, Kalshi matches, date-bounded news, and model commentary.</span>
              </div>
            </div>
          ) : rows.length ? (
            <div className="backtest-table-wrap">
              <table className="backtest-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Earnings numbers</th>
                    <th>Price reaction</th>
                    <th>Benchmark</th>
                    <th>Kalshi evidence</th>
                    <th>News window</th>
                    <th>Hermes read</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => {
                    const numbers = row.earnings_numbers || {};
                    const hasEarningsNumbers = numbers.source_status && numbers.source_status !== "unavailable";
                    const topHeadlines = row.news?.top_headlines || [];
                    const kalshiTitle = row.kalshi?.top_market?.title || row.kalshi?.top_market?.ticker;
                    return (
                      <tr key={`${row.symbol}-${row.earnings_date}`}>
                        <td>
                          <strong>{formatEarningsDate(row.earnings_date)}</strong>
                          <small>{row.quarter}</small>
                          {numbers.fiscal_period ? <small>Fiscal {formatEarningsDate(numbers.fiscal_period)}</small> : null}
                        </td>
                        <td>
                          {hasEarningsNumbers ? (
                            <div className="earnings-number-stack">
                              <strong>EPS {formatSignedNumber(numbers.eps_actual)}</strong>
                              <small>Est {formatSignedNumber(numbers.eps_estimate)} · Surprise {formatSignedNumber(numbers.eps_surprise)} / {formatSignedNumber(numbers.eps_surprise_percent, "%")}</small>
                              <small>Revenue est {formatCompactMoney(numbers.revenue_estimate)}</small>
                              <span className={`source-chip ${numbers.source_status}`}>{numbers.source_status}</span>
                            </div>
                          ) : (
                            <div className="earnings-number-stack">
                              <strong>Numbers unavailable</strong>
                              <small>{numbers.notes?.[0] || "Yahoo earnings history did not return a usable row."}</small>
                              <span className="source-chip unavailable">unavailable</span>
                            </div>
                          )}
                        </td>
                        <td>
                          <strong className={Number(row.move_percent) >= 0 ? "positive" : "negative"}>
                            {row.move_percent === undefined ? "n/a" : formatSignedNumber(row.move_percent, "%")}
                          </strong>
                          <small>{formatMoney(row.price_before)} → {formatMoney(row.price_after)}</small>
                        </td>
                        <td>
                          <span className={`benchmark-pill ${row.benchmark}`}>{row.benchmark}</span>
                        </td>
                        <td>
                          <strong>{row.kalshi?.matched ? `${row.kalshi.market_count} match${row.kalshi.market_count === 1 ? "" : "es"}` : "No match"}</strong>
                          <small>{kalshiTitle || "Public feed did not return a usable historic market"}</small>
                          {row.kalshi?.top_market?.yes_bid || row.kalshi?.top_market?.yes_ask ? (
                            <small>YES {row.kalshi?.top_market?.yes_bid || "n/a"} / {row.kalshi?.top_market?.yes_ask || "n/a"}</small>
                          ) : null}
                        </td>
                        <td>
                          <strong>{row.news?.article_count || 0} articles</strong>
                          {topHeadlines.length ? topHeadlines.map((headline) => <small key={headline}>{headline}</small>) : <small>No date-bounded headlines returned</small>}
                        </td>
                        <td>{row.analysis}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="module-empty">No backtest rows returned for {stock?.symbol || "this stock"}.</p>
          )}
        </>
      ) : null}
    </section>
  );
}

export function getHermesContext(stock, hermesOutput) {
  const intel = hermesOutput?.data;
  if (!stock || !intel) return {};
  const decision = (hermesOutput?.hermes_decision?.stocks || intel?.hermes_decision?.stocks || []).find((item) => item.symbol === stock.symbol);
  const recommendation = (intel?.recommendations || []).find((item) => item.symbol === stock.symbol);
  const calendar = (intel?.calendars || []).find((item) => item.symbol === stock.symbol);
  const price = (intel?.stock_signals?.prices || []).find((item) => item.symbol === stock.symbol);
  const filing = (intel?.stock_signals?.filings || []).find((item) => item.symbol === stock.symbol);
  const news = (intel?.stock_signals?.news || []).find((item) => item.symbol === stock.symbol);
  const kalshi = (intel?.kalshi?.stocks || []).find((item) => item.stock?.symbol === stock.symbol);
  const explorerConfirmed = (intel?.explorer_discovery?.tokens || []).some(
    (token) => token.routed_by_agent && token.address?.toLowerCase() === stock.address?.toLowerCase()
  );
  return { intel, decision, recommendation, calendar, price, filing, news, kalshi, explorerConfirmed };
}

export function WhyRoutePanel({ stock, payToken, side, wallet, connectedToRobinhood, quote, quoteTransactions, hermesOutput }) {
  const { decision, price, filing, news, kalshi, explorerConfirmed } = getHermesContext(stock, hermesOutput);
  const isSell = side === "sell";
  const source = isSell ? stock : payToken;
  const target = isSell ? payToken : stock;
  const evidence = [
    stock?.address ? "official Robinhood Chain stock contract" : null,
    price?.ok ? `latest close ${formatMoney(price.close)}${price.date ? ` on ${price.date}` : ""}` : null,
    filing?.latest_material ? `latest SEC ${filing.latest_material.form}` : null,
    news?.article_count ? `${news.article_count} recent news article(s)` : null,
    kalshi?.match_count ? `${kalshi.match_count} Kalshi market match(es)` : null,
    explorerConfirmed ? "contract seen in explorer discovery" : null
  ].filter(Boolean);

  return (
    <section className="hermes-module why-route-panel" aria-label="Why this route">
      <div className="module-kicker">Why this route?</div>
      <div className="route-line">
        <span>{source?.symbol || "Token"}</span>
        <span>→</span>
        <span>{target?.symbol || "Stock"}</span>
      </div>
      <p>{decision?.reason || "Hermes is waiting for enough clean public evidence before recommending a route."}</p>
      <div className="route-state-grid">
        <div>
          <span>Action</span>
          <strong>{decision?.action || "n/a"}</strong>
        </div>
        <div>
          <span>Wallet</span>
          <strong>{wallet ? shortenAddress(wallet) : "not connected"}</strong>
        </div>
        <div>
          <span>Network</span>
          <strong>{connectedToRobinhood ? "Robinhood Chain" : "pending"}</strong>
        </div>
        <div>
          <span>Quote</span>
          <strong>{quoteTransactions.length ? "ready to sign" : quote ? "prepared" : "not prepared"}</strong>
        </div>
      </div>
      <div className="evidence-list">
        {evidence.length ? evidence.map((item) => <span key={item}>{item}</span>) : <span>No clean evidence yet</span>}
      </div>
    </section>
  );
}

const SCORE_COMPONENT_COLORS = {
  kalshi: "#407076",
  calendar: "#a6979c",
  price: "#ccff00",
  filing: "#6b7c85",
  news: "#d86c3f",
  matches: "#04151f",
};

export function scoreComponentNote(key, ctx) {
  const { calendar, price, filing, news, kalshi } = ctx;
  const topMarket = kalshi?.markets?.[0];
  switch (key) {
    case "kalshi":
      return topMarket?.title || topMarket?.ticker || "No clean Kalshi market match.";
    case "calendar":
      return calendar?.ok ? "Calendar feed returned earnings context." : "Calendar feed did not return a clean event.";
    case "price":
      return price?.ok ? `Quote date ${formatReadableDateText(price.date || "unknown")}` : "No clean latest quote.";
    case "filing":
      return filing?.latest_material?.form
        ? formatReadableDateText(`Latest filing ${filing.latest_material.form}${filing.latest_material.filing_date ? ` filed ${filing.latest_material.filing_date}` : ""}`)
        : "No recent SEC filing signal.";
    case "news":
      return news?.article_count ? `${news.article_count} recent news item(s)` : "No clean news signal.";
    case "matches":
      return kalshi?.match_count ? `${kalshi.match_count} Kalshi market match(es)` : "No extra market breadth.";
    default:
      return "";
  }
}

export function ConfidenceDecomposition({ stock, hermesOutput, overlay = true, onToggleOverlay }) {
  const ctx = getHermesContext(stock, hermesOutput);
  const { decision } = ctx;
  const symbol = stock?.symbol;

  const [expandedSegment, setExpandedSegment] = React.useState(null);
  const [biasOpen, setBiasOpen] = React.useState(false);
  const [weightsBySymbol, setWeightsBySymbol] = React.useState({});
  const weights = weightsBySymbol[symbol] || {};
  const overlayOn = overlay !== false;

  const setWeight = (key, value) => {
    setWeightsBySymbol((prev) => {
      const current = prev[symbol] || {};
      return { ...prev, [symbol]: { ...current, [key]: value } };
    });
  };
  const resetBias = () => {
    setWeightsBySymbol((prev) => ({ ...prev, [symbol]: {} }));
    onToggleOverlay?.(true);
  };
  const weightFor = (key) => {
    const weight = weights[key];
    return typeof weight === "number" ? weight : 1;
  };

  const scoreBreakdown = Array.isArray(decision?.score_breakdown) ? decision.score_breakdown : [];
  const components = scoreBreakdown.map((component) => {
    const weight = weightFor(component.key);
    const adjustedPoints = Math.round((component.points || 0) * weight);
    return {
      ...component,
      weight,
      adjustedPoints,
      color: SCORE_COMPONENT_COLORS[component.key] || "#04151f",
      note: scoreComponentNote(component.key, ctx),
    };
  });

  const weightsDirty = components.some((component) => component.weight !== 1);
  const biasDirty = weightsDirty || !overlayOn;
  const adjustedTotal = Math.min(
    95,
    components.reduce((sum, component) => sum + component.adjustedPoints, 0),
  );
  const baseTotal = decision?.confidence ?? Math.min(95, components.reduce((sum, component) => sum + (component.points || 0), 0));
  const total = weightsDirty ? adjustedTotal : baseTotal;

  const contributionTotal = Math.max(
    1,
    components.reduce((sum, component) => sum + component.adjustedPoints, 0),
  );
  const segments = components.map((component) => ({
    key: component.key,
    label: component.label,
    color: component.color,
    note: component.note,
    points: component.adjustedPoints,
    max: component.max,
    percent: Math.round((component.adjustedPoints / contributionTotal) * 100),
  }));
  const selectedSegment = segments.find((segment) => segment.key === expandedSegment);
  if (!components.length) return null;

  return (
    <div data-slot="card" data-size="default" className="cn-card confidence-panel confidence-breakdown-card">
      <div data-slot="card-content" className="cn-card-content confidence-breakdown-content">
        <div className="confidence-breakdown-head">
          <span className="score-why-label">Confidence score</span>
          <span className="text-3xl font-semibold">
            {total}/100
            {weightsDirty ? <small className="score-why-adjusted">· adjusted</small> : null}
          </span>
        </div>
        <div className="confidence-category-stack">
          <div aria-label="Hermes confidence category bar">
            <div className="confidence-category-bar">
              <div className="confidence-category-track">
                {segments.map((segment) => (
                  <button
                    className="confidence-category-segment"
                    type="button"
                    style={{ width: `${segment.percent}%`, backgroundColor: segment.color }}
                    key={segment.key}
                    aria-label={`${segment.label} confidence detail`}
                    aria-expanded={selectedSegment?.key === segment.key}
                    onClick={() => setExpandedSegment((current) => (current === segment.key ? null : segment.key))}
                  ></button>
                ))}
              </div>
            </div>
          </div>
          <ul className="confidence-category-legend">
            {segments.map((segment) => (
              <li key={segment.key}>
                <button
                  className="confidence-legend-button"
                  type="button"
                  aria-expanded={selectedSegment?.key === segment.key}
                  onClick={() => setExpandedSegment((current) => (current === segment.key ? null : segment.key))}
                >
                  <span className="legend-swatch" style={{ backgroundColor: segment.color }}></span>
                  <span className="font-medium">{segment.percent}%</span>
                  <span className="text-muted-foreground">{segment.label}</span>
                </button>
              </li>
            ))}
          </ul>
          {selectedSegment ? (
            <div className="confidence-segment-detail" style={{ "--segment-color": selectedSegment.color }}>
              <span>{selectedSegment.label} · +{selectedSegment.points} / {selectedSegment.max}</span>
              <div className="factor-detail-list">
                {splitReasoningText(selectedSegment.note).map((item) => <p key={item}>{item}</p>)}
              </div>
            </div>
          ) : null}
        </div>
        <button
          type="button"
          className={`score-bias-toggle ${biasDirty ? "score-bias-toggle-active" : ""}`}
          onClick={() => setBiasOpen((open) => !open)}
          aria-expanded={biasOpen}
        >
          {biasOpen ? "Hide Bias Controls" : "Adjust Bias"}
          {biasDirty && !biasOpen ? <span className="score-bias-dot" aria-hidden="true" /> : null}
        </button>
        {biasOpen ? (
          <div className="score-bias-panel">
            <div className="score-bias-row score-bias-overlay">
              <label className="score-bias-overlay-label">
                <input
                  type="checkbox"
                  checked={overlayOn}
                  onChange={(event) => onToggleOverlay?.(event.target.checked)}
                />
                <span>Hermes overlay</span>
              </label>
              <button type="button" className="score-bias-reset" onClick={resetBias} disabled={!biasDirty}>
                Reset
              </button>
            </div>
            <div className="score-bias-sliders">
              {components.map((component) => {
                const disabled = !component.present || component.points <= 0;
                return (
                  <div
                    className={`score-bias-slider ${disabled ? "score-bias-slider-disabled" : ""}`}
                    key={component.key}
                  >
                    <div className="score-bias-slider-head">
                      <span className="score-bias-slider-label">{component.label}</span>
                      <span className="score-bias-slider-meta">
                        {component.weight.toFixed(1)}x {"->"} +{component.adjustedPoints}
                      </span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="2"
                      step="0.1"
                      value={component.weight}
                      disabled={disabled}
                      onChange={(event) => setWeight(component.key, Number(event.target.value))}
                      aria-label={`${component.label} trust weight`}
                    />
                  </div>
                );
              })}
            </div>
          </div>
        ) : null}
        <div data-orientation="horizontal" role="none" data-slot="separator" className="confidence-separator"></div>
        <div className="confidence-summary">
          <span className="font-medium">{titleCaseAction(decision?.action || "Hermes")} confidence factors</span>
          <div className="confidence-summary-grid">
            {segments.map((factor) => (
              <article key={factor.key}>
                <span>{factor.label}</span>
                <p>{factor.note}</p>
              </article>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export function PredictionMarketOverlay({ stock, hermesOutput, loading }) {
  const { kalshi } = getHermesContext(stock, hermesOutput);
  const markets = (kalshi?.markets || []).slice(0, 3);

  return (
    <section className="hermes-module prediction-overlay" aria-label="Prediction market overlay">
      <div className="module-head prediction-head">
        <div>
          <h3 className="kalshi-market-title">
            <MotionAsset webmSrc="/media/icons/hermes-additional-icon.webm" className="kalshi-heading-motion" />
            <img src="/logos/kalshilogopng.png" alt="Kalshi" />
            <span>markets</span>
          </h3>
        </div>
      </div>
      {loading ? (
        <div className="market-stack market-stack-loading" aria-live="polite" aria-busy="true">
          {[0, 1, 2].map((item) => (
            <article className="market-row market-row-loading" key={item}>
              <div className="market-title-skeleton"></div>
              <div className="market-card-layout">
                <div className="market-probability-card market-probability-loading">
                  <span>Loading</span>
                  <strong>--</strong>
                </div>
                <div className="market-meta-grid market-meta-loading">
                  <div></div>
                  <div></div>
                  <div></div>
                </div>
              </div>
            </article>
          ))}
        </div>
      ) : markets.length ? (
        <div className="market-stack">
          {markets.map((market) => {
            const yesProbability = averagePricePercent(market.yes_bid_dollars, market.yes_ask_dollars);
            const noProbability = averagePricePercent(market.no_bid_dollars, market.no_ask_dollars);
            const bestSide = (noProbability || 0) > (yesProbability || 0) ? "NO" : "YES";
            const bestProbability = bestSide === "NO" ? noProbability : yesProbability;
            const volume = firstNonZeroValue(market.volume_24h_fp, market.volume_fp, market.volume);
            const closeTime = market.close_time || market.expected_expiration_time;
            return (
              <article className="market-row" key={market.ticker}>
                <div className="market-title-block">
                  <a href={kalshiMarketUrl(market)} target="_blank" rel="noreferrer">
                    {market.title || market.series_title || "Kalshi market"}
                  </a>
                </div>
                <div className="market-card-layout">
                  <div className={`market-probability-card ${bestSide === "NO" ? "market-side-no" : "market-side-yes"}`}>
                    <span>{bestSide}</span>
                    <strong>{bestProbability !== null ? `${bestProbability}%` : "n/a"}</strong>
                  </div>
                  <dl className="market-meta-grid">
                    <div><dt>Close</dt><dd>{formatDateTime(closeTime)}</dd></div>
                    <div><dt>Volume</dt><dd>{formatKalshiVolume(volume)}</dd></div>
                    <div><dt>Market rules</dt><dd>{market.rules_primary || market.title || "n/a"}</dd></div>
                  </dl>
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <p className="empty-module-note">No matching Kalshi market found for this stock.</p>
      )}
    </section>
  );
}

export function DataProvenanceView({ hermesOutput }) {
  const [expanded, setExpanded] = React.useState(false);
  const intel = hermesOutput?.data;
  const checks = intel?.pipeline?.checks || [];

  return (
    <section className={`hermes-module provenance-view ${expanded ? "expanded" : ""}`} aria-label="Data provenance">
      <div className="module-head">
        <div>
          <div className="menu-title-row">
            <MotionAsset src="/media/icons/hermes-thinking.mp4" webmSrc="/media/icons/hermes-thinking.webm" className="menu-title-motion" />
            <h3>Data Sources</h3>
          </div>
        </div>
        <button className="provenance-toggle" type="button" aria-expanded={expanded} onClick={() => setExpanded((current) => !current)}>
          <span>{expanded ? "Collapse" : "Expand"}</span>
          {expanded ? <MinusIcon /> : <PlusIcon />}
        </button>
      </div>
      {expanded ? (
        <div className="provenance-list">
          {checks.map((check) => (
            <div className={`provenance-row ${check.ok ? "ok" : "degraded"}`} key={check.name}>
              <div>
                <span>{check.name.replaceAll("_", " ")}</span>
                {sourceHref(check.source) ? (
                  <a className="source-button" href={sourceHref(check.source)} target="_blank" rel="noreferrer">Source</a>
                ) : null}
              </div>
              <strong>{check.records ?? 0} records</strong>
              {check.error ? <p>{check.error}</p> : check.note ? <p>{check.note}</p> : null}
            </div>
          ))}
        </div>
      ) : null}
    </section>
  );
}

export function previewHermesOutput(intel) {
  return {
    reply: intel?.hermes_decision?.summary || "Hermes is building the model-written research output.",
    hermes_decision: intel?.hermes_decision,
    data: intel
  };
}

export function PostTradeJournal({ entries, stock, sectionRef, expanded, onExpandedChange }) {
  const visibleEntries = entries
    .filter((entry) => entry.status === "tx_confirmed")
    .filter((entry) => !stock || entry.symbol === stock.symbol)
    .slice(0, 6);

  return (
    <section ref={sectionRef} className={`hermes-module journal-view ${expanded ? "expanded" : ""}`} aria-label="Trade journal">
      <div className="module-head">
        <div className="menu-title-row">
          <MotionAsset src="/media/icons/wallet-connect-orb.mp4" webmSrc="/media/icons/wallet-connect-orb.webm" className="menu-title-motion" />
          <h3>Trade Journal</h3>
        </div>
        <button className="provenance-toggle" type="button" aria-expanded={expanded} onClick={() => onExpandedChange?.(!expanded)}>
          <span>{expanded ? "Collapse" : "Expand"}</span>
          {expanded ? <MinusIcon /> : <PlusIcon />}
        </button>
      </div>
      {expanded && visibleEntries.length ? (
        <div className="journal-stack">
          {visibleEntries.map((entry) => {
            const output = splitDisplayAmount(entry.outputAmount);
            const sideLabel = titleCaseAction(entry.side);
            const outputSymbol = output?.symbol || entry.targetSymbol || "";
            const tradeTitle = `${sideLabel} ${outputSymbol}`.trim();
            const tradeLine = entry.outputAmount
              ? `${entry.amount || "0"} ${entry.sourceSymbol || ""} for ${entry.outputAmount}`.trim()
              : `${entry.amount || "0"} ${entry.sourceSymbol || ""} for ${entry.targetSymbol || ""}`.trim();
            const explorerHash = entry.hashes?.[entry.hashes.length - 1];

            return (
              <article className="journal-entry" key={entry.id}>
                <div className="journal-entry-head">
                  <div className="journal-title-row">
                    <strong>{tradeTitle}</strong>
                  </div>
                  <time>{formatJournalDate(entry.timestamp)}</time>
                </div>
                <p>{tradeLine}</p>
                <small>Hermes {entry.hermesAction || "n/a"} · {formatConfidence(entry.hermesConfidence)}</small>
                {explorerHash ? (
                  <div className="journal-links">
                    <a className="journal-explorer-button" href={`${ROBINHOOD_CHAIN_EXPLORER}/tx/${explorerHash}`} target="_blank" rel="noreferrer">
                      Explorer
                    </a>
                  </div>
                ) : null}
              </article>
            );
          })}
        </div>
      ) : expanded ? (
        <p className="empty-module-note">Confirmed wallet transactions will appear here with the Hermes evidence snapshot.</p>
      ) : null}
    </section>
  );
}

export function dateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function monthStart(date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

export function addMonths(date, amount) {
  return new Date(date.getFullYear(), date.getMonth() + amount, 1);
}

export function monthTitle(date) {
  return date.toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

export function buildCalendarDays(monthDate) {
  const first = monthStart(monthDate);
  const start = new Date(first);
  start.setDate(first.getDate() - first.getDay());
  return Array.from({ length: 42 }, (_, index) => {
    const day = new Date(start);
    day.setDate(start.getDate() + index);
    return day;
  });
}

export function EarningsCalendar({ events, stocks, monthDate, onMonthChange, onSelectStock }) {
  const [expanded, setExpanded] = React.useState(false);
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
    <section className={`earnings-calendar ${expanded ? "expanded" : ""}`} aria-label="Supported stock earnings calendar">
      <div className="earnings-calendar-toolbar">
        <button className="calendar-toggle" type="button" aria-expanded={expanded} onClick={() => setExpanded((current) => !current)}>
          <div className="menu-title-row">
            <MotionAsset src="/media/icons/wallet-connect-orb.mp4" webmSrc="/media/icons/wallet-connect-orb.webm" className="menu-title-motion" />
            <span className="menu-title-text">Earnings Calendar</span>
          </div>
          <span className="expand-action">
            <span>{expanded ? "Collapse" : "Expand"}</span>
            {expanded ? <MinusIcon /> : <PlusIcon />}
          </span>
        </button>
        {expanded ? (
          <>
            <button className="calendar-icon-button" type="button" aria-label="Previous month" onClick={() => onMonthChange(addMonths(monthDate, -1))}>
              <ChevronLeftIcon />
            </button>
            <button className="calendar-icon-button" type="button" aria-label="Next month" onClick={() => onMonthChange(addMonths(monthDate, 1))}>
              <ChevronRightIcon />
            </button>
          </>
        ) : null}
      </div>
      {expanded ? (
        <>
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
                        <button
                          className={`earnings-event ${event.symbol.toLowerCase()}`}
                          key={`${event.symbol}-${event.date}`}
                          type="button"
                          onClick={() => onSelectStock(event.symbol)}
                          aria-label={`${event.symbol} earnings on ${formatEarningsDate(event.date)}`}
                        >
                          {eventStock ? <Logo stock={eventStock} /> : null}
                          <span>{event.symbol}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      ) : null}
    </section>
  );
}
