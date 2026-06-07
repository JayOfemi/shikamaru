import { describe, expect, it } from "vitest";
import { actualDays, daysInMonth, isLeapYear, parseDate, toEpochDay } from "../src/index.js";

describe("calendar core", () => {
	it("identifies leap years", () => {
		expect(isLeapYear(2020)).toBe(true);
		expect(isLeapYear(2021)).toBe(false);
		expect(isLeapYear(1900)).toBe(false);
		expect(isLeapYear(2000)).toBe(true);
	});

	it("knows days in month", () => {
		expect(daysInMonth(2020, 2)).toBe(29);
		expect(daysInMonth(2021, 2)).toBe(28);
		expect(daysInMonth(2024, 4)).toBe(30);
		expect(daysInMonth(2024, 12)).toBe(31);
	});

	it("counts actual days timezone-free", () => {
		expect(actualDays(parseDate("2024-01-01"), parseDate("2024-12-31"))).toBe(365);
		expect(actualDays(parseDate("2020-01-01"), parseDate("2020-12-31"))).toBe(365);
		expect(actualDays(parseDate("2020-02-28"), parseDate("2020-03-01"))).toBe(2);
	});

	it("anchors the epoch at 1970-01-01", () => {
		expect(toEpochDay(parseDate("1970-01-01"))).toBe(0);
	});

	it("rejects malformed and out-of-range dates", () => {
		expect(() => parseDate("2024-13-01")).toThrow();
		expect(() => parseDate("2023-02-29")).toThrow();
		expect(() => parseDate("2024/01/01")).toThrow();
	});
});
