// Centralized constants. No inline magic numbers or strings (project rule).

export const DAYS_PER_YEAR_360 = 360;
export const DAYS_PER_YEAR_365 = 365;
export const DAYS_PER_LEAP_YEAR = 366;

export const MONTHS_PER_YEAR = 12;

/** Strict ISO calendar date, no time component. */
export const ISO_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Coupon frequencies ACT/ACT ICMA accepts (payments per year dividing 12 evenly). */
export const ICMA_FREQUENCIES = [1, 2, 3, 4, 6, 12] as const;

/** Safety bound on the ICMA notional-period walk (100 years of monthly coupons). */
export const MAX_ICMA_NOTIONAL_PERIODS = 1200;

/** Safety bound on schedule length (100 years of monthly coupons). */
export const MAX_SCHEDULE_PERIODS = 1200;

/** Safety bound on the business-day walk (roughly 3,800 years of business days). */
export const MAX_BUSINESS_DAY_COUNT = 1_000_000;

/** Years formatDate can represent; dates outside cannot round-trip as ISO strings. */
export const MIN_FORMAT_YEAR = 0;
export const MAX_FORMAT_YEAR = 9999;

export const SERVER_NAME = "shikamaru";
export const SERVER_VERSION = "1.1.1";

/** Weekday numbers as returned by weekday(): 0 = Sunday through 6 = Saturday. */
export const SUNDAY = 0;
export const MONDAY = 1;
export const TUESDAY = 2;
export const WEDNESDAY = 3;
export const THURSDAY = 4;
export const FRIDAY = 5;
export const SATURDAY = 6;
