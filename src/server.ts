#!/usr/bin/env node
// MCP server: exposes shikamaru's deterministic calcs as tools an AI can call.
// Note: confirm the SDK call signatures against the installed @modelcontextprotocol/sdk version.

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { accruedInterest } from "./accrued.js";
import { SERVER_NAME, SERVER_VERSION } from "./constants.js";
import { dayCountFraction } from "./dayCount.js";
import { DAY_COUNT_CONVENTIONS } from "./types.js";

const conventionSchema = z
	.enum(DAY_COUNT_CONVENTIONS)
	.describe("Day-count convention, e.g. ACT/ACT ISDA or 30/360.");
const dateSchema = z
	.string()
	.regex(/^\d{4}-\d{2}-\d{2}$/, "Use ISO format YYYY-MM-DD.")
	.describe("ISO calendar date, YYYY-MM-DD (e.g. 2024-03-15). Zero-padded, no time or timezone.");
const terminationSchema = z
	.boolean()
	.optional()
	.describe("30E/360 ISDA only: true if the end date is the instrument's maturity date.");

const server = new McpServer({ name: SERVER_NAME, version: SERVER_VERSION });

server.registerTool(
	"day_count_fraction",
	{
		title: "Day-count fraction",
		description:
			"Exact day-count fraction between two dates under a market convention. Dates are ISO YYYY-MM-DD. Deterministic; do not estimate this with a model.",
		inputSchema: {
			start: dateSchema,
			end: dateSchema,
			convention: conventionSchema,
			endIsTermination: terminationSchema,
		},
	},
	async ({ start, end, convention, endIsTermination }) => {
		const fraction = dayCountFraction(start, end, convention, { endIsTermination });
		return { content: [{ type: "text", text: JSON.stringify({ fraction }) }] };
	},
);

server.registerTool(
	"accrued_interest",
	{
		title: "Accrued interest",
		description:
			"Exact simple accrued interest (notional * rate * day-count fraction) between two dates. Dates are ISO YYYY-MM-DD; rate is the annual rate as a decimal (0.05 = 5%). Deterministic.",
		inputSchema: {
			notional: z.number().describe("Face / principal amount."),
			rate: z.number().describe("Annual rate as a decimal, e.g. 0.05 for 5%."),
			start: dateSchema,
			end: dateSchema,
			convention: conventionSchema,
			endIsTermination: terminationSchema,
		},
	},
	async ({ notional, rate, start, end, convention, endIsTermination }) => {
		const value = accruedInterest({ notional, rate, start, end, convention, options: { endIsTermination } });
		return { content: [{ type: "text", text: JSON.stringify({ accruedInterest: value }) }] };
	},
);

server.registerTool(
	"list_conventions",
	{
		title: "List conventions",
		description: "List the supported day-count conventions.",
		inputSchema: {},
	},
	async () => {
		return { content: [{ type: "text", text: JSON.stringify({ conventions: DAY_COUNT_CONVENTIONS }) }] };
	},
);

const transport = new StdioServerTransport();
await server.connect(transport);
