import { describe, expect, it } from "vitest";
import {
	accruedInterest,
	actualDays,
	DAY_COUNT_CONVENTIONS,
	dayCountFraction,
	parseDate,
} from "../src/index.js";

describe("actual-day conventions", () => {
	it("ACT/360 counts actual days over 360", () => {
		expect(dayCountFraction("2020-01-01", "2020-02-01", "ACT/360")).toBeCloseTo(31 / 360, 12);
	});

	it("ACT/365F counts actual days over 365", () => {
		expect(dayCountFraction("2020-01-01", "2020-02-01", "ACT/365F")).toBeCloseTo(31 / 365, 12);
	});
});

describe("ACT/ACT ISDA", () => {
	it("same year uses that year's length (leap)", () => {
		// 2020 is a leap year: 366 in the denominator.
		expect(dayCountFraction("2020-01-01", "2020-07-01", "ACT/ACT ISDA")).toBeCloseTo(182 / 366, 12);
	});

	it("splits across calendar years (ISDA worked example)", () => {
		// 2003-11-01 to 2004-05-01 = 61/365 (2003) + 121/366 (2004 leap).
		const expected = 61 / 365 + 121 / 366;
		expect(dayCountFraction("2003-11-01", "2004-05-01", "ACT/ACT ISDA")).toBeCloseTo(expected, 12);
	});
});

describe("30/360 family", () => {
	it("30/360 simple month", () => {
		expect(dayCountFraction("2020-01-01", "2020-02-01", "30/360")).toBeCloseTo(30 / 360, 12);
	});

	it("30/360 clips D1=31 to 30", () => {
		// 2020-01-31 -> 2020-02-29: D1 31->30, D2 29 unchanged => 29 days.
		expect(dayCountFraction("2020-01-31", "2020-02-29", "30/360")).toBeCloseTo(29 / 360, 12);
	});

	it("30/360 clips D2=31 to 30 when D1 is 30", () => {
		// 2020-01-30 -> 2020-03-31: D2 31->30 (D1 is 30) => 360*0 + 30*2 + (30-30) = 60.
		expect(dayCountFraction("2020-01-30", "2020-03-31", "30/360")).toBeCloseTo(60 / 360, 12);
	});

	it("30E/360 clips both ends to 30 unconditionally", () => {
		// 2020-01-31 -> 2020-07-31: both 31->30 => 30*6 = 180.
		expect(dayCountFraction("2020-01-31", "2020-07-31", "30E/360")).toBeCloseTo(180 / 360, 12);
	});

	it("30E/360 ISDA maps end-of-February to 30 (non-termination)", () => {
		// 2021-02-28 is last day of Feb -> 30. 2020-12-31 -> 2021-02-28:
		// D1 31->30, D2 28->30 => 360*1 + 30*(2-12) + (30-30) = 360 - 300 = 60.
		expect(dayCountFraction("2020-12-31", "2021-02-28", "30E/360 ISDA")).toBeCloseTo(60 / 360, 12);
	});

	it("30E/360 ISDA keeps end-of-February when it is the termination date", () => {
		// Same dates, but end is the maturity date: D2 stays 28 => 58.
		expect(
			dayCountFraction("2020-12-31", "2021-02-28", "30E/360 ISDA", { endIsTermination: true }),
		).toBeCloseTo(58 / 360, 12);
	});
});

describe("properties", () => {
	it("a zero-length period is zero for every convention", () => {
		for (const convention of DAY_COUNT_CONVENTIONS) {
			expect(dayCountFraction("2024-03-15", "2024-03-15", convention)).toBe(0);
		}
	});

	it("ACT/360 is additive across a split point", () => {
		const f = (a: string, b: string): number => dayCountFraction(a, b, "ACT/360");
		expect(f("2024-01-10", "2024-09-03")).toBeCloseTo(
			f("2024-01-10", "2024-05-01") + f("2024-05-01", "2024-09-03"),
			12,
		);
	});
});

describe("accrued interest", () => {
	it("is notional * rate * fraction", () => {
		const days = actualDays(parseDate("2024-01-01"), parseDate("2024-03-31"));
		const expected = 1_000_000 * 0.05 * (days / 365);
		expect(
			accruedInterest({
				notional: 1_000_000,
				rate: 0.05,
				start: "2024-01-01",
				end: "2024-03-31",
				convention: "ACT/365F",
			}),
		).toBeCloseTo(expected, 6);
	});
});
