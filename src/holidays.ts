// Layer 1b: holiday calendars as rules in code, not data feeds. Each calendar is
// its published rule set plus a short pinned table of historical one-off closures.
// Sources: 5 U.S.C. 6103 / OPM (us-federal), NYSE Rule 7.2 (nyse), SIFMA
// recommendations (sifma-us), ECB TARGET rules (target), gov.uk proclamations (uk).

import { daysInMonth, formatDate, fromEpochDay, toEpochDay, weekday } from "./calendar.js";
import { FRIDAY, MONDAY, SATURDAY, SUNDAY, THURSDAY, TUESDAY } from "./constants.js";
import { easterSunday } from "./easter.js";
import type { CivilDate } from "./types.js";

/** Supported holiday calendars. */
export const CALENDARS = ["us-federal", "nyse", "sifma-us", "target", "uk"] as const;

export type CalendarId = (typeof CALENDARS)[number];

/** One-line description per calendar, for tool listings and docs. */
export const CALENDAR_DESCRIPTIONS: Record<CalendarId, string> = {
	"us-federal": "United States federal holidays (OPM, 5 U.S.C. 6103); weekend holidays observed Friday before or Monday after.",
	"nyse": "New York Stock Exchange full-day trading holidays, including pinned one-off closures.",
	"sifma-us": "SIFMA recommended US bond-market full-close days (early closes count as business days).",
	"target": "TARGET euro settlement closing days (ECB rules, fixed since 2000).",
	"uk": "England and Wales bank holidays, including substitute days and proclaimed one-off moves.",
};

// Pinned one-off full closures (fixed history in code, never predictions).
const NYSE_CLOSURES = new Set([
	"1994-04-27", // Nixon mourning
	"2001-09-11", "2001-09-12", "2001-09-13", "2001-09-14", // September 11 attacks
	"2004-06-11", // Reagan mourning
	"2007-01-02", // Ford mourning
	"2012-10-29", "2012-10-30", // Hurricane Sandy
	"2018-12-05", // G.H.W. Bush mourning
	"2025-01-09", // Carter mourning
]);

const SIFMA_CLOSURES = new Set([
	"2001-09-11", "2001-09-12", // September 11 attacks
	"2004-06-11", // Reagan mourning
	"2012-10-30", // Hurricane Sandy
	"2018-12-05", // G.H.W. Bush mourning
	// Carter mourning 2025-01-09 is NOT here: SIFMA recommended only an early close.
]);

const TARGET_CLOSURES = new Set([
	"1998-12-31", "1999-12-31", "2001-12-31", // year-end closures around the euro changeover
]);

const UK_EXTRA = new Set([
	"1995-05-08", // VE Day 50th (Early May moved)
	"1999-12-31", // Millennium eve
	"2002-06-03", "2002-06-04", // Golden Jubilee (Spring moved + extra day)
	"2011-04-29", // Royal wedding
	"2012-06-04", "2012-06-05", // Diamond Jubilee (Spring moved + extra day)
	"2020-05-08", // VE Day 75th (Early May moved)
	"2022-06-02", "2022-06-03", // Platinum Jubilee (Spring moved + extra day)
	"2022-09-19", // State funeral of Elizabeth II
	"2023-05-08", // Coronation of Charles III
]);

// The regular dates those proclamations MOVED (a move both adds and removes a day).
const UK_SUPPRESSED = new Set([
	"1995-05-01", // Early May moved to May 8
	"2002-05-27", // Spring moved into the Golden Jubilee weekend
	"2012-05-28", // Spring moved into the Diamond Jubilee weekend
	"2020-05-04", // Early May moved to May 8
	"2022-05-30", // Spring moved into the Platinum Jubilee weekend
]);

/**
 * True when the date is a holiday closure under the given calendar. Weekends are
 * NOT holidays here; weekend handling lives in the business-day layer, so this
 * returns true only for weekday closures (matching reference holiday lists).
 */
export function isHolidayDate(date: CivilDate, calendar: CalendarId): boolean {
	const w = weekday(date);
	switch (calendar) {
		case "us-federal":
			return isUsFederalHoliday(date, w);
		case "nyse":
			return isNyseHoliday(date, w);
		case "sifma-us":
			return isSifmaHoliday(date, w);
		case "target":
			return isTargetHoliday(date, w);
		case "uk":
			return isUkHoliday(date, w);
		default: {
			const unreachable: never = calendar;
			throw new Error(`Unsupported calendar: ${String(unreachable)}`);
		}
	}
}

function isUsFederalHoliday(date: CivilDate, w: number): boolean {
	const { year, month, day } = date;
	if (isObservedFixed(date, w, 1, 1)) return true; // New Year's (a Friday Dec 31 observes a Saturday Jan 1)
	if (year >= 2021 && isObservedFixed(date, w, 6, 19)) return true; // Juneteenth, federal since 2021
	if (isObservedFixed(date, w, 7, 4)) return true; // Independence Day
	if (isObservedFixed(date, w, 11, 11)) return true; // Veterans Day
	if (isObservedFixed(date, w, 12, 25)) return true; // Christmas
	if (year >= 1986 && isNthMonday(date, w, 1, 3)) return true; // Martin Luther King Jr. Day
	if (isNthMonday(date, w, 2, 3)) return true; // Washington's Birthday
	if (isLastMonday(date, w, 5)) return true; // Memorial Day
	if (isNthMonday(date, w, 9, 1)) return true; // Labor Day
	if (isNthMonday(date, w, 10, 2)) return true; // Columbus Day
	if (month === 11 && w === THURSDAY && day === nthWeekdayOfMonth(year, 11, THURSDAY, 4)) return true; // Thanksgiving
	return false;
}

function isNyseHoliday(date: CivilDate, w: number): boolean {
	if (NYSE_CLOSURES.has(formatDate(date))) return true;
	const { year, month, day } = date;
	// New Year's: Sunday rolls to Monday; a Saturday January 1st is NOT observed Friday (NYSE rule).
	if (month === 1 && day === 1) return w !== SATURDAY && w !== SUNDAY;
	if (month === 1 && day === 2 && w === MONDAY) return true;
	if (year >= 1998 && isNthMonday(date, w, 1, 3)) return true; // MLK, NYSE since 1998
	if (isNthMonday(date, w, 2, 3)) return true; // Washington's Birthday observance
	if (isGoodFriday(date)) return true;
	if (isLastMonday(date, w, 5)) return true; // Memorial Day
	if (year >= 2022 && isObservedFixed(date, w, 6, 19)) return true; // Juneteenth, NYSE since 2022
	if (isObservedFixed(date, w, 7, 4)) return true; // Independence Day
	if (isNthMonday(date, w, 9, 1)) return true; // Labor Day
	if (month === 11 && w === THURSDAY && day === nthWeekdayOfMonth(year, 11, THURSDAY, 4)) return true; // Thanksgiving
	if (isObservedFixed(date, w, 12, 25)) return true; // Christmas
	return false;
}

function isSifmaHoliday(date: CivilDate, w: number): boolean {
	if (SIFMA_CLOSURES.has(formatDate(date))) return true;
	const { year, month, day } = date;
	// New Year's: Sunday rolls to Monday; no Friday observance for a Saturday January 1st.
	if (month === 1 && day === 1) return w !== SATURDAY && w !== SUNDAY;
	if (month === 1 && day === 2 && w === MONDAY) return true;
	if (year >= 1986 && isNthMonday(date, w, 1, 3)) return true; // MLK
	if (isNthMonday(date, w, 2, 3)) return true; // Washington's Birthday
	// Good Friday, EXCEPT when it falls on the first Friday of April: the monthly
	// employment report makes SIFMA recommend an early close (a trading day) instead.
	if (isGoodFriday(date) && !(month === 4 && day <= 7)) return true;
	if (isLastMonday(date, w, 5)) return true; // Memorial Day
	if (year >= 2022 && isObservedFixed(date, w, 6, 19)) return true; // Juneteenth, SIFMA since 2022
	if (isObservedFixed(date, w, 7, 4)) return true; // Independence Day
	if (isNthMonday(date, w, 9, 1)) return true; // Labor Day
	if (isNthMonday(date, w, 10, 2)) return true; // Columbus Day
	// Veterans Day: Sunday rolls to Monday, but SIFMA does not move a Saturday
	// November 11th to the Friday (us-federal does; SIFMA archive lists no close).
	if (month === 11 && day === 11) return w !== SATURDAY && w !== SUNDAY;
	if (month === 11 && day === 12 && w === MONDAY) return true;
	if (month === 11 && w === THURSDAY && day === nthWeekdayOfMonth(year, 11, THURSDAY, 4)) return true; // Thanksgiving
	if (isObservedFixed(date, w, 12, 25)) return true; // Christmas
	return false;
}

function isTargetHoliday(date: CivilDate, w: number): boolean {
	if (w === SATURDAY || w === SUNDAY) return false;
	const { year, month, day } = date;
	if (month === 1 && day === 1) return true; // New Year's, never shifted
	if (month === 12 && day === 25) return true; // Christmas, never shifted
	if (year >= 2000) {
		if (isGoodFriday(date) || isEasterMonday(date)) return true;
		if (month === 5 && day === 1) return true; // Labour Day
		if (month === 12 && day === 26) return true; // Day of Goodwill
	}
	return TARGET_CLOSURES.has(formatDate(date));
}

function isUkHoliday(date: CivilDate, w: number): boolean {
	const iso = formatDate(date);
	if (UK_SUPPRESSED.has(iso)) return false;
	if (UK_EXTRA.has(iso)) return true;
	const { month, day } = date;
	// New Year's with a substitute Monday: Jan 2 Monday means Jan 1 was Sunday,
	// Jan 3 Monday means Jan 1 was Saturday.
	if (month === 1 && (day === 1 ? w !== SATURDAY && w !== SUNDAY : (day === 2 || day === 3) && w === MONDAY)) return true;
	if (isGoodFriday(date) || isEasterMonday(date)) return true;
	if (isNthMonday(date, w, 5, 1)) return true; // Early May bank holiday
	if (isLastMonday(date, w, 5)) return true; // Spring bank holiday
	if (isLastMonday(date, w, 8)) return true; // Summer bank holiday
	if (month === 12) {
		// Christmas and Boxing Day with substitute weekdays when either hits the weekend.
		if ((day === 25 || day === 26) && w !== SATURDAY && w !== SUNDAY) return true;
		if ((day === 27 || day === 28) && (w === MONDAY || w === TUESDAY)) return true;
	}
	return false;
}

// A fixed-date holiday observed on the nearest weekday: the date itself when on a
// weekday, the Friday before when it falls Saturday, the Monday after when Sunday.
function isObservedFixed(date: CivilDate, w: number, month: number, day: number): boolean {
	if (date.month === month && date.day === day) {
		return w !== SATURDAY && w !== SUNDAY;
	}
	if (w === FRIDAY) {
		const next = fromEpochDay(toEpochDay(date) + 1);
		return next.month === month && next.day === day;
	}
	if (w === MONDAY) {
		const previous = fromEpochDay(toEpochDay(date) - 1);
		return previous.month === month && previous.day === day;
	}
	return false;
}

function isNthMonday(date: CivilDate, w: number, month: number, n: number): boolean {
	return date.month === month && w === MONDAY && date.day === nthWeekdayOfMonth(date.year, month, MONDAY, n);
}

function isLastMonday(date: CivilDate, w: number, month: number): boolean {
	return date.month === month && w === MONDAY && date.day === lastWeekdayOfMonth(date.year, month, MONDAY);
}

function isGoodFriday(date: CivilDate): boolean {
	return toEpochDay(date) === toEpochDay(easterSunday(date.year)) - 2;
}

function isEasterMonday(date: CivilDate): boolean {
	return toEpochDay(date) === toEpochDay(easterSunday(date.year)) + 1;
}

function nthWeekdayOfMonth(year: number, month: number, weekdayWanted: number, n: number): number {
	const firstWeekday = weekday({ year, month, day: 1 });
	return 1 + ((weekdayWanted - firstWeekday + 7) % 7) + (n - 1) * 7;
}

function lastWeekdayOfMonth(year: number, month: number, weekdayWanted: number): number {
	const lastDay = daysInMonth(year, month);
	const lastDayWeekday = weekday({ year, month, day: lastDay });
	return lastDay - ((lastDayWeekday - weekdayWanted + 7) % 7);
}
