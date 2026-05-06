import { useState, useEffect, useRef, useCallback } from "react";

// ─── INSTRUMENTS ────────────────────────────────────────────────────────────
const INSTRUMENTS_DEF = [
  { ticker: "AAPL", name: "Apple Inc.", lotSize: 10, nominal: 189.50 },
  { ticker: "TSLA", name: "Tesla Inc.", lotSize: 1, nominal: 248.00 },
  { ticker: "MSFT", name: "Microsoft Corp.", lotSize: 10, nominal: 415.20 },
  { ticker: "GOOGL", name: "Alphabet Inc.", lotSize: 1, nominal: 178.90 },
  { ticker: "AMZN", name: "Amazon.com", lotSize: 10, nominal: 192.40 },
  { ticker: "NVDA", name: "NVIDIA Corp.", lotSize: 10, nominal: 875.50 },
  { ticker: "META", name: "Meta Platforms", lotSize: 10, nominal: 510.30 },
  { ticker: "JPM", name: "JPMorgan Chase", lotSize: 100, nominal: 198.70 },
  { ticker: "BAC", name: "Bank of America", lotSize: 100, nominal: 38.50 },
  { ticker: "GS", name: "Goldman Sachs", lotSize: 10, nominal: 465.20 },
  { ticker: "XOM", name: "ExxonMobil Corp.", lotSize: 100, nominal: 112.40 },
  { ticker: "CVX", name: "Chevron Corp.", lotSize: 100, nominal: 158.30 },
  { ticker: "JNJ", name: "Johnson & Johnson", lotSize: 10, nominal: 157.80 },
  { ticker: "PFE", name: "Pfizer Inc.", lotSize: 100, nominal: 27.40 },
  { ticker: "UNH", name: "UnitedHealth Group", lotSize: 10, nominal: 498.60 },
  { ticker: "WMT", name: "Walmart Inc.", lotSize: 10, nominal: 68.90 },
  { ticker: "HD", name: "Home Depot", lotSize: 10, nominal: 341.50 },
  { ticker: "DIS", name: "Walt Disney Co.", lotSize: 10, nominal: 112.30 },
  { ticker: "NFLX", name: "Netflix Inc.", lotSize: 1, nominal: 625.40 },
  { ticker: "PYPL", name: "PayPal Holdings", lotSize: 10, nominal: 62.80 },
  { ticker: "INTC", name: "Intel Corp.", lotSize: 100, nominal: 32.10 },
  { ticker: "AMD", name: "Advanced Micro", lotSize: 10, nominal: 178.60 },
  { ticker: "CRM", name: "Salesforce Inc.", lotSize: 10, nominal: 298.40 },
  { ticker: "ORCL", name: "Oracle Corp.", lotSize: 10, nominal: 125.70 },
  { ticker: "IBM", name: "IBM Corp.", lotSize: 10, nominal: 188.20 },
  { ticker: "BA", name: "Boeing Co.", lotSize: 10, nominal: 198.50 },
  { ticker: "CAT", name: "Caterpillar Inc.", lotSize: 10, nominal: 368.90 },
  { ticker: "GE", name: "GE Aerospace", lotSize: 100, nominal: 162.40 },
];

const ROUND_DURATION = 300; // 5 minutes
const TICK_MS = 200;
const RISK_THRESHOLD = 5; // lots

// ─── MARKET ENGINE ──────────────────────────────────────────────────────────
function initMarketState(instruments) {
  const state = {};
  instruments.forEach((inst) => {
    state[inst.ticker] = {
      fairPrice: inst.nominal,
      momentum: 0,
      spread: inst.nominal * 0.005,
    };
  });
  return state;
}

function generateOrderBook(ticker, fairPrice, spread, tickSize) {
  const levels = 8;
  const bids = [];
  const asks = [];
  const mid = fairPrice;
  const halfSpread = spread / 2;

  for (let i = 0; i < levels; i++) {
    const bidPrice = parseFloat((mid - halfSpread - i * tickSize).toFixed(4));
    const askPrice = parseFloat((mid + halfSpread + i * tickSize).toFixed(4));
    const decay = Math.exp(-i * 0.4);
    const bidVol = Math.max(1, Math.round((100 + Math.random() * 200) * decay));
    const askVol = Math.max(1, Math.round((100 + Math.random() * 200) * decay));
    bids.push({ price: bidPrice, size: bidVol });
    asks.push({ price: askPrice, size: askVol });
  }
  return { bids, asks };
}

function stepMarket(prev, instruments) {
  const next = {};
  instruments.forEach((inst) => {
    const s = prev[inst.ticker];
    const tickSize = inst.nominal < 10 ? 0.001 : inst.nominal < 100 ? 0.01 : inst.nominal < 1000 ? 0.1 : 0.5;
    const sigma = inst.nominal * 0.0008;
    const eps = (Math.random() - 0.5) * 2 * sigma;
    const newMomentum = s.momentum * 0.95 + eps * 0.1;
    const jump = Math.random() < 0.005 ? (Math.random() - 0.5) * inst.nominal * 0.015 : 0;
    const newFair = Math.max(inst.nominal * 0.5, s.fairPrice + newMomentum + eps + jump);
    const spreadNoise = (Math.random() - 0.5) * s.spread * 0.1;
    const newSpread = Math.max(inst.nominal * 0.002, s.spread + spreadNoise);
    const book = generateOrderBook(inst.ticker, newFair, newSpread, tickSize);
    next[inst.ticker] = { fairPrice: newFair, momentum: newMomentum, spread: newSpread, book };
  });
  return next;
}

// ─── MAIN COMPONENT ──────────────────────────────────────────────────────────
export default function MarketMakerSim() {
  const [tab, setTab] = useState("dashboard");
  const [market, setMarket] = useState(() => {
    const init = initMarketState(INSTRUMENTS_DEF);
    const withBooks = {};
    INSTRUMENTS_DEF.forEach((inst) => {
      const s = init[inst.ticker];
      const tickSize = inst.nominal < 10 ? 0.001 : inst.nominal < 100 ? 0.01 : inst.nominal < 1000 ? 0.1 : 0.5;
      withBooks[inst.ticker] = { ...s, book: generateOrderBook(inst.ticker, s.fairPrice, s.spread, tickSize) };
    });
    return withBooks;
  });
  const [positions, setPositions] = useState({}); // { ticker: { lots, avgPrice, realizedPnl } }
  const [orders, setOrders] = useState([]); // active limit orders
  const [fills, setFills] = useState([]); // fill history
  const [roundTime, setRoundTime] = useState(ROUND_DURATION);
  const [roundActive, setRoundActive] = useState(false);
  const [popup, setPopup] = useState(null); // { ticker, side, price }
  const [lastOrder, setLastOrder] = useState(null);
  const [flashTickers, setFlashTickers] = useState({});
  const tickRef = useRef(null);
  const roundRef = useRef(null);

  // Timer
  useEffect(() => {
    if (roundActive && roundTime > 0) {
      roundRef.current = setInterval(() => setRoundTime((t) => t - 1), 1000);
    } else if (roundTime === 0) {
      setRoundActive(false);
    }
    return () => clearInterval(roundRef.current);
  }, [roundActive, roundTime]);

  const ordersRef = useRef([]);
  useEffect(() => { ordersRef.current = orders; }, [orders]);

  // Market tick
  useEffect(() => {
    if (!roundActive) return;
    tickRef.current = setInterval(() => {
      setMarket((prev) => {
        const nextMarket = stepMarket(prev, INSTRUMENTS_DEF);

        const prevOrders = ordersRef.current;
        const remaining = [];
        const newFills = [];
        prevOrders.forEach((ord) => {
          const book = nextMarket[ord.ticker]?.book;
          if (!book) { remaining.push(ord); return; }
          let filled = false;
          if (ord.side === "buy") {
            const bestAsk = book.asks[0]?.price;
            if (bestAsk !== undefined && ord.price >= bestAsk) {
              newFills.push({ ...ord, fillPrice: bestAsk, time: Date.now() });
              filled = true;
            }
          } else {
            const bestBid = book.bids[0]?.price;
            if (bestBid !== undefined && ord.price <= bestBid) {
              newFills.push({ ...ord, fillPrice: bestBid, time: Date.now() });
              filled = true;
            }
          }
          if (!filled) remaining.push(ord);
        });

        ordersRef.current = remaining;
        setOrders(remaining);

        if (newFills.length > 0) {
          setPositions((prevPos) => {
            const p = { ...prevPos };
            newFills.forEach((f) => {
              const cur = p[f.ticker] || { lots: 0, avgPrice: 0, realizedPnl: 0 };
              const sign = f.side === "buy" ? 1 : -1;
              const newLots = cur.lots + sign * f.lots;
              let newAvg = cur.avgPrice;
              let realized = cur.realizedPnl;
              if (f.side === "buy") {
                if (cur.lots >= 0) newAvg = cur.lots === 0 ? f.fillPrice : (cur.avgPrice * cur.lots + f.fillPrice * f.lots) / (cur.lots + f.lots);
                else { realized += (cur.avgPrice - f.fillPrice) * Math.min(f.lots, -cur.lots); newAvg = newLots > 0 ? f.fillPrice : cur.avgPrice; }
              } else {
                if (cur.lots <= 0) newAvg = cur.lots === 0 ? f.fillPrice : (Math.abs(cur.avgPrice) * Math.abs(cur.lots) + f.fillPrice * f.lots) / (Math.abs(cur.lots) + f.lots);
                else { realized += (f.fillPrice - cur.avgPrice) * Math.min(f.lots, cur.lots); newAvg = newLots < 0 ? f.fillPrice : cur.avgPrice; }
              }
              p[f.ticker] = { lots: newLots, avgPrice: newAvg, realizedPnl: realized };
            });
            return p;
          });
          setFills((pf) => [...newFills, ...pf].slice(0, 50));
          const flashUpdate = {};
          newFills.forEach((f) => { flashUpdate[f.ticker] = Date.now(); });
          setFlashTickers((pf) => ({ ...pf, ...flashUpdate }));
        }

        return nextMarket;
      });
    }, TICK_MS);
    return () => clearInterval(tickRef.current);
  }, [roundActive]);

  const openPopup = useCallback((ticker, price = null, side = "buy") => {
    setPopup({ ticker, price, side });
  }, []);

  const submitOrder = useCallback((ticker, side, price, lots) => {
    const inst = INSTRUMENTS_DEF.find((i) => i.ticker === ticker);
    if (!inst || !price || !lots) return;
    const ord = { id: Date.now(), ticker, side, price: parseFloat(price), lots: parseInt(lots), lotSize: inst.lotSize };
    setOrders((prev) => [...prev, ord]);
    setLastOrder(ord);
    setPopup(null);
  }, []);

  const fmt = (n, d = 2) => n?.toFixed(d).replace(/\B(?=(\d{3})+(?!\d))/g, " ") ?? "—";

  const mmFmt = (s) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  };

  const totalPnl = INSTRUMENTS_DEF.reduce((acc, inst) => {
    const pos = positions[inst.ticker];
    if (!pos || pos.lots === 0) return acc + (pos?.realizedPnl || 0);
    const mid = market[inst.ticker]?.fairPrice || inst.nominal;
    const unrealized = pos.lots > 0 ? (mid - pos.avgPrice) * pos.lots * inst.lotSize : (pos.avgPrice - mid) * Math.abs(pos.lots) * inst.lotSize;
    return acc + (pos.realizedPnl || 0) + unrealized;
  }, 0);

  return (
    <div style={{ fontFamily: "'JetBrains Mono', 'Courier New', monospace", background: "#0a0e14", color: "#c9d1d9", minHeight: "100vh", display: "flex", flexDirection: "column", fontSize: 13 }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@300;400;500;600;700&display=swap');
        ::-webkit-scrollbar { width: 5px; height: 5px; }
        ::-webkit-scrollbar-track { background: #0d1117; }
        ::-webkit-scrollbar-thumb { background: #2d3748; border-radius: 2px; }
        .row-hover:hover { background: #161b22 !important; cursor: pointer; }
        .tab-btn { padding: 6px 18px; border: none; background: none; color: #586069; cursor: pointer; font-family: inherit; font-size: 12px; font-weight: 500; letter-spacing: 0.08em; text-transform: uppercase; border-bottom: 2px solid transparent; transition: all 0.15s; }
        .tab-btn.active { color: #58a6ff; border-bottom-color: #58a6ff; }
        .tab-btn:hover { color: #c9d1d9; }
        @keyframes flash-green { 0%,100%{background:transparent} 50%{background:rgba(46,160,67,0.3)} }
        @keyframes flash-red { 0%,100%{background:transparent} 50%{background:rgba(248,81,73,0.3)} }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
        .flash-fill { animation: flash-green 0.6s ease; }
        .bid-row { background: rgba(46,160,67,0.06); }
        .ask-row { background: rgba(248,81,73,0.06); }
        .bid-row:hover, .ask-row:hover { background: rgba(88,166,255,0.08) !important; cursor: pointer; }
        .btn-primary { background: #1f6feb; color: #fff; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer; font-family: inherit; font-size: 12px; font-weight: 600; transition: background 0.15s; }
        .btn-primary:hover { background: #388bfd; }
        .btn-secondary { background: #21262d; color: #c9d1d9; border: 1px solid #30363d; padding: 8px 16px; border-radius: 4px; cursor: pointer; font-family: inherit; font-size: 12px; transition: background 0.15s; }
        .btn-secondary:hover { background: #2d333b; }
        input[type=number]::-webkit-inner-spin-button { -webkit-appearance: none; }
        .spinner-btn { background:#21262d; border:1px solid #30363d; color:#c9d1d9; cursor:pointer; width:22px; height:22px; display:flex; align-items:center; justify-content:center; border-radius:3px; font-size:14px; line-height:1; }
        .spinner-btn:hover { background:#2d333b; }
      `}</style>

      {/* ── HEADER ── */}
      <div style={{ background: "#0d1117", borderBottom: "1px solid #21262d", padding: "0 16px", display: "flex", alignItems: "center", gap: 24, height: 48 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ width: 10, height: 10, borderRadius: "50%", background: roundActive ? "#2ea043" : "#484f58", boxShadow: roundActive ? "0 0 6px #2ea043" : "none" }} />
          <span style={{ color: "#58a6ff", fontWeight: 700, fontSize: 14, letterSpacing: "0.05em" }}>MM·SIM</span>
        </div>
        <div style={{ display: "flex", gap: 0, borderBottom: "none" }}>
          <button className={`tab-btn ${tab === "dashboard" ? "active" : ""}`} onClick={() => setTab("dashboard")}>Instruments</button>
          <button className={`tab-btn ${tab === "books" ? "active" : ""}`} onClick={() => setTab("books")}>Order Books</button>
          <button className={`tab-btn ${tab === "fills" ? "active" : ""}`} onClick={() => setTab("fills")}>Fills</button>
        </div>
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 10, color: "#586069", letterSpacing: "0.1em" }}>P&L</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: totalPnl >= 0 ? "#2ea043" : "#f85149" }}>{totalPnl >= 0 ? "+" : ""}{fmt(totalPnl)}</div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 10, color: "#586069", letterSpacing: "0.1em" }}>ROUND</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: roundTime < 30 ? "#f85149" : "#e3b341", fontVariantNumeric: "tabular-nums" }}>{mmFmt(roundTime)}</div>
          </div>
          {!roundActive ? (
            <button className="btn-primary" onClick={() => { setRoundActive(true); setRoundTime(ROUND_DURATION); setPositions({}); setOrders([]); setFills([]); }}>
              ▶ START
            </button>
          ) : (
            <button className="btn-secondary" onClick={() => setRoundActive(false)}>⏸ PAUSE</button>
          )}
        </div>
      </div>

      {/* ── CONTENT ── */}
      <div style={{ flex: 1, overflow: "hidden" }}>
        {tab === "dashboard" && <DashboardTab market={market} positions={positions} orders={orders} roundTime={roundTime} flashTickers={flashTickers} openPopup={openPopup} fmt={fmt} mmFmt={mmFmt} />}
        {tab === "books" && <BooksTab market={market} positions={positions} orders={orders} openPopup={openPopup} fmt={fmt} />}
        {tab === "fills" && <FillsTab fills={fills} fmt={fmt} />}
      </div>

      {/* ── ORDER POPUP ── */}
      {popup && (
        <OrderPopup popup={popup} setPopup={setPopup} market={market} lastOrder={lastOrder} submitOrder={submitOrder} fmt={fmt} />
      )}
    </div>
  );
}

// ─── DASHBOARD TAB ───────────────────────────────────────────────────────────
function DashboardTab({ market, positions, orders, roundTime, flashTickers, openPopup, fmt, mmFmt }) {
  return (
    <div style={{ height: "calc(100vh - 48px)", overflow: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr style={{ background: "#0d1117", position: "sticky", top: 0, zIndex: 10 }}>
            {["Ticker", "Name", "Lot", "Fair Price", "Bid", "Ask", "Status", "Position", "Unreal. P&L", "Timer"].map((h) => (
              <th key={h} style={{ padding: "8px 12px", textAlign: h === "Name" ? "left" : "right", color: "#586069", fontSize: 11, fontWeight: 600, letterSpacing: "0.08em", borderBottom: "1px solid #21262d", whiteSpace: "nowrap" }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {INSTRUMENTS_DEF.map((inst) => {
            const s = market[inst.ticker];
            const pos = positions[inst.ticker];
            const lots = pos?.lots || 0;
            const hasOrder = orders.some((o) => o.ticker === inst.ticker);
            const flashed = flashTickers[inst.ticker] && Date.now() - flashTickers[inst.ticker] < 1000;
            let statusColor = "#484f58"; let statusText = "FLAT";
            if (Math.abs(lots) > RISK_THRESHOLD) { statusColor = "#e3b341"; statusText = "RISK"; }
            else if (lots !== 0) { statusColor = lots > 0 ? "#2ea043" : "#f85149"; statusText = lots > 0 ? "LONG" : "SHORT"; }
            const mid = s?.fairPrice || inst.nominal;
            const bestBid = s?.book?.bids?.[0]?.price;
            const bestAsk = s?.book?.asks?.[0]?.price;
            const unrealized = lots !== 0 && pos?.avgPrice ? (lots > 0 ? (mid - pos.avgPrice) * lots * inst.lotSize : (pos.avgPrice - mid) * Math.abs(lots) * inst.lotSize) : 0;
            return (
              <tr key={inst.ticker} className="row-hover" onClick={() => openPopup(inst.ticker, null, "buy")}
                style={{ borderBottom: "1px solid #161b22", background: flashed ? "rgba(46,160,67,0.12)" : "transparent", transition: "background 0.3s" }}>
                <td style={{ padding: "7px 12px", textAlign: "right", color: "#58a6ff", fontWeight: 700 }}>{inst.ticker}</td>
                <td style={{ padding: "7px 12px", textAlign: "left", color: "#8b949e" }}>{inst.name}</td>
                <td style={{ padding: "7px 12px", textAlign: "right", color: "#8b949e" }}>{inst.lotSize}</td>
                <td style={{ padding: "7px 12px", textAlign: "right", color: "#c9d1d9", fontVariantNumeric: "tabular-nums" }}>{fmt(mid, mid < 10 ? 4 : 2)}</td>
                <td style={{ padding: "7px 12px", textAlign: "right", color: "#2ea043", fontVariantNumeric: "tabular-nums" }}>{bestBid ? fmt(bestBid, bestBid < 10 ? 4 : 2) : "—"}</td>
                <td style={{ padding: "7px 12px", textAlign: "right", color: "#f85149", fontVariantNumeric: "tabular-nums" }}>{bestAsk ? fmt(bestAsk, bestAsk < 10 ? 4 : 2) : "—"}</td>
                <td style={{ padding: "7px 12px", textAlign: "right" }}>
                  <span style={{ background: `${statusColor}22`, color: statusColor, padding: "2px 8px", borderRadius: 3, fontSize: 11, fontWeight: 700, letterSpacing: "0.05em" }}>{statusText}</span>
                  {hasOrder && <span style={{ marginLeft: 4, background: "#1f6feb22", color: "#58a6ff", padding: "2px 5px", borderRadius: 3, fontSize: 10 }}>ORD</span>}
                </td>
                <td style={{ padding: "7px 12px", textAlign: "right", color: lots > 0 ? "#2ea043" : lots < 0 ? "#f85149" : "#586069", fontVariantNumeric: "tabular-nums" }}>
                  {lots !== 0 ? `${lots > 0 ? "+" : ""}${lots}` : "—"}
                </td>
                <td style={{ padding: "7px 12px", textAlign: "right", color: unrealized > 0 ? "#2ea043" : unrealized < 0 ? "#f85149" : "#586069", fontVariantNumeric: "tabular-nums" }}>
                  {unrealized !== 0 ? `${unrealized > 0 ? "+" : ""}${fmt(unrealized)}` : "—"}
                </td>
                <td style={{ padding: "7px 12px", textAlign: "right", color: "#e3b341", fontVariantNumeric: "tabular-nums" }}>{mmFmt(roundTime)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ─── BOOKS TAB ───────────────────────────────────────────────────────────────
function BooksTab({ market, positions, orders, openPopup, fmt }) {
  return (
    <div style={{ height: "calc(100vh - 48px)", overflow: "auto", padding: 12 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 8 }}>
        {INSTRUMENTS_DEF.map((inst) => {
          const s = market[inst.ticker];
          const pos = positions[inst.ticker];
          const lots = pos?.lots || 0;
          const userOrders = orders.filter((o) => o.ticker === inst.ticker);
          return (
            <div key={inst.ticker} style={{ background: "#0d1117", border: "1px solid #21262d", borderRadius: 4, overflow: "hidden" }}>
              <div style={{ padding: "5px 8px", background: "#161b22", display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #21262d" }}>
                <span style={{ color: "#58a6ff", fontWeight: 700, fontSize: 12 }}>{inst.ticker}</span>
                <span style={{ color: "#586069", fontSize: 10 }}>{lots !== 0 ? <span style={{ color: lots > 0 ? "#2ea043" : "#f85149" }}>{lots > 0 ? "+" : ""}{lots}L</span> : ""}</span>
              </div>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
                <thead>
                  <tr>
                    <th style={{ padding: "3px 6px", color: "#2ea043", fontSize: 10, textAlign: "right", borderBottom: "1px solid #161b22" }}>(К)</th>
                    <th style={{ padding: "3px 6px", color: "#8b949e", fontSize: 10, textAlign: "center", borderBottom: "1px solid #161b22" }}>Price</th>
                    <th style={{ padding: "3px 6px", color: "#f85149", fontSize: 10, textAlign: "left", borderBottom: "1px solid #161b22" }}>(П)</th>
                  </tr>
                </thead>
                <tbody>
                  {Array.from({ length: 6 }).map((_, i) => {
                    const bid = s?.book?.bids?.[i];
                    const ask = s?.book?.asks?.[i];
                    const dp = (s?.fairPrice || inst.nominal) < 10 ? 4 : 2;
                    const isBestBid = i === 0 && bid;
                    const isBestAsk = i === 0 && ask;
                    const hasUserBid = bid && userOrders.some((o) => o.side === "buy" && Math.abs(o.price - bid.price) < 0.001);
                    const hasUserAsk = ask && userOrders.some((o) => o.side === "sell" && Math.abs(o.price - ask.price) < 0.001);
                    return (
                      <tr key={i}>
                        <td className={bid ? "bid-row" : ""} onClick={() => bid && openPopup(inst.ticker, bid.price, "buy")}
                          style={{ padding: "2px 6px", textAlign: "right", color: isBestBid ? "#3fb950" : "#2ea04399", fontVariantNumeric: "tabular-nums", cursor: bid ? "pointer" : "default", fontWeight: isBestBid ? 700 : 400 }}>
                          {bid ? <>{hasUserBid && <span style={{ color: "#58a6ff" }}>●</span>} {bid.size}</> : ""}
                        </td>
                        <td style={{ padding: "2px 6px", textAlign: "center", color: "#8b949e", fontVariantNumeric: "tabular-nums", fontSize: 10 }}>
                          {bid ? fmt(bid.price, dp) : ask ? fmt(ask.price, dp) : ""}
                        </td>
                        <td className={ask ? "ask-row" : ""} onClick={() => ask && openPopup(inst.ticker, ask.price, "sell")}
                          style={{ padding: "2px 6px", textAlign: "left", color: isBestAsk ? "#f85149" : "#f8514999", fontVariantNumeric: "tabular-nums", cursor: ask ? "pointer" : "default", fontWeight: isBestAsk ? 700 : 400 }}>
                          {ask ? <>{ask.size} {hasUserAsk && <span style={{ color: "#58a6ff" }}>●</span>}</> : ""}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <div style={{ padding: "4px 8px", borderTop: "1px solid #161b22", display: "flex", gap: 4 }}>
                <button onClick={() => openPopup(inst.ticker, s?.book?.asks?.[0]?.price, "buy")} style={{ flex: 1, background: "#2ea04322", color: "#2ea043", border: "1px solid #2ea04344", borderRadius: 3, fontSize: 10, padding: "3px", cursor: "pointer", fontFamily: "inherit", fontWeight: 700 }}>BUY</button>
                <button onClick={() => openPopup(inst.ticker, s?.book?.bids?.[0]?.price, "sell")} style={{ flex: 1, background: "#f8514922", color: "#f85149", border: "1px solid #f8514944", borderRadius: 3, fontSize: 10, padding: "3px", cursor: "pointer", fontFamily: "inherit", fontWeight: 700 }}>SELL</button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── FILLS TAB ───────────────────────────────────────────────────────────────
function FillsTab({ fills, fmt }) {
  return (
    <div style={{ height: "calc(100vh - 48px)", overflow: "auto" }}>
      {fills.length === 0 ? (
        <div style={{ padding: 40, textAlign: "center", color: "#586069" }}>No fills yet. Start a round and place orders.</div>
      ) : (
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: "#0d1117", position: "sticky", top: 0 }}>
              {["Time", "Ticker", "Side", "Lots", "Fill Price", "Notional"].map((h) => (
                <th key={h} style={{ padding: "8px 16px", textAlign: "right", color: "#586069", fontSize: 11, fontWeight: 600, letterSpacing: "0.08em", borderBottom: "1px solid #21262d" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {fills.map((f) => {
              const t = new Date(f.time);
              return (
                <tr key={f.id} style={{ borderBottom: "1px solid #161b22" }}>
                  <td style={{ padding: "6px 16px", textAlign: "right", color: "#586069", fontVariantNumeric: "tabular-nums" }}>{t.toTimeString().slice(0, 8)}</td>
                  <td style={{ padding: "6px 16px", textAlign: "right", color: "#58a6ff", fontWeight: 700 }}>{f.ticker}</td>
                  <td style={{ padding: "6px 16px", textAlign: "right", color: f.side === "buy" ? "#2ea043" : "#f85149", fontWeight: 700 }}>{f.side === "buy" ? "BUY" : "SELL"}</td>
                  <td style={{ padding: "6px 16px", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{f.lots}</td>
                  <td style={{ padding: "6px 16px", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{fmt(f.fillPrice, 2)}</td>
                  <td style={{ padding: "6px 16px", textAlign: "right", fontVariantNumeric: "tabular-nums", color: "#8b949e" }}>{fmt(f.fillPrice * f.lots * f.lotSize)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}

// ─── ORDER POPUP ─────────────────────────────────────────────────────────────
function OrderPopup({ popup, setPopup, market, lastOrder, submitOrder, fmt }) {
  const [side, setSide] = useState(popup.side || "buy");
  const [ticker, setTicker] = useState(popup.ticker || INSTRUMENTS_DEF[0].ticker);
  const [price, setPrice] = useState(popup.price ? String(popup.price) : "");
  const [lots, setLots] = useState("1");
  const priceRef = useRef(null);

  const inst = INSTRUMENTS_DEF.find((i) => i.ticker === ticker);
  const dp = (inst?.nominal || 100) < 10 ? 4 : (inst?.nominal || 100) < 100 ? 2 : 2;
  const tickSize = (inst?.nominal || 100) < 10 ? 0.001 : (inst?.nominal || 100) < 100 ? 0.01 : (inst?.nominal || 100) < 1000 ? 0.1 : 0.5;
  const notional = price && lots && inst ? (parseFloat(price) * parseInt(lots) * inst.lotSize) : 0;

  useEffect(() => { priceRef.current?.focus(); }, []);

  useEffect(() => {
    if (!price && ticker && market[ticker]) {
      const book = market[ticker]?.book;
      const p = side === "buy" ? book?.asks?.[0]?.price : book?.bids?.[0]?.price;
      if (p) setPrice(p.toFixed(dp));
    }
  }, [ticker, side]);

  const handleKey = (e) => {
    if (e.key === "Enter" || e.code === "NumpadEnter") { e.preventDefault(); handleSubmit(); return; }
    if (e.key === "Escape") { setPopup(null); return; }
    if (e.key === "ArrowUp") { e.preventDefault(); setPrice((p) => (parseFloat(p || 0) + tickSize).toFixed(dp)); return; }
    if (e.key === "ArrowDown") { e.preventDefault(); setPrice((p) => Math.max(0, parseFloat(p || 0) - tickSize).toFixed(dp)); return; }
    // Numpad digits → append to price field
    if (e.code?.startsWith("Numpad") && document.activeElement !== priceRef.current) {
      const numpadMap = { Numpad0:"0",Numpad1:"1",Numpad2:"2",Numpad3:"3",Numpad4:"4",Numpad5:"5",Numpad6:"6",Numpad7:"7",Numpad8:"8",Numpad9:"9",NumpadDecimal:"." };
      if (numpadMap[e.code]) { e.preventDefault(); priceRef.current?.focus(); setPrice((p) => p + numpadMap[e.code]); }
    }
  };

  const handleSubmit = () => { submitOrder(ticker, side, price, lots); };

  const handleRepeat = () => {
    if (!lastOrder) return;
    setTicker(lastOrder.ticker);
    setSide(lastOrder.side);
    setPrice(String(lastOrder.price));
    setLots(String(lastOrder.lots));
  };

  const bgColor = side === "buy" ? "rgba(46,160,67,0.08)" : "rgba(248,81,73,0.08)";
  const accentColor = side === "buy" ? "#2ea043" : "#f85149";

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100 }} onClick={(e) => { if (e.target === e.currentTarget) setPopup(null); }}>
      <div style={{ background: "#0d1117", border: `1px solid ${accentColor}44`, borderRadius: 6, width: 380, boxShadow: `0 0 40px ${accentColor}22` }} onKeyDown={handleKey}>
        {/* Header */}
        <div style={{ padding: "12px 16px", borderBottom: "1px solid #21262d", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontWeight: 700, fontSize: 13, letterSpacing: "0.08em", color: "#c9d1d9" }}>ВВОД ЗАЯВКИ</span>
          <button onClick={() => setPopup(null)} style={{ background: "none", border: "none", color: "#586069", cursor: "pointer", fontSize: 16 }}>×</button>
        </div>

        {/* Side toggle */}
        <div style={{ display: "flex", padding: "12px 16px 0", gap: 0 }}>
          {["buy", "sell"].map((s) => (
            <button key={s} onClick={() => setSide(s)}
              style={{ flex: 1, padding: "8px", border: `1px solid ${s === "buy" ? "#2ea043" : "#f85149"}`, background: side === s ? (s === "buy" ? "#2ea04322" : "#f8514922") : "#161b22", color: side === s ? (s === "buy" ? "#2ea043" : "#f85149") : "#586069", cursor: "pointer", fontFamily: "inherit", fontSize: 12, fontWeight: 700, letterSpacing: "0.1em", borderRadius: s === "buy" ? "4px 0 0 4px" : "0 4px 4px 0", transition: "all 0.15s" }}>
              {s === "buy" ? "КУПИТЬ" : "ПРОДАТЬ"}
            </button>
          ))}
        </div>

        {/* Form */}
        <div style={{ padding: 16, background: bgColor, margin: "12px 16px", borderRadius: 4, display: "flex", flexDirection: "column", gap: 12 }}>
          {/* Instrument */}
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <label style={{ width: 90, color: "#8b949e", fontSize: 11 }}>Инструмент</label>
            <select value={ticker} onChange={(e) => setTicker(e.target.value)}
              style={{ flex: 1, background: "#0d1117", border: "1px solid #30363d", color: "#c9d1d9", padding: "5px 8px", borderRadius: 4, fontFamily: "inherit", fontSize: 12 }}>
              {INSTRUMENTS_DEF.map((i) => <option key={i.ticker} value={i.ticker}>{i.ticker} — {i.name}</option>)}
            </select>
          </div>

          {/* Price */}
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <label style={{ width: 90, color: "#8b949e", fontSize: 11 }}>По цене</label>
            <div style={{ flex: 1, display: "flex", gap: 4 }}>
              <button className="spinner-btn" onClick={() => setPrice((p) => Math.max(0, parseFloat(p || 0) - tickSize).toFixed(dp))}>−</button>
              <input ref={priceRef} type="number" value={price} onChange={(e) => setPrice(e.target.value)}
                style={{ flex: 1, background: "#0d1117", border: `1px solid ${accentColor}55`, color: "#c9d1d9", padding: "5px 8px", borderRadius: 4, fontFamily: "inherit", fontSize: 12, textAlign: "right", outline: "none", fontVariantNumeric: "tabular-nums" }} />
              <button className="spinner-btn" onClick={() => setPrice((p) => (parseFloat(p || 0) + tickSize).toFixed(dp))}>+</button>
            </div>
          </div>

          {/* Quick prices */}
          {ticker && market[ticker]?.book && (
            <div style={{ display: "flex", gap: 4, paddingLeft: 98 }}>
              {[market[ticker]?.book?.bids?.[0]?.price, market[ticker]?.fairPrice, market[ticker]?.book?.asks?.[0]?.price].map((p, i) => p && (
                <button key={i} onClick={() => setPrice(p.toFixed(dp))}
                  style={{ fontSize: 10, padding: "2px 6px", background: "#161b22", border: `1px solid ${i === 0 ? "#2ea04333" : i === 2 ? "#f8514933" : "#30363d"}`, color: i === 0 ? "#2ea043" : i === 2 ? "#f85149" : "#8b949e", borderRadius: 3, cursor: "pointer", fontFamily: "inherit", fontVariantNumeric: "tabular-nums" }}>
                  {i === 0 ? "BID" : i === 2 ? "ASK" : "MID"} {p.toFixed(dp)}
                </button>
              ))}
            </div>
          )}

          {/* Lots */}
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <label style={{ width: 90, color: "#8b949e", fontSize: 11 }}>Лотов</label>
            <div style={{ flex: 1, display: "flex", gap: 4 }}>
              <button className="spinner-btn" onClick={() => setLots((l) => String(Math.max(1, parseInt(l || 1) - 1)))}>−</button>
              <input type="number" value={lots} onChange={(e) => setLots(e.target.value)} min={1} step={1}
                style={{ flex: 1, background: "#0d1117", border: `1px solid ${accentColor}55`, color: "#c9d1d9", padding: "5px 8px", borderRadius: 4, fontFamily: "inherit", fontSize: 12, textAlign: "right", outline: "none" }} />
              <button className="spinner-btn" onClick={() => setLots((l) => String(parseInt(l || 1) + 1))}>+</button>
            </div>
          </div>
          <div style={{ display: "flex", gap: 4, paddingLeft: 98 }}>
            {[1, 5, 10, 50].map((n) => (
              <button key={n} onClick={() => setLots(String(n))}
                style={{ fontSize: 10, padding: "2px 8px", background: lots === String(n) ? `${accentColor}22` : "#161b22", border: `1px solid ${lots === String(n) ? accentColor : "#30363d"}`, color: lots === String(n) ? accentColor : "#8b949e", borderRadius: 3, cursor: "pointer", fontFamily: "inherit" }}>
                {n}
              </button>
            ))}
          </div>

          {/* Summary */}
          <div style={{ display: "flex", justifyContent: "space-between", borderTop: "1px solid #21262d", paddingTop: 10, marginTop: 2 }}>
            <span style={{ color: "#586069", fontSize: 11 }}>Размер лота: {inst?.lotSize} · Бумаг: {inst ? (parseInt(lots || 0) * inst.lotSize) : 0}</span>
            <span style={{ color: "#c9d1d9", fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>Σ {notional ? fmt(notional) : "—"}</span>
          </div>
        </div>

        {/* Buttons */}
        <div style={{ padding: "0 16px 16px", display: "flex", gap: 8 }}>
          <button onClick={handleSubmit}
            style={{ flex: 2, padding: "10px", background: accentColor, color: "#fff", border: "none", borderRadius: 4, cursor: "pointer", fontFamily: "inherit", fontSize: 12, fontWeight: 700, letterSpacing: "0.08em", transition: "opacity 0.15s" }}>
            ВВЕСТИ ЗАЯВКУ
          </button>
          <button className="btn-secondary" onClick={() => setPopup(null)} style={{ flex: 1 }}>ЗАКРЫТЬ</button>
          <button className="btn-secondary" onClick={handleRepeat} disabled={!lastOrder} style={{ flex: 1, opacity: lastOrder ? 1 : 0.4 }}>ПОВТОРИТЬ</button>
        </div>
        <div style={{ padding: "0 16px 10px", color: "#484f58", fontSize: 10, textAlign: "center" }}>
          Enter — submit · Esc — close · ↑↓ — price tick
        </div>
      </div>
    </div>
  );
}
