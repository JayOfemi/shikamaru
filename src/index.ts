// Public API for the shikamaru library.

export { DAY_COUNT_CONVENTIONS } from "./types.js";
export type { CivilDate, DayCountConvention } from "./types.js";

export { dayCountFraction } from "./dayCount.js";
export type { DayCountOptions } from "./dayCount.js";

export { accruedInterest } from "./accrued.js";
export type { AccruedInterestArgs } from "./accrued.js";

export {
	actualDays,
	addMonths,
	daysInMonth,
	formatDate,
	fromEpochDay,
	isLastDayOfMonth,
	isLeapYear,
	parseDate,
	toEpochDay,
	weekday,
} from "./calendar.js";

export { easterSunday } from "./easter.js";

export { CALENDARS, CALENDAR_DESCRIPTIONS } from "./holidays.js";
export type { CalendarId } from "./holidays.js";

export {
	BUSINESS_DAY_CONVENTIONS,
	addBusinessDays,
	adjustDate,
	isBusinessDay,
	isHoliday,
	isWeekend,
	nextBusinessDay,
	previousBusinessDay,
} from "./businessDay.js";
export type { BusinessDayConvention } from "./businessDay.js";

export { COUPONS_PER_YEAR, SCHEDULE_FREQUENCIES, generateSchedule } from "./schedule.js";
export type { ScheduleArgs, ScheduleFrequency, SchedulePeriod } from "./schedule.js";
