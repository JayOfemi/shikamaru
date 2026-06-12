import { describe, expect, it } from "vitest";
import { generateSchedule } from "../src/index.js";

describe("schedule generation", () => {
	it("generates a clean semiannual schedule with no stub", () => {
		const periods = generateSchedule({
			effective: "2024-01-15",
			termination: "2026-01-15",
			frequency: "semiannual",
			calendar: "target",
		});
		expect(periods.map((p) => [p.start, p.end])).toEqual([
			["2024-01-15", "2024-07-15"],
			["2024-07-15", "2025-01-15"],
			["2025-01-15", "2025-07-15"],
			["2025-07-15", "2026-01-15"],
		]);
		for (const period of periods) {
			expect(period.unadjustedStart).toBe(period.start);
			expect(period.unadjustedEnd).toBe(period.end);
		}
	});

	it("puts a short stub in front under backward generation", () => {
		const periods = generateSchedule({
			effective: "2024-02-10",
			termination: "2025-01-15",
			frequency: "semiannual",
			calendar: "target",
		});
		expect(periods.length).toBe(2);
		expect(periods[0]!.unadjustedStart).toBe("2024-02-10");
		expect(periods[0]!.start).toBe("2024-02-12"); // Saturday effective adjusts forward
		expect(periods[0]!.unadjustedEnd).toBe("2024-07-15");
		expect(periods[1]!.end).toBe("2025-01-15");
	});

	it("merges a long front stub into its neighbor", () => {
		const periods = generateSchedule({
			effective: "2024-02-10",
			termination: "2025-01-15",
			frequency: "semiannual",
			calendar: "target",
			stub: "long",
		});
		expect(periods.length).toBe(1);
		expect(periods[0]!.unadjustedStart).toBe("2024-02-10");
		expect(periods[0]!.unadjustedEnd).toBe("2025-01-15");
	});

	it("puts a short stub at the back under forward generation", () => {
		const periods = generateSchedule({
			effective: "2024-01-15",
			termination: "2024-12-20",
			frequency: "quarterly",
			calendar: "target",
			generation: "forward",
		});
		expect(periods.map((p) => [p.unadjustedStart, p.unadjustedEnd])).toEqual([
			["2024-01-15", "2024-04-15"],
			["2024-04-15", "2024-07-15"],
			["2024-07-15", "2024-10-15"],
			["2024-10-15", "2024-12-20"],
		]);
	});

	it("merges a long back stub under forward generation", () => {
		const periods = generateSchedule({
			effective: "2024-01-15",
			termination: "2024-12-20",
			frequency: "quarterly",
			calendar: "target",
			generation: "forward",
			stub: "long",
		});
		expect(periods.map((p) => [p.unadjustedStart, p.unadjustedEnd])).toEqual([
			["2024-01-15", "2024-04-15"],
			["2024-04-15", "2024-07-15"],
			["2024-07-15", "2024-12-20"],
		]);
	});

	it("keeps rolls at month-ends when endOfMonth is set on a month-end anchor", () => {
		const periods = generateSchedule({
			effective: "2024-02-29",
			termination: "2025-02-28",
			frequency: "semiannual",
			calendar: "target",
			endOfMonth: true,
		});
		expect(periods.map((p) => [p.unadjustedStart, p.unadjustedEnd])).toEqual([
			["2024-02-29", "2024-08-31"],
			["2024-08-31", "2025-02-28"],
		]);
		// August 31st 2024 is a Saturday; modified-following falls back inside August.
		expect(periods[0]!.end).toBe("2024-08-30");
		expect(periods[1]!.start).toBe("2024-08-30");
	});

	it("clamps instead when endOfMonth is off, creating a one-day stub", () => {
		const periods = generateSchedule({
			effective: "2024-02-29",
			termination: "2025-02-28",
			frequency: "semiannual",
			calendar: "target",
		});
		expect(periods[0]!.unadjustedStart).toBe("2024-02-29");
		expect(periods[0]!.unadjustedEnd).toBe("2024-08-28");
	});

	it("honors a separate termination convention", () => {
		const base = {
			effective: "2024-01-02",
			termination: "2024-06-30",
			frequency: "semiannual" as const,
			calendar: "target" as const,
		};
		expect(generateSchedule({ ...base, terminationConvention: "unadjusted" }).at(-1)!.end).toBe("2024-06-30");
		expect(generateSchedule({ ...base, terminationConvention: "following" }).at(-1)!.end).toBe("2024-07-01");
	});

	it("periods are adjacent and cover effective to termination", () => {
		const periods = generateSchedule({
			effective: "2020-03-10",
			termination: "2031-09-22",
			frequency: "quarterly",
			calendar: "us-federal",
		});
		for (let i = 1; i < periods.length; i++) {
			expect(periods[i]!.start).toBe(periods[i - 1]!.end);
			expect(periods[i]!.unadjustedStart).toBe(periods[i - 1]!.unadjustedEnd);
		}
		expect(periods[0]!.unadjustedStart).toBe("2020-03-10");
		expect(periods.at(-1)!.unadjustedEnd).toBe("2031-09-22");
	});

	it("collapses a stub that adjusts past the adjusted termination (QuantLib parity)", () => {
		const periods = generateSchedule({
			effective: "2024-03-07",
			termination: "2024-09-08",
			frequency: "monthly",
			calendar: "target",
			convention: "following",
			terminationConvention: "unadjusted",
			generation: "forward",
		});
		// The 2024-09-07 roll would adjust to 09-09, past the unadjusted termination
		// 09-08, so it collapses into the prior period instead of inverting.
		expect(periods.at(-1)!.end).toBe("2024-09-08");
		for (const period of periods) {
			expect(period.start < period.end).toBe(true);
		}
	});

	it("caps pathological schedule lengths", () => {
		expect(() =>
			generateSchedule({ effective: "2000-01-15", termination: "2150-01-15", frequency: "monthly", calendar: "target" }),
		).toThrow();
	});

	it("rejects a termination on or before the effective date", () => {
		expect(() =>
			generateSchedule({ effective: "2024-01-15", termination: "2024-01-15", frequency: "monthly", calendar: "target" }),
		).toThrow();
	});
});
