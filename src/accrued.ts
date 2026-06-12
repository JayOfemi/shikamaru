// Simple accrued interest over a single period.

import { dayCountFraction } from "./dayCount.js";
import type { DayCountOptions } from "./dayCount.js";
import type { DayCountConvention } from "./types.js";

export interface AccruedInterestArgs {
	/** Face / principal amount. */
	notional: number;
	/** Annual coupon rate as a decimal (0.05 for 5%). */
	rate: number;
	/** Accrual start date, ISO YYYY-MM-DD. */
	start: string;
	/** Accrual end date, ISO YYYY-MM-DD. */
	end: string;
	convention: DayCountConvention;
	options?: DayCountOptions;
}

/**
 * Simple accrued interest for one flat rate between two dates:
 * notional * rate * day-count fraction. Single period; pair with the schedule
 * engine for coupon-by-coupon accrual.
 */
export function accruedInterest(args: AccruedInterestArgs): number {
	if (!Number.isFinite(args.notional)) {
		throw new Error(`Invalid notional ${args.notional}: must be a finite number.`);
	}
	if (!Number.isFinite(args.rate)) {
		throw new Error(`Invalid rate ${args.rate}: must be a finite number.`);
	}
	const fraction = dayCountFraction(args.start, args.end, args.convention, args.options);
	return args.notional * args.rate * fraction;
}
