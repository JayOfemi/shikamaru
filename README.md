# shikamaru

[![CI](https://github.com/JayOfemi/shikamaru/actions/workflows/ci.yml/badge.svg)](https://github.com/JayOfemi/shikamaru/actions/workflows/ci.yml)

Provably correct day-count, holiday-calendar, business-day, and payment-schedule calculations. A small, dependency-light TypeScript library and an MCP server, so an AI agent can get the exact date or number instead of guessing.

## Why

LLMs are unreliable at date and money math: they pick the wrong day-count convention, forget market holidays, and miscompute accrued interest. shikamaru does it deterministically and proves it against published reference values. Do not let a model guess your interest accrual or your settlement date.

## What it does

- Day-count fraction between two dates under seven market conventions: 30/360, 30E/360, 30E/360 ISDA, ACT/360, ACT/365F, ACT/ACT ISDA, ACT/ACT ICMA (with reference periods and stub decomposition).
- Simple accrued interest: notional x rate x day-count fraction.
- Holiday calendars as rules in code, no data feed: `us-federal`, `nyse`, `sifma-us`, `target`, `uk`.
- Business-day math: is-business-day, next/previous, ISDA adjustment conventions (following, modified-following, preceding, modified-preceding), T+N settlement.
- Payment schedules: monthly to annual, backward or forward roll, short or long stubs, end-of-month rule, per-period unadjusted and adjusted dates.
- All of it exposed as a library and as an MCP server.

### Calendar maintenance contract

Calendars are published rules plus a short pinned table of historical one-off closures, current as of this version. Rules generate correct dates arbitrarily far forward; one-off closures (a mourning day, a proclaimed extra holiday) are added when announced and ship in a patch release. A scheduled CI run re-checks every calendar against the latest QuantLib weekly, so drift is detected, not discovered.

## Install

```
npm install @jayofemi/shikamaru
```

## Library usage

```ts
import {
	accruedInterest, addBusinessDays, adjustDate, dayCountFraction,
	generateSchedule, isBusinessDay,
} from "@jayofemi/shikamaru";

dayCountFraction("2003-11-01", "2004-05-01", "ACT/ACT ISDA"); // 0.4977...
accruedInterest({
	notional: 1_000_000,
	rate: 0.05,
	start: "2024-01-01",
	end: "2024-04-01",
	convention: "ACT/365F",
});

isBusinessDay("2024-06-19", "nyse"); // false (Juneteenth)
adjustDate("2024-03-29", "modified-following", "target"); // "2024-03-28" (Good Friday, stays in March)
addBusinessDays("2024-07-02", 2, "us-federal"); // "2024-07-05" (T+2 over July 4th)

generateSchedule({
	effective: "2024-01-15",
	termination: "2026-01-15",
	frequency: "semiannual",
	calendar: "target",
}); // four periods with unadjusted and adjusted dates
```

Dates are strict ISO `YYYY-MM-DD`. Rate is an annual decimal (`0.05` = 5%).

## MCP server [![shikamaru MCP server](https://glama.ai/mcp/servers/JayOfemi/shikamaru/badges/score.svg)](https://glama.ai/mcp/servers/JayOfemi/shikamaru)

[![shikamaru MCP server](https://glama.ai/mcp/servers/JayOfemi/shikamaru/badges/card.svg)](https://glama.ai/mcp/servers/JayOfemi/shikamaru)

From source (local dev):

```
npm install
npm run build
node dist/server.js
```

Once published, an MCP client can launch it directly:

```
npx @jayofemi/shikamaru
```

Point any MCP client (Claude Desktop, an IDE, etc.) at that command over stdio.

## Verify the MCP server

The standard way to test shikamaru's server is the official MCP Inspector. The unit tests cover the library; the Inspector covers the server layer they do not touch.

```
npm run build
npx @modelcontextprotocol/inspector node dist/server.js
```

It opens a local UI, connects over stdio, lists the tools, and lets you call them. Sanity check: `day_count_fraction` with start `2003-11-01`, end `2004-05-01`, convention `ACT/ACT ISDA` returns about 0.4977.

## Correctness

Conventions follow the ISDA 2006 definitions; calendars follow their published sources (OPM, NYSE rules, SIFMA recommendations, ECB TARGET rules, gov.uk proclamations). The test suite checks published reference vectors (ISDA worked examples, official holiday lists, the OpenGamma conventions guide), property checks, and differential batteries against QuantLib, the de-facto reference: day-count fractions, full per-calendar holiday lists across decades, business-day adjustment and advancing, schedules compared date by date, and ACT/ACT ICMA fractions including stubs.

To (re)generate the QuantLib batteries (needs Python + pip):

```
pip install QuantLib
npm run vectors
```

This writes `test/vectors/quantlib.json` and `test/vectors/quantlib-calendar.json` (commit both). `npm test` then checks shikamaru against every QuantLib value. CI regenerates the batteries from the latest QuantLib on every push AND on a weekly schedule (the drift watchdog), so a real-world calendar change surfaces as a red run even when the repo is quiet. The proof is the product.

## Develop

```
npm install
npm run build
npm test
```

## License

MIT. Copyright (c) 2026 Jay Ofemi.
