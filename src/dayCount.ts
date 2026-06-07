// Layer 1a: day-count conventions. Each follows the ISDA 2006 definitions.

import { actualDays, isLastDayOfMonth, isLeapYear, parseDate } from "./calendar.js";
import { DAYS_PER_LEAP_YEAR, DAYS_PER_YEAR_360, DAYS_PER_YEAR_365 } from "./constants.js";
import type { CivilDate, DayCountConvention } from "./types.js";

/** Options a few conventions need beyond the two dates. */
export interface DayCountOptions {
	/** 30E/360 ISDA only: whether the end date is the instrument's maturity (termination) date. */
	endIsTermination?: boolean;
}

// Shared numerator for the 30/360 family: 360*(y2-y1) + 30*(m2-m1) + (d2-d1).
function thirty360Days(s: CivilDate, e: CivilDate, d1: number, d2: number): number {
	return DAYS_PER_YEAR_360 * (e.year - s.year) + 30 * (e.month - s.month) + (d2 - d1);
}

// 30/360 Bond Basis (ISDA 4.16(f)).
function dcf30360(s: CivilDate, e: CivilDate): number {
	const d1 = s.day === 31 ? 30 : s.day;
	const d2 = e.day === 31 && d1 === 30 ? 30 : e.day;
	return thirty360Days(s, e, d1, d2) / DAYS_PER_YEAR_360;
}

// 30E/360 Eurobond Basis (ISDA 4.16(g)).
function dcf30E360(s: CivilDate, e: CivilDate): number {
	const d1 = s.day === 31 ? 30 : s.day;
	const d2 = e.day === 31 ? 30 : e.day;
	return thirty360Days(s, e, d1, d2) / DAYS_PER_YEAR_360;
}

// 30E/360 ISDA (ISDA 4.16(h)). End-of-month maps to 30, except the end date in
// February when it is the maturity date.
function dcf30E360ISDA(s: CivilDate, e: CivilDate, endIsTermination: boolean): number {
	const d1 = isLastDayOfMonth(s) ? 30 : s.day;
	const endIsFebTermination = endIsTermination && e.month === 2;
	const d2 = isLastDayOfMonth(e) && !endIsFebTermination ? 30 : e.day;
	return thirty360Days(s, e, d1, d2) / DAYS_PER_YEAR_360;
}

// ACT/360 (ISDA 4.16(e)).
function dcfAct360(s: CivilDate, e: CivilDate): number {
	return actualDays(s, e) / DAYS_PER_YEAR_360;
}

// ACT/365 Fixed (ISDA 4.16(d)).
function dcfAct365F(s: CivilDate, e: CivilDate): number {
	return actualDays(s, e) / DAYS_PER_YEAR_365;
}

// ACT/ACT ISDA (ISDA 4.16(b)). Split the period at calendar-year boundaries and
// weight each part by that year's actual length.
function dcfActActISDA(s: CivilDate, e: CivilDate): number {
	const denom = (year: number): number => (isLeapYear(year) ? DAYS_PER_LEAP_YEAR : DAYS_PER_YEAR_365);
	if (s.year === e.year) {
		return actualDays(s, e) / denom(s.year);
	}
	const firstYearEnd: CivilDate = { year: s.year + 1, month: 1, day: 1 };
	const lastYearStart: CivilDate = { year: e.year, month: 1, day: 1 };
	const firstPart = actualDays(s, firstYearEnd) / denom(s.year);
	const lastPart = actualDays(lastYearStart, e) / denom(e.year);
	const wholeYears = e.year - s.year - 1;
	return firstPart + lastPart + wholeYears;
}

/**
 * The day-count fraction between two dates under the given convention.
 * Multiplying this by an annual rate gives the accrued portion for the period.
 */
export function dayCountFraction(
	start: string,
	end: string,
	convention: DayCountConvention,
	options: DayCountOptions = {},
): number {
	const s = parseDate(start);
	const e = parseDate(end);
	switch (convention) {
		case "30/360":
			return dcf30360(s, e);
		case "30E/360":
			return dcf30E360(s, e);
		case "30E/360 ISDA":
			return dcf30E360ISDA(s, e, options.endIsTermination ?? false);
		case "ACT/360":
			return dcfAct360(s, e);
		case "ACT/365F":
			return dcfAct365F(s, e);
		case "ACT/ACT ISDA":
			return dcfActActISDA(s, e);
		default: {
			const unreachable: never = convention;
			throw new Error(`Unsupported convention: ${String(unreachable)}`);
		}
	}
}
