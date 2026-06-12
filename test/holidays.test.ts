import { describe, expect, it } from "vitest";
import { daysInMonth, formatDate, isHoliday, type CalendarId } from "../src/index.js";

function holidaysOfYear(year: number, calendar: CalendarId): string[] {
	const list: string[] = [];
	for (let month = 1; month <= 12; month++) {
		for (let day = 1; day <= daysInMonth(year, month); day++) {
			const iso = formatDate({ year, month, day });
			if (isHoliday(iso, calendar)) {
				list.push(iso);
			}
		}
	}
	return list;
}

describe("us-federal (OPM)", () => {
	it("matches the published 2024 federal holiday list exactly", () => {
		expect(holidaysOfYear(2024, "us-federal")).toEqual([
			"2024-01-01", // New Year's Day
			"2024-01-15", // Martin Luther King Jr. Day
			"2024-02-19", // Washington's Birthday
			"2024-05-27", // Memorial Day
			"2024-06-19", // Juneteenth
			"2024-07-04", // Independence Day
			"2024-09-02", // Labor Day
			"2024-10-14", // Columbus Day
			"2024-11-11", // Veterans Day
			"2024-11-28", // Thanksgiving
			"2024-12-25", // Christmas
		]);
	});

	it("observes weekend holidays on the adjacent weekday", () => {
		expect(isHoliday("2021-06-18", "us-federal")).toBe(true); // Juneteenth 2021 fell Saturday
		expect(isHoliday("2021-12-31", "us-federal")).toBe(true); // New Year's 2022 fell Saturday
		expect(isHoliday("2022-12-26", "us-federal")).toBe(true); // Christmas 2022 fell Sunday
		expect(isHoliday("2020-07-03", "us-federal")).toBe(true); // July 4th 2020 fell Saturday
	});

	it("gates Juneteenth at its 2021 enactment", () => {
		expect(isHoliday("2020-06-19", "us-federal")).toBe(false);
		expect(isHoliday("2024-06-19", "us-federal")).toBe(true);
	});
});

describe("nyse", () => {
	it("does not observe a Saturday New Year's on the prior Friday", () => {
		expect(isHoliday("2021-12-31", "nyse")).toBe(false); // the exchange was open
		expect(isHoliday("2023-01-02", "nyse")).toBe(true); // Sunday New Year's rolls to Monday
	});

	it("skips Columbus Day and Veterans Day", () => {
		expect(isHoliday("2024-10-14", "nyse")).toBe(false);
		expect(isHoliday("2024-11-11", "nyse")).toBe(false);
	});

	it("closes for Good Friday and observed Juneteenth", () => {
		expect(isHoliday("2024-03-29", "nyse")).toBe(true);
		expect(isHoliday("2022-06-20", "nyse")).toBe(true); // Juneteenth 2022 fell Sunday
		expect(isHoliday("2021-06-18", "nyse")).toBe(false); // NYSE first observed it in 2022
	});

	it("gates MLK at its 1998 first observance", () => {
		expect(isHoliday("1997-01-20", "nyse")).toBe(false);
		expect(isHoliday("1998-01-19", "nyse")).toBe(true);
	});

	it("pins the one-off closures", () => {
		expect(isHoliday("2001-09-11", "nyse")).toBe(true);
		expect(isHoliday("2012-10-29", "nyse")).toBe(true);
		expect(isHoliday("2012-10-30", "nyse")).toBe(true);
		expect(isHoliday("2018-12-05", "nyse")).toBe(true);
		expect(isHoliday("2025-01-09", "nyse")).toBe(true);
	});
});

describe("sifma-us", () => {
	it("closes Columbus Day and Veterans Day, unlike the NYSE", () => {
		expect(isHoliday("2024-10-14", "sifma-us")).toBe(true);
		expect(isHoliday("2024-11-11", "sifma-us")).toBe(true);
	});

	it("does not observe a Saturday Veterans Day on the Friday, unlike us-federal", () => {
		expect(isHoliday("2017-11-10", "sifma-us")).toBe(false); // SIFMA 2017 archive: no close
		expect(isHoliday("2017-11-10", "us-federal")).toBe(true);
		expect(isHoliday("2018-11-12", "sifma-us")).toBe(true); // Sunday Nov 11 rolls to Monday
	});

	it("closed October 30th 2012 for Sandy but traded the 29th", () => {
		expect(isHoliday("2012-10-30", "sifma-us")).toBe(true);
		expect(isHoliday("2012-10-29", "sifma-us")).toBe(false);
	});

	it("pins the Reagan mourning close", () => {
		expect(isHoliday("2004-06-11", "sifma-us")).toBe(true);
		expect(isHoliday("2004-06-11", "nyse")).toBe(true);
	});

	it("traded the Carter mourning day that closed the NYSE (early close only)", () => {
		expect(isHoliday("2025-01-09", "sifma-us")).toBe(false);
		expect(isHoliday("2025-01-09", "nyse")).toBe(true);
	});

	it("trades employment-report Good Fridays but closes the others", () => {
		expect(isHoliday("2021-04-02", "sifma-us")).toBe(false); // jobs-report early close
		expect(isHoliday("2023-04-07", "sifma-us")).toBe(false);
		expect(isHoliday("2024-03-29", "sifma-us")).toBe(true);
		expect(isHoliday("2021-04-02", "nyse")).toBe(true); // equities still close
	});
});

describe("target", () => {
	it("matches the six-rule 2024 list exactly", () => {
		expect(holidaysOfYear(2024, "target")).toEqual([
			"2024-01-01",
			"2024-03-29", // Good Friday
			"2024-04-01", // Easter Monday
			"2024-05-01",
			"2024-12-25",
			"2024-12-26",
		]);
	});

	it("gates the post-2000 rules and pins the changeover year-ends", () => {
		expect(isHoliday("1999-04-02", "target")).toBe(false); // Good Friday before 2000
		expect(isHoliday("1999-01-01", "target")).toBe(true);
		expect(isHoliday("2001-12-31", "target")).toBe(true);
		expect(isHoliday("2002-12-31", "target")).toBe(false);
	});
});

describe("uk", () => {
	it("matches the proclaimed 2022 list exactly (jubilee, funeral, substitutes)", () => {
		expect(holidaysOfYear(2022, "uk")).toEqual([
			"2022-01-03", // substitute for Saturday January 1st
			"2022-04-15", // Good Friday
			"2022-04-18", // Easter Monday
			"2022-05-02", // Early May
			"2022-06-02", // Spring, moved for the Platinum Jubilee
			"2022-06-03", // Platinum Jubilee
			"2022-08-29", // Summer
			"2022-09-19", // State funeral of Elizabeth II
			"2022-12-26", // Boxing Day
			"2022-12-27", // substitute for Sunday Christmas
		]);
	});

	it("suppresses the regular dates that proclamations moved", () => {
		expect(isHoliday("2022-05-30", "uk")).toBe(false);
		expect(isHoliday("2020-05-04", "uk")).toBe(false);
		expect(isHoliday("2020-05-08", "uk")).toBe(true);
	});

	it("adds substitute days when Christmas hits the weekend", () => {
		expect(isHoliday("2021-12-27", "uk")).toBe(true);
		expect(isHoliday("2021-12-28", "uk")).toBe(true);
		expect(isHoliday("2021-12-24", "uk")).toBe(false);
	});

	it("includes the coronation alongside the regular Early May holiday", () => {
		expect(isHoliday("2023-05-01", "uk")).toBe(true);
		expect(isHoliday("2023-05-08", "uk")).toBe(true);
	});
});
