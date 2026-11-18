# Test results — btc-race-24h-20261118-1444

All grades run locally with the kit's own harness on the dev window
(1 symbol, 1,440 one-minute bars):

```
node cli/makefun.mjs grade-local \
  --kit /home/hatch/workspace/makefun/btc-race-24h-20261118-1444-kit/btc-race-24h-20261118-1444-kit \
  --bot /home/hatch/workspace/makefun/btc-race-24h-20261118-1444-repo \
  --driver process --worktree
```

Driver `process`, Node v24.22.1 (the server runs v26.13.1, so `result_sha256`
differs from the server's by construction).

## Grade 1 — faithful port of the Python bot

Parameters FAST 40 / SLOW 75 / ENTRY 5 bps / EXIT −15 bps / TAKE 60 bps,
identical to the original Python strategy.

| metric | value |
| --- | --- |
| status | finished |
| net PnL | **−2.410410 USDC** |
| trades | 10 (5 round trips), 0 rejected |
| win rate | 0.800 |
| max drawdown | 1.91% |
| fees | 3.208904 USDC |
| determinism | `L1 regrade reproduced byte for byte` |
| errors | none |

This negative result was **not** a port defect. A Python re-implementation of the
same rules under the scratch simulator reproduced it exactly: net −2.410410,
10 fills, drawdown 0.019071508. The port was correct; the old parameters were
wrong for the window.

## Grade 2 — retuned parameters (final)

Parameters FAST 60 / SLOW 150 / ENTRY 10 bps / EXIT −5 bps / TAKE 60 bps,
MIN_HOLD 2, SIZE_BPS 8000, MAX_SLIP 400. Same code, same logic, only the four
constants changed.

| metric | value |
| --- | --- |
| status | finished |
| net PnL | **+4.525987 USDC** |
| trades | 10 (5 round trips), 0 rejected |
| win rate | 0.800 |
| max drawdown | 1.09% |
| exposure | 24.8% |
| fees | 3.213058 USDC |
| stress (2x fees) | +1.314840 USDC |
| determinism | `L1 regrade reproduced byte for byte` |
| errors | none |

Dev gate (net PnL above 0 USDC): **passed**.

### Why these parameters

The dev window is a downtrend — buy-and-hold loses 29.976 USDC over it — so the
first task was to stop the filter from buying weak rallies. A sweep over the
SMA lengths, entry/exit margins, take-profit levels and minimum hold (with the
scratch simulator that reproduces the grader to the cent) put 60/150 at 10 bps
in a positive cluster: its immediate neighbours (60/150 at 5 and 15 bps entry,
−10 bps exit, 40–90 bps take profit) are all positive too, so the choice is not
a single lucky point. The grid as a whole was 30 positive out of 271 — this
window is hard — and the neighbouring SMA lengths (50/150, 75/150) also tested
positive, which is why 60/150 was kept over the sparser high-score outliers.

A wider sweep run afterwards found a higher point on the dev window, 60/90 with
a 5 bps entry and a −5 bps exit, at +6.271 USDC. It was **not** adopted: around
that point only 14 of 60 nearby parameter sets stay positive (mean −4.10, worst
−14.10), against 15 of 60 for 60/150 (mean −2.86). The higher dev-window score
is a narrower ridge, and the live race runs on data this window has not seen,
so the flatter neighbourhood was preferred over the extra 1.7 USDC.

## Reproducibility notes

- No wall clock, network, randomness or filesystem access: state comes only from
  the bars in each batch.
- Warm-up batches (`state.warmingUp`) are answered with no orders and do not feed
  the rolling sums, matching the Python original.
- `vendor/makefun-bars.ts` is the kit shim copied unchanged
  (sha256 `9677370b0ab7e759c486a929afc95a11fb0fb32c7ec37053d3ebabd426aec5c8`).
