// Layer 0: the calendar core. Timezone-free, exact integer date math.

import { ISO_DATE_PATTERN, MONTHS_PER_YEAR } from "./constants.js";
import type { CivilDate } from "./types.js";

/** True for a proleptic Gregorian leap year. */
export function isLeapYear(year: number): boolean {
	return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

/** Number of days in the given month (1-12) of the given year. */
export function daysInMonth(year: number, month: number): number {
	switch (month) {
		case 2:
			return isLeapYear(year) ? 29 : 28;
		case 4:
		case 6:
		case 9:
		case 11:
			return 30;
		default:
			return 31;
	}
}

/** True when the date is the last calendar day of its month. */
export function isLastDayOfMonth(date: CivilDate): boolean {
	return date.day === daysInMonth(date.year, date.month);
}

/**
 * Days since 1970-01-01 in the proleptic Gregorian calendar (Howard Hinnant's
 * algorithm). Timezone-free and exact for any year, so date subtraction never
 * touches the JS Date object or local time.
 */
export function toEpochDay(date: CivilDate): number {
	const { year, month, day } = date;
	const y = month <= 2 ? year - 1 : year;
	const era = Math.floor((y >= 0 ? y : y - 399) / 400);
	const yoe = y - era * 400;
	const mp = month > 2 ? month - 3 : month + 9;
	const doy = Math.floor((153 * mp + 2) / 5) + day - 1;
	const doe = yoe * 365 + Math.floor(yoe / 4) - Math.floor(yoe / 100) + doy;
	return era * 146097 + doe - 719468;
}

/** Actual number of calendar days from start to end (signed). */
export function actualDays(start: CivilDate, end: CivilDate): number {
	return toEpochDay(end) - toEpochDay(start);
}

/** Parse and validate a strict ISO "YYYY-MM-DD" date. Throws on anything invalid. */
export function parseDate(iso: string): CivilDate {
	const match = ISO_DATE_PATTERN.exec(iso);
	if (!match) {
		throw new Error(`Invalid date "${iso}": expected format YYYY-MM-DD.`);
	}
	const year = Number(match[1]);
	const month = Number(match[2]);
	const day = Number(match[3]);
	if (month < 1 || month > MONTHS_PER_YEAR) {
		throw new Error(`Invalid date "${iso}": month must be 01-12.`);
	}
	const maxDay = daysInMonth(year, month);
	if (day < 1 || day > maxDay) {
		throw new Error(`Invalid date "${iso}": day out of range for that month (max ${maxDay}).`);
	}
	return { year, month, day };
}
