# btc-race-24h-20261118-1444

[![make.fun btc-race-24h-20261118-1444](https://make.fun/badge/btc-race-24h-20261118-1444.svg)](https://make.fun/bounty/btc-race-24h-20261118-1444)
[![rank](https://make.fun/badge/btc-race-24h-20261118-1444/dhany999/btc-race-24h-20261118-1444/rank.svg)](https://make.fun/bounty/btc-race-24h-20261118-1444)
[![reward](https://make.fun/badge/btc-race-24h-20261118-1444/dhany999/btc-race-24h-20261118-1444/reward.svg)](https://make.fun/bounty/btc-race-24h-20261118-1444)

A long-only CBBTC trading bot for make.fun's *Race a BTC trading bot live for 24
hours* bounty: it follows a slow dual-SMA trend filter, takes profit at a fixed
basis-point target and leaves when the trend rolls over, holding one position at
a time. It speaks `agent-fun/bars-replay/v1` in TypeScript on Node's type
stripping, so one file runs it with no install step and no dependency beyond the
Node standard library.

## Run it locally

```
node main.ts
```

The bot reads `hello` / `batch` / `done` lines on stdin and writes one reply per
batch on stdout. To score it on the dev window, run the kit's harness with this
repository as `--bot`:

```
node cli/makefun.mjs grade-local \
  --kit /path/to/btc-race-24h-20261118-1444-kit \
  --bot /path/to/this/repo \
  --driver process --worktree
```

## Strategy

Long only, one position at a time, decided on each batch's CBBTC close.

- **Trend filter.** A fast SMA (60 bars) and a slow SMA (150 bars) of closes,
  kept as rolling sums. The bot goes long when
  `(fast - slow) / close * 10000 >= 10` bps and leaves when the same spread
  falls to `<= -5` bps.
- **Exits.** Take profit at `+60` bps of the entry close, or the filter rolling
  over, whichever fires first; no hard stop, no trailing stop. Two bars must
  pass before any exit rule may fire.
- **Sizing.** 80% of cash per entry (`SIZE_BPS = 8000`), orders carry
  `max_slippage_bps = 400` to survive the next open moving against the deciding
  close.

Parameters were chosen on the published dev window only. All state is built
from bars the harness already sent, so there is no clock, no network, no
randomness and no filesystem access: two executions produce identical action
logs.

## Local grade

Driver `process`, on the kit's 1,440-bar dev window:

| metric | value |
| --- | --- |
| net PnL | **+4.525987 USDC** (return +0.45%) |
| trades | 10 (5 round trips), 0 rejected |
| win rate | 0.800 |
| max drawdown | 1.09% |
| fees | 3.213058 USDC |
| determinism | two executions matched byte for byte |

## Files

- `main.ts` — the entry point (`node main.ts`).
- `vendor/makefun-bars.ts` — the kit's TypeScript SDK shim, copied byte for byte
  (sha256 `9677370b0ab7e759c486a929afc95a11fb0fb32c7ec37053d3ebabd426aec5c8`).
- `TEST-RESULTS.md` — the full local grade records, including the retuning sweep.
- `README.md` — this file.
- `LICENSE` — MIT.
- `.makefun/owner.json` — entrant binding.

---

Optional: earn referral rewards, a second way to make money — https://make.fun/r/dhpnw6yp
