// Layer 1b: business-day predicates, adjustment conventions, and date advancing
// over the holiday calendars. Public functions speak strict ISO date strings.

import { formatDate, fromEpochDay, parseDate, toEpochDay, weekday } from "./calendar.js";
import { MAX_BUSINESS_DAY_COUNT, SATURDAY, SUNDAY } from "./constants.js";
import { isHolidayDate, type CalendarId } from "./holidays.js";
import type { CivilDate } from "./types.js";

/** Supported business-day adjustment conventions (ISDA 2006 section 4.12 naming). */
export const BUSINESS_DAY_CONVENTIONS = [
	"following",
	"modified-following",
	"preceding",
	"modified-preceding",
	"unadjusted",
] as const;

export type BusinessDayConvention = (typeof BUSINESS_DAY_CONVENTIONS)[number];

/** True when the date falls on a Saturday or Sunday. */
export function isWeekend(date: string): boolean {
	const w = weekday(parseDate(date));
	return w === SATURDAY || w === SUNDAY;
}

/** True when the date is a weekday holiday closure under the calendar. */
export function isHoliday(date: string, calendar: CalendarId): boolean {
	return isHolidayDate(parseDate(date), calendar);
}

/** True when the date is neither a weekend nor a holiday under the calendar. */
export function isBusinessDay(date: string, calendar: CalendarId): boolean {
	return isBusinessDate(parseDate(date), calendar);
}

/** The first business day strictly after the date. */
export function nextBusinessDay(date: string, calendar: CalendarId): string {
	return formatDate(fromEpochDay(stepToBusinessDay(toEpochDay(parseDate(date)), calendar, 1)));
}

/** The last business day strictly before the date. */
export function previousBusinessDay(date: string, calendar: CalendarId): string {
	return formatDate(fromEpochDay(stepToBusinessDay(toEpochDay(parseDate(date)), calendar, -1)));
}

/** Adjust a date to a business day per the convention. Business days pass through unchanged. */
export function adjustDate(date: string, convention: BusinessDayConvention, calendar: CalendarId): string {
	return formatDate(adjustDateCivil(parseDate(date), convention, calendar));
}

/**
 * Move a signed number of business days (T+N settlement math). Zero returns the
 * date unchanged, even when it is not itself a business day.
 */
export function addBusinessDays(date: string, count: number, calendar: CalendarId): string {
	if (!Number.isInteger(count)) {
		throw new Error(`Invalid business-day count ${count}: must be an integer.`);
	}
	if (Math.abs(count) > MAX_BUSINESS_DAY_COUNT) {
		throw new Error(`Invalid business-day count ${count}: magnitude must be at most ${MAX_BUSINESS_DAY_COUNT}.`);
	}
	let epoch = toEpochDay(parseDate(date));
	const step = count >= 0 ? 1 : -1;
	for (let moved = 0; moved < Math.abs(count); moved++) {
		epoch = stepToBusinessDay(epoch, calendar, step);
	}
	return formatDate(fromEpochDay(epoch));
}

/** CivilDate-level core shared with the schedule engine. */
export function isBusinessDate(date: CivilDate, calendar: CalendarId): boolean {
	const w = weekday(date);
	return w !== SATURDAY && w !== SUNDAY && !isHolidayDate(date, calendar);
}

/** CivilDate-level adjustment shared with the schedule engine. */
export function adjustDateCivil(date: CivilDate, convention: BusinessDayConvention, calendar: CalendarId): CivilDate {
	if (convention === "unadjusted" || isBusinessDate(date, calendar)) {
		return date;
	}
	const epoch = toEpochDay(date);
	switch (convention) {
		case "following":
			return fromEpochDay(stepToBusinessDay(epoch, calendar, 1));
		case "preceding":
			return fromEpochDay(stepToBusinessDay(epoch, calendar, -1));
		case "modified-following": {
			const candidate = fromEpochDay(stepToBusinessDay(epoch, calendar, 1));
			return candidate.year === date.year && candidate.month === date.month
				? candidate
				: fromEpochDay(stepToBusinessDay(epoch, calendar, -1));
		}
		case "modified-preceding": {
			const candidate = fromEpochDay(stepToBusinessDay(epoch, calendar, -1));
			return candidate.year === date.year && candidate.month === date.month
				? candidate
				: fromEpochDay(stepToBusinessDay(epoch, calendar, 1));
		}
		default: {
			const unreachable: never = convention;
			throw new Error(`Unsupported convention: ${String(unreachable)}`);
		}
	}
}

function stepToBusinessDay(epoch: number, calendar: CalendarId, step: 1 | -1): number {
	let cursor = epoch + step;
	while (!isBusinessDate(fromEpochDay(cursor), calendar)) {
		cursor += step;
	}
	return cursor;
}
