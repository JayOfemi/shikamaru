import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { CALENDARS, DAY_COUNT_CONVENTIONS, accruedInterest, dayCountFraction, generateSchedule } from "../src/index.js";
import { createServer } from "../src/server.js";

const TOOL_NAMES = [
	"accrued_interest",
	"add_business_days",
	"adjust_date",
	"day_count_fraction",
	"generate_schedule",
	"is_business_day",
	"list_calendars",
	"list_conventions",
];

interface ToolResult {
	content: { type: string; text: string }[];
	structuredContent?: Record<string, unknown>;
	isError?: boolean;
}

describe("MCP server", () => {
	const client = new Client({ name: "shikamaru-test-client", version: "0.0.0" });

	beforeAll(async () => {
		const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
		await createServer().connect(serverTransport);
		await client.connect(clientTransport);
	});

	afterAll(async () => {
		await client.close();
	});

	// Every success result must carry structuredContent that matches its text block exactly.
	async function call(name: string, args: Record<string, unknown>): Promise<Record<string, unknown>> {
		const result = (await client.callTool({ name, arguments: args })) as ToolResult;
		expect(result.isError).toBeFalsy();
		const fromText = JSON.parse(result.content[0]!.text) as Record<string, unknown>;
		expect(result.structuredContent).toEqual(fromText);
		return fromText;
	}

	it("lists exactly the eight calculation tools", async () => {
		const tools = await client.listTools();
		expect(tools.tools.map((tool) => tool.name).sort()).toEqual(TOOL_NAMES);
	});

	it("declares every tool read-only, closed-world, with a structured output schema", async () => {
		const tools = await client.listTools();
		for (const tool of tools.tools) {
			expect(tool.annotations?.readOnlyHint, `${tool.name} readOnlyHint`).toBe(true);
			expect(tool.annotations?.openWorldHint, `${tool.name} openWorldHint`).toBe(false);
			expect(tool.outputSchema, `${tool.name} outputSchema`).toBeDefined();
		}
	});

	it("returns the same day-count fraction as the library", async () => {
		const result = await call("day_count_fraction", {
			start: "2003-11-01",
			end: "2004-05-01",
			convention: "ACT/ACT ISDA",
		});
		expect(result.fraction).toBe(dayCountFraction("2003-11-01", "2004-05-01", "ACT/ACT ISDA"));
		expect(result.fraction).toBeCloseTo(0.49772, 5);
	});

	it("returns the same accrued interest as the library", async () => {
		const args = { notional: 1_000_000, rate: 0.05, start: "2024-01-01", end: "2024-04-01", convention: "ACT/365F" as const };
		const result = await call("accrued_interest", args);
		expect(result.accruedInterest).toBe(accruedInterest(args));
	});

	it("classifies business days, weekends, and holidays", async () => {
		const juneteenth = await call("is_business_day", { date: "2024-06-19", calendar: "nyse" });
		expect(juneteenth).toEqual({ isBusinessDay: false, isWeekend: false, isHoliday: true });
		const openDay = await call("is_business_day", { date: "2024-06-12", calendar: "us-federal" });
		expect(openDay).toEqual({ isBusinessDay: true, isWeekend: false, isHoliday: false });
	});

	it("adjusts dates and advances business days", async () => {
		const adjusted = await call("adjust_date", { date: "2024-03-29", convention: "modified-following", calendar: "target" });
		expect(adjusted.adjusted).toBe("2024-03-28");
		const settled = await call("add_business_days", { date: "2024-07-02", count: 2, calendar: "us-federal" });
		expect(settled.date).toBe("2024-07-05");
	});

	it("generates the same schedule as the library", async () => {
		const args = { effective: "2024-01-15", termination: "2026-01-15", frequency: "semiannual" as const, calendar: "target" as const };
		const result = await call("generate_schedule", args);
		const periods = generateSchedule(args);
		expect(result.count).toBe(periods.length);
		expect(result.periods).toEqual(periods);
	});

	it("lists the supported conventions and calendars", async () => {
		const conventions = await call("list_conventions", {});
		expect(conventions.conventions).toEqual([...DAY_COUNT_CONVENTIONS]);
		const calendars = (await call("list_calendars", {})) as { calendars: { id: string; description: string }[] };
		expect(calendars.calendars.map((calendar) => calendar.id)).toEqual([...CALENDARS]);
		for (const calendar of calendars.calendars) {
			expect(calendar.description.length).toBeGreaterThan(0);
		}
	});

	it("surfaces an invalid date as a loud tool error", async () => {
		const result = (await client.callTool({
			name: "day_count_fraction",
			arguments: { start: "2024-13-01", end: "2024-12-31", convention: "ACT/360" },
		})) as ToolResult;
		expect(result.isError).toBe(true);
		expect(result.content[0]!.text.length).toBeGreaterThan(0);
	});
});
