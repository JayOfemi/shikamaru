import { describe, expect, it } from "vitest";
import { dayCountFraction } from "../src/index.js";

describe("ACT/ACT ICMA", () => {
	it("gives exactly one over the frequency for a regular period", () => {
		// The classic semiannual bond period: 182 days over 2 x 182.
		expect(dayCountFraction("2003-11-01", "2004-05-01", "ACT/ACT ICMA", { frequency: 2 })).toBe(0.5);
	});

	it("computes a mid-period accrual against the full reference period", () => {
		const fraction = dayCountFraction("2003-11-01", "2004-02-01", "ACT/ACT ICMA", {
			frequency: 2,
			referenceStart: "2003-11-01",
			referenceEnd: "2004-05-01",
		});
		expect(fraction).toBeCloseTo(92 / 364, 12);
	});

	it("matches the published short-first-stub example", () => {
		// EMU/ISDA example: accrual 1999-02-01 to 1999-07-01 inside the annual
		// notional period 1998-07-01 to 1999-07-01: 150 / (1 x 365).
		const fraction = dayCountFraction("1999-02-01", "1999-07-01", "ACT/ACT ICMA", {
			frequency: 1,
			referenceStart: "1998-07-01",
			referenceEnd: "1999-07-01",
		});
		expect(fraction).toBeCloseTo(150 / 365, 12);
	});

	it("matches the published long-first-stub example", () => {
		// ISDA example: accrual 2002-08-15 to 2003-07-15, semiannual, first regular
		// coupon 2003-07-15: 153/(2 x 184) + 181/(2 x 181).
		const fraction = dayCountFraction("2002-08-15", "2003-07-15", "ACT/ACT ICMA", {
			frequency: 2,
			referenceStart: "2003-01-15",
			referenceEnd: "2003-07-15",
		});
		expect(fraction).toBeCloseTo(153 / 368 + 0.5, 12);
	});

	it("walks notional periods forward past the reference end", () => {
		const fraction = dayCountFraction("2000-02-01", "2000-07-15", "ACT/ACT ICMA", {
			frequency: 2,
			referenceStart: "1999-11-01",
			referenceEnd: "2000-05-01",
		});
		expect(fraction).toBeCloseTo(90 / 364 + 75 / 368, 12);
	});

	it("measures a period entirely beyond the reference end against the NEXT notional period", () => {
		const fraction = dayCountFraction("2000-12-01", "2001-02-01", "ACT/ACT ICMA", {
			frequency: 2,
			referenceStart: "2000-05-01",
			referenceEnd: "2000-11-01",
		});
		expect(fraction).toBeCloseTo(62 / 362, 12);
	});

	it("measures a period entirely before the reference start against the PREVIOUS notional period", () => {
		const fraction = dayCountFraction("2000-08-01", "2000-10-01", "ACT/ACT ICMA", {
			frequency: 2,
			referenceStart: "2000-11-01",
			referenceEnd: "2001-05-01",
		});
		expect(fraction).toBeCloseTo(61 / 368, 12);
	});

	it("anchors forward notional boundaries on the original month-end reference", () => {
		// ref [2003-08-31, 2004-02-29]: boundaries 2004-08-29, 2005-02-28 step from
		// 2004-02-29 directly, so the clamp never compounds. Second period is 182 days.
		const fraction = dayCountFraction("2004-02-29", "2004-08-29", "ACT/ACT ICMA", {
			frequency: 2,
			referenceStart: "2003-08-31",
			referenceEnd: "2004-02-29",
		});
		expect(fraction).toBeCloseTo(182 / (2 * 182), 12);
	});

	it("covers every accepted frequency", () => {
		expect(dayCountFraction("2024-01-15", "2024-05-15", "ACT/ACT ICMA", { frequency: 3 })).toBeCloseTo(1 / 3, 12);
		expect(dayCountFraction("2024-01-15", "2024-03-15", "ACT/ACT ICMA", { frequency: 6 })).toBeCloseTo(1 / 6, 12);
		expect(dayCountFraction("2024-01-15", "2024-02-15", "ACT/ACT ICMA", { frequency: 12 })).toBeCloseTo(1 / 12, 12);
	});

	it("rejects a one-sided reference period", () => {
		expect(() =>
			dayCountFraction("2002-08-15", "2003-07-15", "ACT/ACT ICMA", { frequency: 2, referenceEnd: "2003-07-15" }),
		).toThrow();
		expect(() =>
			dayCountFraction("2002-08-15", "2003-07-15", "ACT/ACT ICMA", { frequency: 2, referenceStart: "2003-01-15" }),
		).toThrow();
	});

	it("is additive at any split point inside one reference period", () => {
		const options = { frequency: 4, referenceStart: "2024-01-31", referenceEnd: "2024-04-30" };
		const whole = dayCountFraction("2024-01-31", "2024-04-30", "ACT/ACT ICMA", options);
		const left = dayCountFraction("2024-01-31", "2024-03-11", "ACT/ACT ICMA", options);
		const right = dayCountFraction("2024-03-11", "2024-04-30", "ACT/ACT ICMA", options);
		expect(left + right).toBeCloseTo(whole, 14);
		expect(whole).toBe(0.25);
	});

	it("returns zero for an empty period", () => {
		expect(dayCountFraction("2024-03-15", "2024-03-15", "ACT/ACT ICMA", { frequency: 2 })).toBe(0);
	});

	it("rejects missing or invalid arguments", () => {
		expect(() => dayCountFraction("2024-01-01", "2024-07-01", "ACT/ACT ICMA")).toThrow();
		expect(() => dayCountFraction("2024-01-01", "2024-07-01", "ACT/ACT ICMA", { frequency: 5 })).toThrow();
		expect(() => dayCountFraction("2024-07-01", "2024-01-01", "ACT/ACT ICMA", { frequency: 2 })).toThrow();
		expect(() =>
			dayCountFraction("2024-01-01", "2024-07-01", "ACT/ACT ICMA", {
				frequency: 2,
				referenceStart: "2024-05-01",
				referenceEnd: "2024-05-01",
			}),
		).toThrow();
	});
});
