// Centralized constants. No inline magic numbers or strings (project rule).

export const DAYS_PER_YEAR_360 = 360;
export const DAYS_PER_YEAR_365 = 365;
export const DAYS_PER_LEAP_YEAR = 366;

export const MONTHS_PER_YEAR = 12;

/** Strict ISO calendar date, no time component. */
export const ISO_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

export const SERVER_NAME = "shikamaru";
export const SERVER_VERSION = "0.1.0";
