# shikamaru

[![CI](https://github.com/JayOfemi/shikamaru/actions/workflows/ci.yml/badge.svg)](https://github.com/JayOfemi/shikamaru/actions/workflows/ci.yml)

Provably correct day-count and accrued-interest calculations. A small, dependency-light TypeScript library and an MCP server, so an AI agent can get the exact number instead of guessing.

## Why

LLMs are unreliable at date and money math: they pick the wrong day-count convention and miscompute accrued interest. shikamaru does it deterministically and proves it against published reference values. Do not let a model guess your interest accrual.

## What it does (v1)

- Day-count fraction between two dates under six market conventions: 30/360, 30E/360, 30E/360 ISDA, ACT/360, ACT/365F, ACT/ACT ISDA.
- Simple accrued interest: notional x rate x day-count fraction.
- Exposed both as a library and as an MCP server (tools: `day_count_fraction`, `accrued_interest`, `list_conventions`).

Holiday calendars, business-day adjustment, schedules, and ACT/ACT ICMA arrive in v2.

## Install

```
npm install @jayofemi/shikamaru
```

## Library usage

```ts
import { dayCountFraction, accruedInterest } from "@jayofemi/shikamaru";

dayCountFraction("2003-11-01", "2004-05-01", "ACT/ACT ISDA"); // 0.4977...
accruedInterest({
	notional: 1_000_000,
	rate: 0.05,
	start: "2024-01-01",
	end: "2024-04-01",
	convention: "ACT/365F",
});
```

Dates are strict ISO `YYYY-MM-DD`. Rate is an annual decimal (`0.05` = 5%).

## MCP server

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

Conventions follow the ISDA 2006 definitions. The test suite checks published reference vectors (ISDA worked examples, the OpenGamma conventions guide), property checks, and a differential battery against QuantLib, the de-facto reference.

To (re)generate the QuantLib battery (needs Python + pip):

```
pip install QuantLib
npm run vectors
```

This writes `test/vectors/quantlib.json` (commit it). `npm test` then checks shikamaru against every QuantLib value. CI regenerates the battery from QuantLib (setup-python + pip) and runs it on every push, so drift is caught. The proof is the product.

## Develop

```
npm install
npm run build
npm test
```

## License

MIT. Copyright (c) 2026 Jay Ofemi.
