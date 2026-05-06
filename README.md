# MM·SIM — Market Making Simulator

The market making simulator built with React. Practice placing limit orders, managing positions, and tracking P&L across 28 real-world instruments in a simulated live market environment.

---

## What It Does

- Simulates a live order book for 28 fin instruments (AAPL, TSLA, NVDA, JPM, etc.)
- Generates realistic price movements with momentum, noise, and random jumps
- Lets you place limit buy/sell orders that fill against the simulated book
- Tracks your position, unrealized P&L, and realized P&L in real time
- Runs in timed 5-minute rounds

---

## Functionality

### Instruments Tab
Overview of all 28 instruments with live fair price, best bid/ask, position status (FLAT / LONG / SHORT / RISK), and unrealized P&L per instrument. Click any row to open the order entry popup.

<img width="1887" height="827" alt="Снимок экрана 2026-05-06 170100" src="https://github.com/user-attachments/assets/a17cb960-e44b-479c-b859-9ff913eacd7d" />

### Order Books Tab
Live 6-level order book for every instrument. Click any bid/ask level to pre-fill the order form at that price. BUY / SELL buttons at the bottom of each card.

<img width="1879" height="812" alt="Снимок экрана 2026-05-06 170138" src="https://github.com/user-attachments/assets/46dd8b2a-c9c7-4ce9-a9f2-dc3bfe71ac01" />


### Fills Tab
History of your last 50 filled orders with timestamp, ticker, side, lots, fill price, and notional value.

<img width="1885" height="751" alt="Снимок экрана 2026-05-06 170153" src="https://github.com/user-attachments/assets/7f4e18f6-36ed-463b-b85f-c75371e3f42a" />


### Order Entry Popup
- Select instrument, side (buy/sell), price, and lot quantity
- Quick-fill buttons for BID / MID / ASK prices
- Lot presets: 1, 5, 10, 50
- Keyboard shortcuts: `Enter` to submit, `Esc` to close, `↑ ↓` to step price by tick size
- Repeat last order with one click

### P&L & Risk
- Live total P&L (realized + unrealized) shown in the header
- Positions exceeding 5 lots are flagged as **RISK** in yellow
---

## Getting Started

### 1. Create the app

```bash
npx create-react-app mm-simulator
cd mm-simulator
```

### 2. Replace the source

Copy `App.jsx` (and any other project files) into the `src/` folder, replacing the default files.

### 3. Run

```bash
npm start
```

Opens at [http://localhost:3000](http://localhost:3000).

---

## How to Use

1. Click **▶ START** to begin a 5-minute round — this resets positions, orders, and fills.
2. Browse instruments in the **Instruments** tab or view live books in **Order Books**.
3. Click any row or BUY/SELL button to open the order form.
4. Set your price and lot size, then press **Enter** to submit.
5. Orders fill automatically when the market price crosses your limit.
6. Monitor your P&L in the header and position status per instrument.
7. Click **⏸ PAUSE** to pause the market at any time.
