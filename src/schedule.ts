// Layer 2: coupon/payment schedule generation. Unadjusted roll dates step in
// whole months from the anchor (the termination date for backward generation,
// the effective date for forward), so day-of-month clamping never drifts.

import { addMonths, formatDate, isLastDayOfMonth, parseDate, toEpochDay } from "./calendar.js";
import { MAX_SCHEDULE_PERIODS } from "./constants.js";
import { adjustDateCivil, type BusinessDayConvention } from "./businessDay.js";
import type { CalendarId } from "./holidays.js";
import type { CivilDate } from "./types.js";

/** Supported schedule frequencies. */
export const SCHEDULE_FREQUENCIES = ["annual", "semiannual", "quarterly", "monthly"] as const;

export type ScheduleFrequency = (typeof SCHEDULE_FREQUENCIES)[number];

const MONTHS_PER_PERIOD: Record<ScheduleFrequency, number> = {
	annual: 12,
	semiannual: 6,
	quarterly: 3,
	monthly: 1,
};

/** Coupons per year for each frequency (the ICMA day-count frequency). */
export const COUPONS_PER_YEAR: Record<ScheduleFrequency, number> = {
	annual: 1,
	semiannual: 2,
	quarterly: 4,
	monthly: 12,
};

export interface ScheduleArgs {
	/** Accrual start of the whole schedule, ISO YYYY-MM-DD. */
	effective: string;
	/** Final maturity date, ISO YYYY-MM-DD. Must be after effective. */
	termination: string;
	frequency: ScheduleFrequency;
	calendar: CalendarId;
	/** Adjustment for every date except termination. Default "modified-following". */
	convention?: BusinessDayConvention;
	/** Adjustment for the termination date. Default: same as convention. */
	terminationConvention?: BusinessDayConvention;
	/** Roll direction. Backward (from termination) puts any stub in front. Default "backward". */
	generation?: "backward" | "forward";
	/** Stub handling: keep the short stub, or merge it into its neighbor. Default "short". */
	stub?: "short" | "long";
	/** When true and the anchor date is a month-end, every roll date is a month-end. */
	endOfMonth?: boolean;
}

export interface SchedulePeriod {
	unadjustedStart: string;
	unadjustedEnd: string;
	/** Business-day-adjusted accrual start. */
	start: string;
	/** Business-day-adjusted accrual end. */
	end: string;
}

/**
 * Generate the accrual periods between effective and termination. Roll dates
 * step in whole months from the anchor; an off-cycle remainder becomes a short
 * stub (front for backward generation, back for forward), or merges into the
 * neighboring period when stub is "long".
 */
export function generateSchedule(args: ScheduleArgs): SchedulePeriod[] {
	const effective = parseDate(args.effective);
	const termination = parseDate(args.termination);
	if (toEpochDay(termination) <= toEpochDay(effective)) {
		throw new Error(`Invalid schedule: termination ${args.termination} must be after effective ${args.effective}.`);
	}
	const months = MONTHS_PER_PERIOD[args.frequency];
	const convention = args.convention ?? "modified-following";
	const terminationConvention = args.terminationConvention ?? convention;
	const generation = args.generation ?? "backward";
	const stub = args.stub ?? "short";
	const anchor = generation === "backward" ? termination : effective;
	const endOfMonth = (args.endOfMonth ?? false) && isLastDayOfMonth(anchor);

	const unadjusted = generation === "backward"
		? rollBackward(effective, termination, months, endOfMonth, stub)
		: rollForward(effective, termination, months, endOfMonth, stub);

	const terminationIndex = unadjusted.length - 1;
	const adjusted = unadjusted.map((date, index) =>
		adjustDateCivil(date, index === terminationIndex ? terminationConvention : convention, args.calendar),
	);

	// Mirror QuantLib Schedule's final safety check: a next-to-last roll that
	// adjusts onto or past the adjusted termination collapses into the prior period.
	while (adjusted.length >= 2 && toEpochDay(adjusted[adjusted.length - 2]!) >= toEpochDay(adjusted[adjusted.length - 1]!)) {
		unadjusted.splice(unadjusted.length - 2, 1);
		adjusted.splice(adjusted.length - 2, 1);
	}

	const periods: SchedulePeriod[] = [];
	for (let i = 0; i < adjusted.length - 1; i++) {
		// Two rolls adjusting onto the same business day would form an empty period; skip it.
		if (toEpochDay(adjusted[i]!) === toEpochDay(adjusted[i + 1]!)) {
			continue;
		}
		periods.push({
			unadjustedStart: formatDate(unadjusted[i]!),
			unadjustedEnd: formatDate(unadjusted[i + 1]!),
			start: formatDate(adjusted[i]!),
			end: formatDate(adjusted[i + 1]!),
		});
	}
	return periods;
}

function rollBackward(effective: CivilDate, termination: CivilDate, months: number, endOfMonth: boolean, stub: "short" | "long"): CivilDate[] {
	const effectiveEpoch = toEpochDay(effective);
	const rolls: CivilDate[] = [];
	let hasStub = false;
	for (let i = 0; ; i++) {
		const roll = addMonths(termination, -i * months, endOfMonth);
		const epoch = toEpochDay(roll);
		if (epoch <= effectiveEpoch) {
			hasStub = epoch < effectiveEpoch;
			break;
		}
		rolls.push(roll);
		if (rolls.length > MAX_SCHEDULE_PERIODS) {
			throw new Error(`Schedule exceeds ${MAX_SCHEDULE_PERIODS} periods; shorten the span or lower the frequency.`);
		}
	}
	rolls.reverse();
	if (stub === "long" && hasStub && rolls.length >= 2) {
		rolls.shift();
	}
	return [effective, ...rolls];
}

function rollForward(effective: CivilDate, termination: CivilDate, months: number, endOfMonth: boolean, stub: "short" | "long"): CivilDate[] {
	const terminationEpoch = toEpochDay(termination);
	const rolls: CivilDate[] = [];
	let hasStub = false;
	for (let i = 0; ; i++) {
		const roll = addMonths(effective, i * months, endOfMonth);
		const epoch = toEpochDay(roll);
		if (epoch >= terminationEpoch) {
			hasStub = epoch > terminationEpoch;
			break;
		}
		rolls.push(roll);
		if (rolls.length > MAX_SCHEDULE_PERIODS) {
			throw new Error(`Schedule exceeds ${MAX_SCHEDULE_PERIODS} periods; shorten the span or lower the frequency.`);
		}
	}
	if (stub === "long" && hasStub && rolls.length >= 2) {
		rolls.pop();
	}
	return [...rolls, termination];
}
