import { describe, expect, it } from "vitest";
import { addBusinessDays, adjustDate, isBusinessDay, isHoliday, isWeekend, nextBusinessDay, previousBusinessDay } from "../src/index.js";

describe("business-day predicates", () => {
	it("separates weekends, holidays, and business days", () => {
		expect(isBusinessDay("2024-06-12", "us-federal")).toBe(true);
		expect(isBusinessDay("2024-06-15", "us-federal")).toBe(false); // Saturday
		expect(isWeekend("2024-06-15")).toBe(true);
		expect(isHoliday("2024-06-15", "us-federal")).toBe(false); // weekend, not holiday
	});

	it("differs across calendars on the same date", () => {
		expect(isBusinessDay("2024-06-19", "us-federal")).toBe(false); // Juneteenth
		expect(isBusinessDay("2024-06-19", "nyse")).toBe(false);
		expect(isBusinessDay("2024-06-19", "target")).toBe(true);
		expect(isBusinessDay("2024-06-19", "uk")).toBe(true);
	});
});

describe("next and previous business day", () => {
	it("skips holidays and weekends", () => {
		expect(nextBusinessDay("2024-07-03", "us-federal")).toBe("2024-07-05");
		expect(previousBusinessDay("2024-01-16", "us-federal")).toBe("2024-01-12"); // over MLK Monday
		expect(nextBusinessDay("2024-06-14", "target")).toBe("2024-06-17"); // plain weekend
	});
});

describe("adjustDate", () => {
	it("passes business days through unchanged", () => {
		expect(adjustDate("2024-06-12", "following", "us-federal")).toBe("2024-06-12");
	});

	it("follows forward over a holiday", () => {
		expect(adjustDate("2024-03-29", "following", "nyse")).toBe("2024-04-01"); // Good Friday
	});

	it("modified-following stays inside the month", () => {
		// Good Friday 2024 under TARGET: following lands April 2nd (Easter Monday
		// blocks April 1st), which leaves March, so the result falls back to March 28th.
		expect(adjustDate("2024-03-29", "modified-following", "target")).toBe("2024-03-28");
	});

	it("precedes backward over a weekend", () => {
		expect(adjustDate("2024-06-15", "preceding", "uk")).toBe("2024-06-14");
	});

	it("modified-preceding stays inside the month", () => {
		expect(adjustDate("2024-09-01", "modified-preceding", "uk")).toBe("2024-09-02");
		expect(adjustDate("2024-09-01", "modified-preceding", "us-federal")).toBe("2024-09-03"); // Labor Day blocks the 2nd
	});

	it("unadjusted is the identity", () => {
		expect(adjustDate("2024-06-15", "unadjusted", "us-federal")).toBe("2024-06-15");
	});
});

describe("addBusinessDays", () => {
	it("computes T+N settlement over holidays", () => {
		expect(addBusinessDays("2024-07-02", 2, "us-federal")).toBe("2024-07-05"); // over July 4th
		expect(addBusinessDays("2021-12-23", 2, "uk")).toBe("2021-12-29"); // over Christmas substitutes
	});

	it("moves backward with negative counts", () => {
		expect(addBusinessDays("2024-07-08", -2, "us-federal")).toBe("2024-07-03");
	});

	it("treats zero as the identity even on a non-business day", () => {
		expect(addBusinessDays("2024-06-15", 0, "target")).toBe("2024-06-15");
	});

	it("rejects fractional and absurd counts", () => {
		expect(() => addBusinessDays("2024-06-12", 1.5, "target")).toThrow();
		expect(() => addBusinessDays("2024-06-12", 1_000_001, "target")).toThrow();
		expect(() => addBusinessDays("2024-06-12", -1_000_001, "target")).toThrow();
	});

	it("steps from a non-business start date", () => {
		expect(addBusinessDays("2024-06-15", 1, "target")).toBe("2024-06-17"); // Saturday start
		expect(addBusinessDays("2024-06-15", -1, "target")).toBe("2024-06-14");
	});

	it("throws instead of emitting malformed dates at the ISO range edges", () => {
		expect(() => previousBusinessDay("0000-01-03", "target")).toThrow();
		expect(() => nextBusinessDay("9999-12-31", "target")).toThrow();
	});

	it("round-trips: +n then -n returns to a business day start", () => {
		const start = "2024-06-12";
		for (const calendar of ["us-federal", "nyse", "sifma-us", "target", "uk"] as const) {
			for (const n of [1, 3, 7, 20]) {
				expect(addBusinessDays(addBusinessDays(start, n, calendar), -n, calendar)).toBe(start);
			}
		}
	});
});
