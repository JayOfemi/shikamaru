// Public types for shikamaru.

/** Supported day-count conventions, by their standard market names (ISDA 2006). */
export const DAY_COUNT_CONVENTIONS = [
	"30/360",
	"30E/360",
	"30E/360 ISDA",
	"ACT/360",
	"ACT/365F",
	"ACT/ACT ISDA",
] as const;

export type DayCountConvention = (typeof DAY_COUNT_CONVENTIONS)[number];

/** A calendar date with no time or timezone component. */
export interface CivilDate {
	year: number;
	/** 1-12. */
	month: number;
	/** 1-31, valid for the month. */
	day: number;
}
