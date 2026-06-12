// Layer 0: the calendar core. Timezone-free, exact integer date math.

import { ISO_DATE_PATTERN, MAX_FORMAT_YEAR, MIN_FORMAT_YEAR, MONTHS_PER_YEAR } from "./constants.js";
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
	// Math.floor IS floored division; Hinnant's y - 399 trick is only for truncating division.
	const era = Math.floor(y / 400);
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

/** Inverse of toEpochDay (Howard Hinnant's civil_from_days). */
export function fromEpochDay(epochDay: number): CivilDate {
	const z = epochDay + 719468;
	const era = Math.floor(z / 146097);
	const doe = z - era * 146097;
	const yoe = Math.floor((doe - Math.floor(doe / 1460) + Math.floor(doe / 36524) - Math.floor(doe / 146096)) / 365);
	const y = yoe + era * 400;
	const doy = doe - (365 * yoe + Math.floor(yoe / 4) - Math.floor(yoe / 100));
	const mp = Math.floor((5 * doy + 2) / 153);
	const day = doy - Math.floor((153 * mp + 2) / 5) + 1;
	const month = mp < 10 ? mp + 3 : mp - 9;
	return { year: month <= 2 ? y + 1 : y, month, day };
}

/** Day of week, 0 = Sunday through 6 = Saturday (1970-01-01 was a Thursday). */
export function weekday(date: CivilDate): number {
	const shifted = (toEpochDay(date) + 4) % 7;
	return shifted < 0 ? shifted + 7 : shifted;
}

/** Whole-month arithmetic with day clamping; month-ends stay month-ends when endOfMonth. */
export function addMonths(date: CivilDate, months: number, endOfMonth: boolean): CivilDate {
	const monthIndex = date.year * MONTHS_PER_YEAR + (date.month - 1) + months;
	const year = Math.floor(monthIndex / MONTHS_PER_YEAR);
	const month = ((monthIndex % MONTHS_PER_YEAR) + MONTHS_PER_YEAR) % MONTHS_PER_YEAR + 1;
	const last = daysInMonth(year, month);
	const day = endOfMonth ? last : Math.min(date.day, last);
	return { year, month, day };
}

/** Format a CivilDate as strict ISO "YYYY-MM-DD". Throws outside years 0000-9999. */
export function formatDate(date: CivilDate): string {
	if (date.year < MIN_FORMAT_YEAR || date.year > MAX_FORMAT_YEAR) {
		throw new Error(`Date year ${date.year} is outside the supported ISO range 0000-9999.`);
	}
	const year = String(date.year).padStart(4, "0");
	const month = String(date.month).padStart(2, "0");
	const day = String(date.day).padStart(2, "0");
	return `${year}-${month}-${day}`;
}

/** Parse and validate a strict ISO "YYYY-MM-DD" date (years 0000-9999). Throws on anything invalid. */
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
