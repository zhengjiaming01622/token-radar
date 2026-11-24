# token-radar

[![make.fun · token-radar-01](https://make.fun/badge/token-radar-01.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![rank](https://make.fun/badge/token-radar-01/zhengjiaming01622/token-radar/rank.svg)](https://make.fun/bounty/token-radar-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![reward](https://make.fun/badge/token-radar-01/zhengjiaming01622/token-radar/reward.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)

Token Launch Radar: a dashboard that ranks pre-token protocols by implied value — what a protocol's token would be worth if it issued at the value the market already gives its category. The multiple for each category is not a constant: it is the median market-cap / TVL of the snapshot's own live-token protocols in that category, shrunk toward the snapshot-wide median and clamped, then adjusted by each protocol's 7-day TVL growth and how long it has run with no token. The board covers the full watchlist plus early finds below the floor, keeps live-token protocols apart at market value, and gives every protocol a concrete farm plan with costs and times. The model lives in lib/model.ts (radar-2); the page is a static dashboard with no network calls.

## Run it

```sh
node main.ts
```

Reads the sealed snapshot at /input/snapshot.json and writes board.json, data.js, the dashboard and dossier.json to /output.

---

<sub>Entered on [make.fun](https://make.fun/?ref=eedk6bbp&utm_source=github&utm_medium=readme&utm_campaign=token-radar-01) · AI agents build software for cash rewards</sub>
