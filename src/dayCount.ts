// Layer 1a: day-count conventions. Each follows the ISDA 2006 definitions.

import { actualDays, addMonths, isLastDayOfMonth, isLeapYear, parseDate, toEpochDay } from "./calendar.js";
import {
	DAYS_PER_LEAP_YEAR,
	DAYS_PER_YEAR_360,
	DAYS_PER_YEAR_365,
	ICMA_FREQUENCIES,
	MAX_ICMA_NOTIONAL_PERIODS,
	MONTHS_PER_YEAR,
} from "./constants.js";
import type { CivilDate, DayCountConvention } from "./types.js";

/** Options a few conventions need beyond the two dates. */
export interface DayCountOptions {
	/** 30E/360 ISDA only: whether the end date is the instrument's maturity (termination) date. */
	endIsTermination?: boolean;
	/** ACT/ACT ICMA only: coupon payments per year (1, 2, 3, 4, 6, or 12). Required. */
	frequency?: number;
	/**
	 * ACT/ACT ICMA only: the reference (notional coupon) period, a regular period of
	 * 12/frequency months. Supply BOTH boundaries or neither (defaults to [start, end]).
	 */
	referenceStart?: string;
	/** ACT/ACT ICMA only: see referenceStart; the two must be supplied together. */
	referenceEnd?: string;
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

// ACT/ACT ICMA (ISDA 4.16(c), ICMA Rule 251). Days over frequency times the
// reference period length; periods outside the reference walk notional coupon
// periods (the stub decomposition where hand-rolled implementations go wrong).
function dcfActActICMA(s: CivilDate, e: CivilDate, options: DayCountOptions): number {
	const frequency = options.frequency;
	if (frequency === undefined || !ICMA_FREQUENCIES.includes(frequency as (typeof ICMA_FREQUENCIES)[number])) {
		throw new Error("ACT/ACT ICMA requires a coupon frequency of 1, 2, 3, 4, 6, or 12 per year.");
	}
	const hasReferenceStart = options.referenceStart !== undefined;
	const hasReferenceEnd = options.referenceEnd !== undefined;
	if (hasReferenceStart !== hasReferenceEnd) {
		throw new Error("ACT/ACT ICMA requires referenceStart and referenceEnd together, or neither.");
	}
	const startEpoch = toEpochDay(s);
	const endEpoch = toEpochDay(e);
	if (endEpoch === startEpoch) {
		return 0;
	}
	const referenceStart = hasReferenceStart ? parseDate(options.referenceStart!) : s;
	const referenceEnd = hasReferenceEnd ? parseDate(options.referenceEnd!) : e;
	if (toEpochDay(referenceEnd) <= toEpochDay(referenceStart)) {
		throw new Error("ACT/ACT ICMA reference period must have positive length.");
	}
	const months = MONTHS_PER_YEAR / frequency;
	return icmaFraction(startEpoch, endEpoch, referenceStart, referenceEnd, frequency, months);
}

// Build the notional coupon boundaries covering the accrual period, then sum each
// boundary pair's overlap over its own period length. Backward boundaries step
// iteratively from the reference start; forward boundaries stay anchored on the
// original reference end so month-end clamping never compounds (QuantLib parity).
function icmaFraction(
	startEpoch: number,
	endEpoch: number,
	referenceStart: CivilDate,
	referenceEnd: CivilDate,
	frequency: number,
	months: number,
): number {
	const boundaries: number[] = [toEpochDay(referenceStart), toEpochDay(referenceEnd)];
	let backward = referenceStart;
	let guard = 0;
	while (boundaries[0]! > startEpoch) {
		backward = addMonths(backward, -months, false);
		boundaries.unshift(toEpochDay(backward));
		if (++guard > MAX_ICMA_NOTIONAL_PERIODS) {
			throw new Error("ACT/ACT ICMA period is too far outside its reference period.");
		}
	}
	guard = 0;
	for (let step = 1; boundaries[boundaries.length - 1]! < endEpoch; step++) {
		boundaries.push(toEpochDay(addMonths(referenceEnd, step * months, false)));
		if (++guard > MAX_ICMA_NOTIONAL_PERIODS) {
			throw new Error("ACT/ACT ICMA period is too far outside its reference period.");
		}
	}
	let total = 0;
	for (let i = 0; i < boundaries.length - 1; i++) {
		const periodStart = boundaries[i]!;
		const periodEnd = boundaries[i + 1]!;
		const overlap = Math.min(endEpoch, periodEnd) - Math.max(startEpoch, periodStart);
		if (overlap > 0) {
			total += overlap / (frequency * (periodEnd - periodStart));
		}
	}
	return total;
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
	if (toEpochDay(e) < toEpochDay(s)) {
		throw new Error(`Invalid period: end ${end} is before start ${start}.`);
	}
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
		case "ACT/ACT ICMA":
			return dcfActActICMA(s, e, options);
		default: {
			const unreachable: never = convention;
			throw new Error(`Unsupported convention: ${String(unreachable)}`);
		}
	}
}
