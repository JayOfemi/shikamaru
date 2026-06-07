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
 * notional * rate * day-count fraction. Compounding and full coupon schedules
 * arrive with the v2 schedule engine.
 */
export function accruedInterest(args: AccruedInterestArgs): number {
	const fraction = dayCountFraction(args.start, args.end, args.convention, args.options);
	return args.notional * args.rate * fraction;
}
