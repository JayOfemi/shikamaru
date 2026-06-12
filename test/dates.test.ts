import { describe, expect, it } from "vitest";
import { addMonths, easterSunday, formatDate, fromEpochDay, parseDate, toEpochDay, weekday } from "../src/index.js";

describe("epoch round trip", () => {
	it("inverts toEpochDay exactly", () => {
		expect(fromEpochDay(0)).toEqual({ year: 1970, month: 1, day: 1 });
		expect(fromEpochDay(toEpochDay(parseDate("2024-02-29")))).toEqual({ year: 2024, month: 2, day: 29 });
		for (let epoch = -100000; epoch <= 100000; epoch += 9973) {
			expect(toEpochDay(fromEpochDay(epoch))).toBe(epoch);
		}
	});

	it("round-trips epochs deep into negative years", () => {
		for (let epoch = -1000000; epoch <= 0; epoch += 99991) {
			expect(toEpochDay(fromEpochDay(epoch))).toBe(epoch);
		}
	});

	it("formatDate rejects years outside 0000-9999", () => {
		expect(() => formatDate({ year: -1, month: 12, day: 31 })).toThrow();
		expect(() => formatDate({ year: 10000, month: 1, day: 1 })).toThrow();
	});
});

describe("weekday", () => {
	it("matches known anchors (0 = Sunday)", () => {
		expect(weekday(parseDate("1970-01-01"))).toBe(4); // Thursday
		expect(weekday(parseDate("2000-01-01"))).toBe(6); // Saturday
		expect(weekday(parseDate("2024-06-19"))).toBe(3); // Wednesday
		expect(weekday(parseDate("2026-06-11"))).toBe(4); // Thursday
	});
});

describe("formatDate", () => {
	it("zero-pads to strict ISO", () => {
		expect(formatDate({ year: 2024, month: 3, day: 5 })).toBe("2024-03-05");
		expect(formatDate({ year: 800, month: 12, day: 31 })).toBe("0800-12-31");
	});
});

describe("addMonths", () => {
	it("clamps the day to the target month", () => {
		expect(addMonths(parseDate("2024-01-31"), 1, false)).toEqual({ year: 2024, month: 2, day: 29 });
		expect(addMonths(parseDate("2023-01-31"), 1, false)).toEqual({ year: 2023, month: 2, day: 28 });
		expect(addMonths(parseDate("2024-03-31"), -1, false)).toEqual({ year: 2024, month: 2, day: 29 });
	});

	it("keeps month-ends at month-ends when endOfMonth is set", () => {
		expect(addMonths(parseDate("2024-02-29"), 6, true)).toEqual({ year: 2024, month: 8, day: 31 });
		expect(addMonths(parseDate("2024-02-29"), 6, false)).toEqual({ year: 2024, month: 8, day: 29 });
		expect(addMonths(parseDate("2025-02-28"), -6, true)).toEqual({ year: 2024, month: 8, day: 31 });
	});

	it("crosses year boundaries in both directions", () => {
		expect(addMonths(parseDate("2024-11-15"), 3, false)).toEqual({ year: 2025, month: 2, day: 15 });
		expect(addMonths(parseDate("2024-02-15"), -3, false)).toEqual({ year: 2023, month: 11, day: 15 });
	});
});

describe("Easter computus (Meeus/Jones/Butcher)", () => {
	it("matches known Easter Sundays", () => {
		expect(formatDate(easterSunday(2000))).toBe("2000-04-23");
		expect(formatDate(easterSunday(2016))).toBe("2016-03-27");
		expect(formatDate(easterSunday(2024))).toBe("2024-03-31");
		expect(formatDate(easterSunday(2025))).toBe("2025-04-20");
		expect(formatDate(easterSunday(2038))).toBe("2038-04-25"); // latest possible Easter
	});

	it("always lands on a Sunday in March or April", () => {
		for (let year = 1990; year <= 2060; year++) {
			const easter = easterSunday(year);
			expect(weekday(easter)).toBe(0);
			expect(easter.month === 3 || easter.month === 4).toBe(true);
		}
	});
});
