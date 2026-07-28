// MCP server: exposes shikamaru's deterministic calcs as tools an AI can call.

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { accruedInterest } from "./accrued.js";
import { BUSINESS_DAY_CONVENTIONS, addBusinessDays, adjustDate, isBusinessDay, isHoliday, isWeekend } from "./businessDay.js";
import { SERVER_NAME, SERVER_VERSION } from "./constants.js";
import { dayCountFraction } from "./dayCount.js";
import { CALENDARS, CALENDAR_DESCRIPTIONS } from "./holidays.js";
import { SCHEDULE_FREQUENCIES, generateSchedule } from "./schedule.js";
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
const calendarSchema = z
	.enum(CALENDARS)
	.describe(
		"Holiday calendar: us-federal (US federal holidays), nyse (NYSE trading days), sifma-us (US bond market), target (euro settlement), uk (England and Wales bank holidays).",
	);
const businessDayConventionSchema = z
	.enum(BUSINESS_DAY_CONVENTIONS)
	.describe("ISDA business-day adjustment convention: following, modified-following, preceding, modified-preceding, or unadjusted.");
const icmaFrequencySchema = z
	.number()
	.int()
	.refine((value) => [1, 2, 3, 4, 6, 12].includes(value), "Use 1, 2, 3, 4, 6, or 12.")
	.optional()
	.describe("ACT/ACT ICMA only, required for it: coupon payments per year (1, 2, 3, 4, 6, or 12).");
const referenceDateSchema = z
	.string()
	.regex(/^\d{4}-\d{2}-\d{2}$/, "Use ISO format YYYY-MM-DD.")
	.optional()
	.describe("ACT/ACT ICMA only: reference (notional coupon) period boundary, ISO YYYY-MM-DD. Supply referenceStart and referenceEnd together, or neither.");
const isoDateResultSchema = z.string().describe("ISO calendar date, YYYY-MM-DD.");

/** Every tool is pure math: no side effects, no external world. Declared per the MCP tool-annotation hints. */
const PURE_TOOL_ANNOTATIONS = { readOnlyHint: true, openWorldHint: false } as const;

/** Structured result plus the same JSON as a text block, for clients that only read text content. */
function asResult<T extends Record<string, unknown>>(payload: T) {
	return { content: [{ type: "text" as const, text: JSON.stringify(payload) }], structuredContent: payload };
}

/** Build the shikamaru MCP server (no transport attached). */
export function createServer(): McpServer {
	const server = new McpServer({ name: SERVER_NAME, version: SERVER_VERSION });

	server.registerTool(
		"day_count_fraction",
		{
			title: "Day-count fraction",
			description:
				"Exact day-count fraction between two dates under a market convention. Dates are ISO YYYY-MM-DD. For ACT/ACT ICMA also pass frequency (coupons per year) and, for stub periods, the reference period boundaries. Deterministic; do not estimate this with a model.",
			inputSchema: {
				start: dateSchema,
				end: dateSchema,
				convention: conventionSchema,
				endIsTermination: terminationSchema,
				frequency: icmaFrequencySchema,
				referenceStart: referenceDateSchema,
				referenceEnd: referenceDateSchema,
			},
			outputSchema: {
				fraction: z.number().describe("The exact day-count fraction (year fraction) under the convention."),
			},
			annotations: PURE_TOOL_ANNOTATIONS,
		},
		async ({ start, end, convention, endIsTermination, frequency, referenceStart, referenceEnd }) => {
			const fraction = dayCountFraction(start, end, convention, { endIsTermination, frequency, referenceStart, referenceEnd });
			return asResult({ fraction });
		},
	);

	server.registerTool(
		"accrued_interest",
		{
			title: "Accrued interest",
			description:
				"Exact simple accrued interest (notional * rate * day-count fraction) between two dates. Dates are ISO YYYY-MM-DD; rate is the annual rate as a decimal (0.05 = 5%). Deterministic.",
			inputSchema: {
				notional: z.number().finite().describe("Face / principal amount."),
				rate: z.number().finite().describe("Annual rate as a decimal, e.g. 0.05 for 5%."),
				start: dateSchema,
				end: dateSchema,
				convention: conventionSchema,
				endIsTermination: terminationSchema,
			},
			outputSchema: {
				accruedInterest: z.number().describe("Accrued interest in the notional's currency units."),
			},
			annotations: PURE_TOOL_ANNOTATIONS,
		},
		async ({ notional, rate, start, end, convention, endIsTermination }) => {
			const value = accruedInterest({ notional, rate, start, end, convention, options: { endIsTermination } });
			return asResult({ accruedInterest: value });
		},
	);

	server.registerTool(
		"list_conventions",
		{
			title: "List conventions",
			description: "List the supported day-count conventions.",
			inputSchema: {},
			outputSchema: {
				conventions: z.array(z.enum(DAY_COUNT_CONVENTIONS)).describe("Supported day-count conventions by their market names."),
			},
			annotations: PURE_TOOL_ANNOTATIONS,
		},
		async () => {
			return asResult({ conventions: [...DAY_COUNT_CONVENTIONS] });
		},
	);

	server.registerTool(
		"is_business_day",
		{
			title: "Business-day check",
			description:
				"Whether a date is a business day under a holiday calendar, with the reason when it is not (weekend or holiday). Calendars are rules in code (no stale data feed). Deterministic; do not let a model guess market holidays.",
			inputSchema: {
				date: dateSchema,
				calendar: calendarSchema,
			},
			outputSchema: {
				isBusinessDay: z.boolean().describe("True when the date is a business day under the calendar."),
				isWeekend: z.boolean().describe("True when the date falls on a Saturday or Sunday."),
				isHoliday: z.boolean().describe("True when the date is a holiday under the calendar."),
			},
			annotations: PURE_TOOL_ANNOTATIONS,
		},
		async ({ date, calendar }) => {
			return asResult({
				isBusinessDay: isBusinessDay(date, calendar),
				isWeekend: isWeekend(date),
				isHoliday: isHoliday(date, calendar),
			});
		},
	);

	server.registerTool(
		"adjust_date",
		{
			title: "Adjust to a business day",
			description:
				"Adjust a date to a business day under an ISDA convention and holiday calendar. Business days pass through unchanged. modified-following falls back to preceding rather than leave the month (the bond-market default). Deterministic.",
			inputSchema: {
				date: dateSchema,
				convention: businessDayConventionSchema,
				calendar: calendarSchema,
			},
			outputSchema: {
				adjusted: isoDateResultSchema.describe("The adjusted business day, ISO YYYY-MM-DD."),
			},
			annotations: PURE_TOOL_ANNOTATIONS,
		},
		async ({ date, convention, calendar }) => {
			const adjusted = adjustDate(date, convention, calendar);
			return asResult({ adjusted });
		},
	);

	server.registerTool(
		"add_business_days",
		{
			title: "Add business days",
			description:
				"Move a signed number of business days under a holiday calendar (settlement math: T+2 is count 2). Zero returns the date unchanged. Deterministic.",
			inputSchema: {
				date: dateSchema,
				count: z.number().int().min(-1000).max(1000).describe("Business days to move; negative moves backward."),
				calendar: calendarSchema,
			},
			outputSchema: {
				date: isoDateResultSchema.describe("The resulting business day, ISO YYYY-MM-DD."),
			},
			annotations: PURE_TOOL_ANNOTATIONS,
		},
		async ({ date, count, calendar }) => {
			const result = addBusinessDays(date, count, calendar);
			return asResult({ date: result });
		},
	);

	server.registerTool(
		"generate_schedule",
		{
			title: "Generate a payment schedule",
			description:
				"Generate coupon/payment accrual periods between an effective and a termination date: monthly to annual frequency, backward or forward roll, short or long stub, optional end-of-month rule, business-day adjustment per calendar. Returns each period's unadjusted and adjusted start and end. This is where hand-rolled date code goes wrong; do not approximate it.",
			inputSchema: {
				effective: dateSchema,
				termination: dateSchema,
				frequency: z.enum(SCHEDULE_FREQUENCIES).describe("Coupon frequency: annual, semiannual, quarterly, or monthly."),
				calendar: calendarSchema,
				convention: businessDayConventionSchema.optional().describe("Adjustment for every date except termination. Default modified-following."),
				terminationConvention: businessDayConventionSchema.optional().describe("Adjustment for the termination date. Default: same as convention."),
				generation: z.enum(["backward", "forward"]).optional().describe("Roll direction; backward (default) puts any stub in front."),
				stub: z.enum(["short", "long"]).optional().describe("Keep the short stub (default) or merge it into its neighbor."),
				endOfMonth: z.boolean().optional().describe("When true and the anchor is a month-end, every roll date is a month-end."),
			},
			outputSchema: {
				count: z.number().int().describe("Number of accrual periods."),
				periods: z
					.array(
						z.object({
							unadjustedStart: isoDateResultSchema.describe("Unadjusted accrual start."),
							unadjustedEnd: isoDateResultSchema.describe("Unadjusted accrual end."),
							start: isoDateResultSchema.describe("Business-day-adjusted accrual start."),
							end: isoDateResultSchema.describe("Business-day-adjusted accrual end."),
						}),
					)
					.describe("The accrual periods in date order."),
			},
			annotations: PURE_TOOL_ANNOTATIONS,
		},
		async ({ effective, termination, frequency, calendar, convention, terminationConvention, generation, stub, endOfMonth }) => {
			const periods = generateSchedule({
				effective,
				termination,
				frequency,
				calendar,
				convention,
				terminationConvention,
				generation,
				stub,
				endOfMonth,
			});
			return asResult({ count: periods.length, periods });
		},
	);

	server.registerTool(
		"list_calendars",
		{
			title: "List calendars",
			description: "List the supported holiday calendars with a one-line description of each.",
			inputSchema: {},
			outputSchema: {
				calendars: z
					.array(
						z.object({
							id: z.enum(CALENDARS).describe("Calendar identifier."),
							description: z.string().describe("One-line description of the calendar."),
						}),
					)
					.describe("Supported holiday calendars."),
			},
			annotations: PURE_TOOL_ANNOTATIONS,
		},
		async () => {
			const calendars = CALENDARS.map((id) => ({ id, description: CALENDAR_DESCRIPTIONS[id] }));
			return asResult({ calendars });
		},
	);

	return server;
}
