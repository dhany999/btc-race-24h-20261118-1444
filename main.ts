// CBBTC momentum-continuation bot for make.fun's agent-fun/bars-replay/v1.
//
// A slow trend filter (fast SMA over slow SMA) with an intraday profit target:
// the bot goes long only while the fast simple moving average of closes sits a
// set margin above the slow one, takes the gain once the trade is up a fixed
// number of basis points, and otherwise leaves on a hard stop or when the trend
// filter rolls over.
//
// All state is built from the bars the harness has already sent: no clock, no
// network, no randomness, no files, so the same input gives byte-identical
// output on every run.

import { runBars, type BarsState, type Batch, type OrderInput } from './vendor/makefun-bars.ts';

const SYMBOL = 'CBBTC';
const BPS = 10_000;

// --- parameters (chosen on the published dev window only) -------------------
const FAST = 60;              // fast SMA, bars
const SLOW = 150;             // slow SMA, bars
const ENTRY_BPS = 10;         // fast must sit this far above slow, as bps of price
const EXIT_BPS = -5;          // ... and this far below it to leave on a roll-over
const TAKE_BPS = 60;          // take profit once the trade is up this much
const STOP_BPS = 0;           // 0: no hard stop
const TRAIL_BPS = 0;          // 0: no trailing stop
const MIN_HOLD = 2;           // bars to hold before any exit rule may fire
const SIZE_BPS = 8000;        // share of cash spent on an entry
const COOLDOWN = 0;           // bars to wait after an exit before re-entering
const MIN_ORDER = 1_000_000n; // the protocol's minimum buy: 1 USDC in quote units
const MAX_SLIP_BPS = 400;     // tolerance between the deciding close and the next open

/** Rolling sums for the two averages plus the trade the bot is holding. */
class Strategy {
  closes: number[] = [];
  fastSum = 0;
  slowSum = 0;
  entryIndex = -1;
  entryPrice = 0;
  peak = 0;
  cooldownUntil = -1;

  /** Append a close, keep both rolling sums in step, return the bar index. */
  push(close: number): number {
    this.closes.push(close);
    const n = this.closes.length;
    this.fastSum += close;
    this.slowSum += close;
    if (n > FAST) this.fastSum -= this.closes[n - 1 - FAST]!;
    if (n > SLOW) this.slowSum -= this.closes[n - 1 - SLOW]!;
    return n - 1;
  }

  /** The fast average over the slow one in bps of price, or null before both exist. */
  spreadBps(price: number): number | null {
    if (this.closes.length < SLOW || price <= 0) return null;
    const fast = this.fastSum / FAST;
    const slow = this.slowSum / SLOW;
    return ((fast - slow) * BPS) / price;
  }
}

let strat = new Strategy();

/** Answer one batch: at most one order, decided on the bar that just closed. */
function decide(state: BarsState, batch: Batch): OrderInput[] {
  const raw = state.close(SYMBOL);
  if (raw === null) return [];
  // Warm-up batches build no history: the strategy only starts on the scored window.
  if (state.warmingUp) return [];

  const close = Number(raw);
  const index = strat.push(close);
  const spread = strat.spreadBps(close);
  if (spread === null) return [];

  const held = state.positions.get(SYMBOL);
  if (held === undefined || held.qty <= 0n) {
    if (index < strat.cooldownUntil) return [];
    if (spread < ENTRY_BPS) return [];
    const notional = (state.cash * BigInt(SIZE_BPS)) / BigInt(BPS);
    if (notional < MIN_ORDER) return [];
    strat.entryIndex = index;
    strat.entryPrice = close;
    strat.peak = close;
    return [{
      side: 'buy',
      symbol: SYMBOL,
      notional_quote_units: notional,
      max_slippage_bps: MAX_SLIP_BPS,
    }];
  }

  if (close > strat.peak) strat.peak = close;
  if (index - strat.entryIndex < MIN_HOLD) return [];

  const changeBps = ((close - strat.entryPrice) * BPS) / strat.entryPrice;
  let exitNow = false;
  if (TAKE_BPS !== 0 && changeBps >= TAKE_BPS) {
    exitNow = true;
  } else if (STOP_BPS !== 0 && changeBps <= -STOP_BPS) {
    exitNow = true;
  } else if (TRAIL_BPS !== 0 && strat.peak > 0 && ((strat.peak - close) * BPS) / strat.peak >= TRAIL_BPS) {
    exitNow = true;
  }
  if (!exitNow && spread <= EXIT_BPS) exitNow = true;
  if (!exitNow) return [];

  strat.cooldownUntil = index + 1 + COOLDOWN;
  return [{
    side: 'sell',
    symbol: SYMBOL,
    qty: held.qty,
    max_slippage_bps: MAX_SLIP_BPS,
  }];
}

async function main(): Promise<void> {
  await runBars({
    onHello() {
      strat = new Strategy();
    },
    onBatch(state, batch) {
      return decide(state, batch);
    },
  });
}

await main();
