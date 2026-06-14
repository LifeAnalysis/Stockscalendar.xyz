"use client";

/* eslint-disable @next/next/no-img-element */
import { useAppKit, useAppKitAccount, useAppKitNetwork, useDisconnect } from "@reown/appkit/react";
import * as React from "react";
import { usePublicClient, useSendTransaction } from "wagmi";
import { HermesReasoningGraph } from "./components/HermesReasoningGraph.jsx";
import {
  ConfidenceDecomposition,
  DataProvenanceView,
  EarningsBacktestTable,
  EarningsCalendar,
  HermesDataTable,
  HermesFinalOutput,
  HermesOutputBar,
  PredictionMarketOverlay,
  PostTradeJournal,
  formatConfidence,
  monthStart,
  previewHermesOutput
} from "./components/HermesModules.jsx";
import {
  ArrowDownIcon,
  CHART_RANGES,
  ChartRangeControls,
  FRONTEND_ERC20_ABI,
  GithubIcon,
  Logo,
  MiniStockChart,
  MotionAsset,
  StockChartView,
  TokenButton,
  TokenPicker,
  XIcon,
  decorateStock,
  extractTransactionRequests,
  formatTokenUnits,
  quoteOutputDisplay,
  quoteOutputParts,
  readJsonResponse,
  shortenAddress,
  swapPaymentTokens,
  toBigIntValue
} from "./components/HermesShared.jsx";
import {
  ROBINHOOD_CHAIN_EXPLORER,
  ROBINHOOD_CHAIN_ID,
  isReownConfigured,
  robinhoodChain
} from "./web3/config";
import { earningsEvents } from "./earningsData.js";

const Dither = React.lazy(() => import("./Dither.jsx"));
const JOURNAL_STORAGE_KEY = "hermes-post-trade-journal";
const HERMES_PROGRESS = {
  boot: { percent: 8, label: "Loading stock desk", detail: "Preparing the Robinhood token catalog." },
  sources: { percent: 28, label: "Checking market context", detail: "Reading supported stocks and route readiness." },
  intel: { percent: 58, label: "Building stock context", detail: "Loading quotes, filings, calendars, and markets." },
  model: { percent: 82, label: "Hermes model running", detail: "The frontend is ready while Hermes finishes the research output." },
  ready: { percent: 100, label: "Hermes output ready", detail: "Research output is available." },
  degraded: { percent: 100, label: "Hermes output degraded", detail: "Using deterministic stock context until Hermes responds cleanly." }
};
function App() {
  const { open } = useAppKit();
  const { address, isConnected } = useAppKitAccount({ namespace: "eip155" });
  const { chainId, switchNetwork } = useAppKitNetwork();
  const { disconnect } = useDisconnect();
  const publicClient = usePublicClient({ chainId: ROBINHOOD_CHAIN_ID });
  const { sendTransactionAsync, isPending: walletPending } = useSendTransaction();
  const swapShellRef = React.useRef(null);
  const quoteRequestRef = React.useRef("");

  const [selected, setSelected] = React.useState("TSLA");
  const [side, setSide] = React.useState("buy");
  const [stocks, setStocks] = React.useState([]);
  const [payTokens, setPayTokens] = React.useState([]);
  const [payTokenSymbol, setPayTokenSymbol] = React.useState("WETH");
  const [amount, setAmount] = React.useState("");
  const [tokenPicker, setTokenPicker] = React.useState(null);
  const [backend, setBackend] = React.useState({ health: false, intel: false, trade: false });
  const [hermesOutput, setHermesOutput] = React.useState(null);
  const [hermesLoading, setHermesLoading] = React.useState(true);
  const [hermesProgress, setHermesProgress] = React.useState(HERMES_PROGRESS.boot);
  const [backtests, setBacktests] = React.useState({});
  const [backtestStatus, setBacktestStatus] = React.useState("idle");
  const [charts, setCharts] = React.useState({});
  const [miniCharts, setMiniCharts] = React.useState({});
  const [chartStatus, setChartStatus] = React.useState("idle");
  const [chartRange, setChartRange] = React.useState("1M");
  const [detailsOpen, setDetailsOpen] = React.useState(false);
  const [calendarMonth, setCalendarMonth] = React.useState(() => monthStart(new Date()));
  const [quote, setQuote] = React.useState(null);
  const [quoteTransactions, setQuoteTransactions] = React.useState([]);
  const [tradeStatus, setTradeStatus] = React.useState("");
  const [tradeError, setTradeError] = React.useState("");
  const [txHashes, setTxHashes] = React.useState([]);
  const [isPreparingQuote, setIsPreparingQuote] = React.useState(false);
  const [isExecutingQuote, setIsExecutingQuote] = React.useState(false);
  const [isLoadingMax, setIsLoadingMax] = React.useState(false);
  const [sourceBalance, setSourceBalance] = React.useState({ status: "idle", display: "" });
  const [tradeConfirmation, setTradeConfirmation] = React.useState(null);
  const [journalEntries, setJournalEntries] = React.useState([]);
  const [journalExpanded, setJournalExpanded] = React.useState(false);
  const [overlayBySymbol, setOverlayBySymbol] = React.useState({});

  const stock = stocks.find((item) => item.symbol === selected);
  const hermesOverlayOn = overlayBySymbol[stock?.symbol] ?? true;
  const setHermesOverlay = React.useCallback(
    (value) => {
      const symbol = stock?.symbol;
      if (!symbol) return;
      setOverlayBySymbol((prev) => ({ ...prev, [symbol]: value }));
    },
    [stock?.symbol],
  );
  const payToken = payTokens.find((token) => token.symbol === payTokenSymbol) || payTokens[0];
  const sourceToken = side === "sell" ? stock : payToken;
  const targetToken = side === "sell" ? payToken : stock;
  const quotedOutput = quoteOutputDisplay(quote, targetToken?.symbol);
  const journalSectionRef = React.useRef(null);
  const selectedChartData = stock ? charts[stock.symbol] || [] : [];
  const wallet = address || "";
  const connectedToRobinhood = Number(chainId) === ROBINHOOD_CHAIN_ID;
  const tradeBusy = isPreparingQuote || isExecutingQuote || walletPending;
  const openStockDetails = React.useCallback((symbol) => {
    setSelected(symbol);
    setDetailsOpen(true);
  }, []);

  React.useEffect(() => {
    if (!tokenPicker) return undefined;

    const handlePointerDown = (event) => {
      if (!swapShellRef.current || swapShellRef.current.contains(event.target)) return;
      setTokenPicker(null);
    };

    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [tokenPicker]);

  const loadYahooCharts = React.useCallback(async (symbols, rangeLabel) => {
    if (!symbols.length) {
      setCharts({});
      setChartStatus("idle");
      return;
    }
    const rangeConfig = CHART_RANGES.find((item) => item.label === rangeLabel) || CHART_RANGES[2];
    setChartStatus("loading");
    try {
      const params = new URLSearchParams({
        symbols: symbols.join(","),
        range: rangeConfig.range,
        interval: rangeConfig.interval
      });
      const res = await fetch(`/api/stocks/chart?${params.toString()}`, { cache: "no-store" });
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

  const loadMonthlyMiniCharts = React.useCallback(async (symbols) => {
    if (!symbols.length) {
      setMiniCharts({});
      return;
    }
    try {
      const params = new URLSearchParams({
        symbols: symbols.join(","),
        range: "1mo",
        interval: "1d"
      });
      const res = await fetch(`/api/stocks/chart?${params.toString()}`, { cache: "no-store" });
      const payload = await readJsonResponse(res);
      const entries = (payload?.charts || [])
        .filter((chart) => chart.ok && chart.data?.length)
        .map((chart) => [chart.symbol, chart.data]);
      setMiniCharts(Object.fromEntries(entries));
    } catch (error) {
      console.warn("Yahoo mini chart API unavailable", error);
      setMiniCharts({});
    }
  }, []);

  React.useEffect(() => {
    let cancelled = false;

    function applyIntel(intel, nextBackend) {
      if (!intel) return;
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
      if (loadedTokens.length) {
        const supportedPayTokens = swapPaymentTokens(loadedTokens);
        setPayTokens(supportedPayTokens);
        if (!supportedPayTokens.some((token) => token.symbol === payTokenSymbol)) {
          setPayTokenSymbol(supportedPayTokens[0]?.symbol || "");
        }
      }
    }

    async function loadBackend() {
      const nextBackend = { health: false, intel: false, trade: false };
      setHermesProgress(HERMES_PROGRESS.sources);
      try {
        const healthRes = await fetch("/api/health");
        const health = await readJsonResponse(healthRes);
        if (cancelled) return;
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
        if (cancelled) return;
        const loadedStocks = catalog?.stocks || [];
        const loadedTokens = catalog?.payment_tokens || [];
        if (loadedStocks.length) {
          const nextStocks = loadedStocks.map((item, index) => decorateStock(item, index));
          setStocks(nextStocks);
          if (!nextStocks.some((item) => item.symbol === selected)) setSelected(nextStocks[0]?.symbol || "");
        }
        if (loadedTokens.length) {
          const supportedPayTokens = swapPaymentTokens(loadedTokens);
          setPayTokens(supportedPayTokens);
          if (!supportedPayTokens.some((token) => token.symbol === payTokenSymbol)) {
            setPayTokenSymbol(supportedPayTokens[0]?.symbol || "");
          }
        }
      } catch (error) {
        console.warn("Robinhood stock API unavailable", error);
      }
      setBackend(nextBackend);

      try {
        setHermesLoading(true);
        setHermesProgress(HERMES_PROGRESS.intel);
        const intelRes = await fetch("/api/robinhood/intel?compact=1");
        const intel = await readJsonResponse(intelRes);
        if (cancelled) return;
        if (intel) {
          applyIntel(intel, nextBackend);
          setHermesOutput(previewHermesOutput(intel));
          setBackend({ ...nextBackend });
        }

        setHermesProgress(HERMES_PROGRESS.ready);
      } catch (error) {
        console.warn("Stock intel unavailable", error);
        if (!cancelled) setHermesProgress(HERMES_PROGRESS.degraded);
      } finally {
        if (!cancelled) setHermesLoading(false);
      }
    }
    loadBackend();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  React.useEffect(() => {
    if (!selected || !stocks.some((item) => item.symbol === selected)) return undefined;
    let cancelled = false;

    async function loadSelectedHermesOutput() {
      setHermesLoading(true);
      setHermesProgress(HERMES_PROGRESS.model);
      try {
        const params = new URLSearchParams({ symbol: selected });
        const outputRes = await fetch(`/api/hermes/output?${params.toString()}`, { cache: "no-store" });
        const output = await readJsonResponse(outputRes);
        if (cancelled) return;
        if (output) setHermesOutput(output);
        setHermesProgress(HERMES_PROGRESS.ready);
      } catch (error) {
        console.warn("Selected Hermes output unavailable", error);
        if (!cancelled) setHermesProgress(HERMES_PROGRESS.degraded);
      } finally {
        if (!cancelled) setHermesLoading(false);
      }
    }

    loadSelectedHermesOutput();
    return () => {
      cancelled = true;
    };
  }, [selected, stocks]);

  React.useEffect(() => {
    loadYahooCharts(stocks.map((item) => item.symbol), chartRange);
  }, [chartRange, loadYahooCharts, stocks]);

  React.useEffect(() => {
    if (!selected) return undefined;
    let cancelled = false;
    async function loadBacktest() {
      setBacktestStatus("loading");
      try {
        const res = await fetch(`/api/hermes/backtest?symbol=${encodeURIComponent(selected)}`);
        const payload = await readJsonResponse(res);
        if (cancelled) return;
        setBacktests((current) => ({ ...current, [selected]: payload }));
        setBacktestStatus(payload?.ok ? "ready" : "error");
      } catch (error) {
        console.warn("Hermes backtest unavailable", error);
        if (!cancelled) setBacktestStatus("error");
      }
    }
    loadBacktest();
    return () => {
      cancelled = true;
    };
  }, [selected]);

  React.useEffect(() => {
    loadMonthlyMiniCharts(stocks.map((item) => item.symbol));
  }, [loadMonthlyMiniCharts, stocks]);

  React.useEffect(() => {
    setQuote(null);
    setQuoteTransactions([]);
    setTxHashes([]);
    setTradeStatus("");
    setTradeError("");
  }, [selected, payTokenSymbol, side, amount]);

  React.useEffect(() => {
    if (!sourceToken) {
      setSourceBalance({ status: "idle", display: "" });
      return undefined;
    }
    if (!isConnected || !wallet) {
      setSourceBalance({ status: "idle", display: "Connect wallet" });
      return undefined;
    }
    if (!connectedToRobinhood) {
      setSourceBalance({ status: "idle", display: "Switch to Robinhood" });
      return undefined;
    }
    if (!publicClient) {
      setSourceBalance({ status: "loading", display: "Loading balance" });
      return undefined;
    }

    let cancelled = false;
    async function loadSourceBalance() {
      setSourceBalance({ status: "loading", display: "Loading balance" });
      try {
        const usesNativeBalance = side === "buy";
        const decimals = usesNativeBalance
          ? 18
          : Number(await publicClient.readContract({
              address: sourceToken.address,
              abi: FRONTEND_ERC20_ABI,
              functionName: "decimals"
            }));
        const rawBalance = usesNativeBalance
          ? await publicClient.getBalance({ address: wallet })
          : await publicClient.readContract({
              address: sourceToken.address,
              abi: FRONTEND_ERC20_ABI,
              functionName: "balanceOf",
              args: [wallet]
            });
        if (cancelled) return;
        const formatted = formatTokenUnits(rawBalance, decimals, 6) || "0";
        setSourceBalance({ status: "ready", display: `${formatted} ${sourceToken.symbol}` });
      } catch (error) {
        if (!cancelled) {
          setSourceBalance({
            status: "error",
            display: `${sourceToken.symbol} balance unavailable`
          });
        }
      }
    }

    loadSourceBalance();
    return () => {
      cancelled = true;
    };
  }, [connectedToRobinhood, isConnected, publicClient, side, sourceToken, wallet]);

  React.useEffect(() => {
    const cleanAmount = amount.trim();
    if (!isConnected || !connectedToRobinhood || !backend.trade || !stock || !payToken || !wallet || !cleanAmount) return undefined;
    if (!Number.isFinite(Number(cleanAmount)) || Number(cleanAmount) <= 0) return undefined;

    const isSell = side === "sell";
    const payload = {
      action: side,
      source_asset: isSell ? stock.address : payToken.address,
      target_asset: isSell ? payToken.address : stock.address,
      amount: cleanAmount,
      wallet_address: wallet,
      provider: "auto",
      strategy: `Hermes Robinhood Chain ${side} route for ${stock.symbol}`
    };
    const requestKey = JSON.stringify(payload);
    const timer = window.setTimeout(() => {
      prepareQuoteFromPayload(payload, { journal: false, requestKey });
    }, 450);

    return () => {
      window.clearTimeout(timer);
      if (quoteRequestRef.current === requestKey) quoteRequestRef.current = "";
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [amount, backend.trade, connectedToRobinhood, isConnected, payToken?.address, side, stock?.address, stock?.symbol, wallet]);

  React.useEffect(() => {
    try {
      const stored = window.localStorage.getItem(JOURNAL_STORAGE_KEY);
      if (stored) setJournalEntries(JSON.parse(stored));
    } catch (error) {
      console.warn("Unable to load Hermes journal", error);
    }
  }, []);

  React.useEffect(() => {
    try {
      window.localStorage.setItem(JOURNAL_STORAGE_KEY, JSON.stringify(journalEntries.slice(0, 50)));
    } catch (error) {
      console.warn("Unable to save Hermes journal", error);
    }
  }, [journalEntries]);

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

  function appendJournalEntry(status, extra = {}) {
    if (!stock) return;
    const { decision } = getHermesContext(stock, hermesOutput);
    const entry = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      timestamp: new Date().toISOString(),
      status,
      symbol: stock.symbol,
      side,
      amount: amount.trim(),
      sourceSymbol: sourceToken?.symbol,
      targetSymbol: targetToken?.symbol,
      wallet,
      hermesAction: decision?.action,
      hermesConfidence: decision?.confidence,
      quoteSummary: extra.quote ? {
        ok: extra.quote.ok,
        message: extra.quote.message || extra.quote.error || null
      } : null,
      outputAmount: quoteOutputDisplay(extra.quote || quote, targetToken?.symbol),
      hashes: extra.hashes || []
    };
    setJournalEntries((current) => [entry, ...current].slice(0, 50));
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

  async function applyMaxAmount() {
    if (!isConnected) {
      await connectWallet();
      return;
    }
    if (!connectedToRobinhood) {
      await switchToRobinhood();
      return;
    }
    if (!publicClient || !wallet || !sourceToken) {
      setTradeError("Wallet balance is not available yet.");
      return;
    }

    setIsLoadingMax(true);
    setTradeError("");
    try {
      const isBuy = side === "buy";
      const decimals = isBuy
        ? 18
        : Number(await publicClient.readContract({
            address: sourceToken.address,
            abi: FRONTEND_ERC20_ABI,
            functionName: "decimals"
          }));
      const rawBalance = isBuy
        ? await publicClient.getBalance({ address: wallet })
        : await publicClient.readContract({
            address: sourceToken.address,
            abi: FRONTEND_ERC20_ABI,
            functionName: "balanceOf",
            args: [wallet]
          });
      const spendableBalance = isBuy ? rawBalance - rawBalance / 100n : rawBalance;
      const safeBalance = spendableBalance > 0n ? spendableBalance : 0n;
      const formatted = formatTokenUnits(safeBalance, decimals, 18) || "0";
      setAmount(formatted);
      setTradeStatus(`Max ${sourceToken.symbol} amount loaded.`);
    } catch (error) {
      setTradeError(`Could not read ${sourceToken.symbol} balance: ${error?.shortMessage || error?.message || "unknown error"}`);
    } finally {
      setIsLoadingMax(false);
    }
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
      appendJournalEntry("tx_confirmed", { hashes, quote });
      const output = quoteOutputParts(quote, targetToken?.symbol);
      const finalHash = hashes[hashes.length - 1];
      setTradeConfirmation({
        amount: output?.amount || "",
        asset: output?.asset || targetToken?.symbol || "",
        side,
        sourceAmount: amount.trim(),
        sourceAsset: sourceToken?.symbol || "",
        hash: finalHash,
        explorerUrl: finalHash ? `${ROBINHOOD_CHAIN_EXPLORER}/tx/${finalHash}` : ""
      });
    } catch (error) {
      setTradeError(error?.shortMessage || error?.message || "Wallet transaction failed.");
    } finally {
      setIsExecutingQuote(false);
    }
  }

  async function prepareQuoteFromPayload(payload, options = {}) {
    const requestKey = options.requestKey || JSON.stringify(payload);
    quoteRequestRef.current = requestKey;
    setIsPreparingQuote(true);
    setTradeError("");
    setTradeStatus("Preparing Quote...");
    try {
      const res = await fetch("/api/robinhood/trade", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const prepared = await readJsonResponse(res);
      if (quoteRequestRef.current !== requestKey) return null;
      if (!res.ok || !prepared) {
        setTradeError(`Quote request failed with status ${res.status}.`);
        return null;
      }
      if (prepared.ok === false) {
        setQuote(prepared);
        setQuoteTransactions([]);
        setTradeError(prepared.message || prepared.error || "Quote request was rejected.");
        if (options.journal !== false) appendJournalEntry("quote_rejected", { quote: prepared });
        return prepared;
      }
      const transactions = extractTransactionRequests(prepared);
      setQuote(prepared);
      setQuoteTransactions(transactions);
      setTradeStatus(transactions.length ? "" : "Quote prepared, but the response did not include an executable wallet transaction.");
      return prepared;
    } catch (error) {
      if (quoteRequestRef.current !== requestKey) return null;
      setTradeError(`Quote request failed: ${error.message}`);
      return null;
    } finally {
      if (quoteRequestRef.current === requestKey) setIsPreparingQuote(false);
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
    if (!backend.trade) {
      setTradeError("DEX quote preparation is unavailable. Check Robinhood Chain RPC and DEX configuration.");
      return;
    }

    const payload = routePayload();
    if (!payload) {
      setTradeError("Select a stock before preparing a quote.");
      return;
    }
    if (!payload.wallet_address || !payload.amount) {
      setTradeError("Connect wallet and enter an amount to prepare a quote.");
      return;
    }
    await prepareQuoteFromPayload(payload);
  }

  function submitLabel() {
    if (!isReownConfigured) return "Add Reown project ID";
    if (!isConnected) return "Connect wallet";
    if (!connectedToRobinhood) return "Switch to Robinhood";
    if (isPreparingQuote) return "Preparing Quote";
    if (isLoadingMax) return "Reading balance";
    if (isExecutingQuote || walletPending) return "Waiting for wallet";
    if (quoteTransactions.length) return "Swap";
    if (!backend.trade) return "DEX unavailable";
    if (!amount.trim()) return "Enter Amount";
    if (tradeError) return "Retry quote";
    return "Waiting for quote";
  }

  function selectToken(kind, item) {
    if (kind === "stock") setSelected(item.symbol);
    if (kind === "pay") setPayTokenSymbol(item.symbol);
    setTokenPicker(null);
  }

  function toggleTokenPicker(kind) {
    setTokenPicker((current) => (current === kind ? null : kind));
  }

  function goToJournal() {
    setTradeConfirmation(null);
    setJournalExpanded(true);
    window.setTimeout(() => {
      journalSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 0);
  }

  const tradeConfirmationAsset = tradeConfirmation
    ? [...stocks, ...payTokens].find((item) => item.symbol === tradeConfirmation.asset)
    : null;

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
                    onClick={() => openStockDetails(item.symbol)}
                  >
                    <Logo stock={item} />
                    <span><strong>{item.symbol}</strong><span>{item.name}</span></span>
                    <MiniStockChart data={miniCharts[item.symbol] || []} />
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </header>

      <main className={`workspace ${stock && detailsOpen ? "revealed" : ""}`}>
        <section className="control-stack">
          <form className="panel trade-ticket" onSubmit={submitTrade}>
            <div className="swap-shell" ref={swapShellRef}>
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
                    onClick={() => toggleTokenPicker(side === "sell" ? "stock" : "pay")}
                  />
                  <div className="amount-entry">
                    <div className="amount-input-row">
                      <input inputMode="decimal" aria-label="Trade amount" placeholder="0" value={amount} onChange={(event) => setAmount(event.target.value)} />
                      <button className="amount-max-button" type="button" onClick={applyMaxAmount} disabled={isLoadingMax || walletPending}>
                        {isLoadingMax ? "..." : "Max"}
                      </button>
                    </div>
                    <div className={`asset-balance-line ${sourceBalance.status === "error" ? "error" : ""}`} aria-live="polite">
                      <span>Balance</span>
                      <strong>{sourceBalance.display || "-"}</strong>
                    </div>
                  </div>
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
                    onClick={() => toggleTokenPicker(side === "sell" ? "pay" : "stock")}
                  />
                  <div className="amount-entry readout" aria-label="Estimated output amount">
                    <strong>{quotedOutput || "-"}</strong>
                    {isPreparingQuote ? <span>Fetching quote</span> : null}
                  </div>
                </div>
              </div>

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

              <div className="wallet-route-stack">
                <div className="wallet-row wallet-connect-row">
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
                    <button className="wallet-address-button connect-wallet-button" type="button" onClick={connectWallet}>
                      Connect
                    </button>
                  )}
                </div>
                {isConnected && !connectedToRobinhood && (
                  <div className={`network-row ${connectedToRobinhood ? "ready" : ""}`}>
                    <span>Wrong network</span>
                    <button type="button" onClick={switchToRobinhood}>
                      Switch
                    </button>
                  </div>
                )}
                {(tradeStatus || tradeError || txHashes.length > 0) && (
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

              {isConnected ? (
                <button className="swap-submit" type="submit" disabled={tradeBusy || isLoadingMax || !isReownConfigured}>
                  <MotionAsset src="/media/icons/wallet-connect-orb.mp4" webmSrc="/media/icons/wallet-connect-orb.webm" className="submit-motion" />
                  <span>{submitLabel()}</span>
                </button>
              ) : null}
              <p className="powered-by-chain">Powered by <span>Robinhood Chain</span></p>
            </div>
          </form>

          <section className="panel stock-section">
            <div className="stock-section-title">
              <MotionAsset src="/media/icons/wallet-connect-orb.mp4" webmSrc="/media/icons/wallet-connect-orb.webm" className="menu-title-motion" />
              <span>Deep Dive Stocks</span>
            </div>
            <div className="stocks-grid">
              {stocks.map((item) => (
                <article className={`stock-card ${item.symbol === selected ? "active" : ""}`} key={item.symbol}>
                  <button
                    className="stock-select"
                    type="button"
                    onClick={() => openStockDetails(item.symbol)}
                  >
                    <div className="stock-top">
                      <Logo stock={item} />
                      <div className="ticker">{item.symbol}</div>
                    </div>
                    <MiniStockChart data={miniCharts[item.symbol] || []} />
                  </button>
                </article>
              ))}
            </div>
          </section>
          <EarningsCalendar
            events={earningsEvents}
            stocks={stocks}
            monthDate={calendarMonth}
            onMonthChange={setCalendarMonth}
            onSelectStock={openStockDetails}
          />
          <PostTradeJournal
            entries={journalEntries}
            stock={stock}
            sectionRef={journalSectionRef}
            expanded={journalExpanded}
            onExpandedChange={setJournalExpanded}
          />
        </section>

        {stock && detailsOpen && (
          <section className="panel research-panel" aria-label="Selected stock research">
              <div className="research-heading">
              <div className="research-title">
                <Logo stock={stock} />
                <div>
                  <h2>{stock.symbol}</h2>
                </div>
              </div>
              <ChartRangeControls selectedRange={chartRange} onRangeChange={setChartRange} />
              <button className="mobile-detail-close" type="button" aria-label="Close selected stock research" onClick={() => setDetailsOpen(false)}>
                <XIcon />
              </button>
              </div>
            <div className="detail-stack">
              <StockChartView
                data={selectedChartData}
                ticker={stock.symbol}
                status={chartStatus}
                selectedRange={chartRange}
              />
              <HermesOutputBar stock={stock} hermesOutput={hermesOutput} loading={hermesLoading} progress={hermesProgress} overlay={hermesOverlayOn} />
              <HermesFinalOutput hermesOutput={hermesOutput} loading={hermesLoading} />
              <ConfidenceDecomposition stock={stock} hermesOutput={hermesOutput} overlay={hermesOverlayOn} onToggleOverlay={setHermesOverlay} />
              <HermesReasoningGraph stock={stock} hermesOutput={hermesOutput} loading={hermesLoading} />
              <EarningsBacktestTable stock={stock} backtest={backtests[stock.symbol]} loading={backtestStatus === "loading" && !backtests[stock.symbol]} />
              <PredictionMarketOverlay stock={stock} hermesOutput={hermesOutput} loading={hermesLoading} />
              <DataProvenanceView hermesOutput={hermesOutput} />
            </div>
          </section>
        )}
      </main>
      {tradeConfirmation ? (
        <div className="trade-confirmation-backdrop" role="presentation">
          <section className="trade-confirmation-modal" role="dialog" aria-modal="true" aria-label="Swap confirmed">
            <div className="trade-confirmation-head">
              <div>
                <span>Swap confirmed</span>
                <h3>{tradeConfirmation.side === "buy" ? "Bought" : "Received"} {tradeConfirmation.asset || "Asset"}</h3>
              </div>
              <button type="button" aria-label="Close confirmation" onClick={() => setTradeConfirmation(null)}>
                <XIcon />
              </button>
            </div>
            {tradeConfirmationAsset ? (
              <Logo stock={tradeConfirmationAsset} />
            ) : null}
            <div className="trade-confirmation-amount">
              <strong>{tradeConfirmation.amount || "-"}</strong>
              <span>{tradeConfirmation.asset || "Asset"}</span>
            </div>
            {tradeConfirmation.explorerUrl ? (
              <a className="trade-confirmation-link" href={tradeConfirmation.explorerUrl} target="_blank" rel="noreferrer">
                View transaction {shortenAddress(tradeConfirmation.hash)}
              </a>
            ) : null}
            <button className="trade-confirmation-link secondary" type="button" onClick={goToJournal}>
              Go to journal
            </button>
          </section>
        </div>
      ) : null}
      <footer className="app-footer">
        <a href="https://github.com/LifeAnalysis" target="_blank" rel="noreferrer">
          <GithubIcon />
          <span>Built by LifeAnalysis</span>
        </a>
        <span>
          Built using Hermes, custom model, Robinhood Chain, and Kalshi data feed
        </span>
        <a href="https://twitter.com/kuerax" target="_blank" rel="noreferrer">
          <span>@kuerax on Twitter</span>
        </a>
      </footer>
    </>
  );
}

export default App;
