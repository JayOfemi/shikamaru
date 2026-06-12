import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, describe, expect, it } from "vitest";
import {
	addBusinessDays,
	adjustDate,
	dayCountFraction,
	daysInMonth,
	formatDate,
	generateSchedule,
	isHoliday,
	type BusinessDayConvention,
	type CalendarId,
	type ScheduleFrequency,
} from "../src/index.js";

interface HolidayVector {
	calendar: CalendarId;
	fromYear: number;
	toYear: number;
	holidays: string[];
	/** Documented source-vs-QuantLib divergences, excluded from both sides (citations in the generator). */
	knownDifferences?: string[];
}

interface AdjustmentVector {
	calendar: CalendarId;
	date: string;
	convention: BusinessDayConvention;
	expected: string;
}

interface AdvanceVector {
	calendar: CalendarId;
	date: string;
	count: number;
	expected: string;
}

interface ScheduleVector {
	calendar: CalendarId;
	effective: string;
	termination: string;
	frequency: ScheduleFrequency;
	convention: BusinessDayConvention;
	terminationConvention: BusinessDayConvention;
	generation: "backward" | "forward";
	endOfMonth: boolean;
	dates: string[];
}

interface IcmaVector {
	start: string;
	end: string;
	frequency: number;
	referenceStart: string;
	referenceEnd: string;
	expected: number;
}

interface CalendarBattery {
	quantlibVersion: string | null;
	holidays: HolidayVector[];
	adjustments: AdjustmentVector[];
	advances: AdvanceVector[];
	schedules: ScheduleVector[];
	icma: IcmaVector[];
}

const here = dirname(fileURLToPath(import.meta.url));
const vectorPath = join(here, "vectors", "quantlib-calendar.json");
const hasVectors = existsSync(vectorPath);

const TOLERANCE = 1e-10;

function holidaysInRange(calendar: CalendarId, fromYear: number, toYear: number): string[] {
	const list: string[] = [];
	for (let year = fromYear; year <= toYear; year++) {
		for (let month = 1; month <= 12; month++) {
			for (let day = 1; day <= daysInMonth(year, month); day++) {
				const iso = formatDate({ year, month, day });
				if (isHoliday(iso, calendar)) {
					list.push(iso);
				}
			}
		}
	}
	return list;
}

describe("QuantLib calendar differential battery", () => {
	if (!hasVectors) {
		it.skip("vectors/quantlib-calendar.json not generated yet (run: pip install QuantLib && npm run vectors)", () => {});
		return;
	}

	const battery = JSON.parse(readFileSync(vectorPath, "utf8")) as CalendarBattery;
	const summary: { battery: string; count: number; mismatches: number }[] = [];

	for (const entry of battery.holidays) {
		it(`${entry.calendar} holidays ${entry.fromYear}..${entry.toYear} match QuantLib`, () => {
			const excluded = new Set(entry.knownDifferences ?? []);
			const mine = holidaysInRange(entry.calendar, entry.fromYear, entry.toYear).filter((d) => !excluded.has(d));
			const expectedDates = entry.holidays.filter((d) => !excluded.has(d));
			const mineSet = new Set(mine);
			const expectedSet = new Set(expectedDates);
			const missing = expectedDates.filter((d) => !mineSet.has(d));
			const extra = mine.filter((d) => !expectedSet.has(d));
			summary.push({ battery: `holidays:${entry.calendar}`, count: entry.holidays.length, mismatches: missing.length + extra.length });
			if (missing.length > 0 || extra.length > 0) {
				throw new Error(
					`${entry.calendar}: ${missing.length} missing (first: ${missing.slice(0, 5).join(", ")}), ` +
						`${extra.length} extra (first: ${extra.slice(0, 5).join(", ")})`,
				);
			}
		});
	}

	it(`adjustments (${battery.adjustments.length} cases) match QuantLib`, () => {
		let mismatches = 0;
		let firstError = "";
		for (const vector of battery.adjustments) {
			const actual = adjustDate(vector.date, vector.convention, vector.calendar);
			if (actual !== vector.expected) {
				mismatches++;
				if (mismatches === 1) {
					firstError = `${vector.calendar} adjust ${vector.date} ${vector.convention}: got ${actual}, QuantLib says ${vector.expected}`;
				}
			}
		}
		summary.push({ battery: "adjustments", count: battery.adjustments.length, mismatches });
		if (mismatches > 0) {
			throw new Error(`${firstError} (${mismatches} mismatched in total)`);
		}
	});

	it(`advances (${battery.advances.length} cases) match QuantLib`, () => {
		let mismatches = 0;
		let firstError = "";
		for (const vector of battery.advances) {
			const actual = addBusinessDays(vector.date, vector.count, vector.calendar);
			if (actual !== vector.expected) {
				mismatches++;
				if (mismatches === 1) {
					firstError = `${vector.calendar} advance ${vector.date} by ${vector.count}: got ${actual}, QuantLib says ${vector.expected}`;
				}
			}
		}
		summary.push({ battery: "advances", count: battery.advances.length, mismatches });
		if (mismatches > 0) {
			throw new Error(`${firstError} (${mismatches} mismatched in total)`);
		}
	});

	it(`schedules (${battery.schedules.length} cases) match QuantLib date by date`, () => {
		let mismatches = 0;
		let firstError = "";
		for (const vector of battery.schedules) {
			const periods = generateSchedule({
				effective: vector.effective,
				termination: vector.termination,
				frequency: vector.frequency,
				calendar: vector.calendar,
				convention: vector.convention,
				terminationConvention: vector.terminationConvention,
				generation: vector.generation,
				stub: "short",
				endOfMonth: vector.endOfMonth,
			});
			const dates = periods.length === 0 ? [] : [periods[0]!.start, ...periods.map((p) => p.end)];
			if (dates.length !== vector.dates.length || dates.some((d, i) => d !== vector.dates[i])) {
				mismatches++;
				if (mismatches === 1) {
					firstError =
						`${vector.calendar} schedule ${vector.effective}..${vector.termination} ${vector.frequency} ` +
						`${vector.generation}${vector.endOfMonth ? " eom" : ""} ${vector.convention}/${vector.terminationConvention}: ` +
						`got [${dates.join(", ")}], QuantLib says [${vector.dates.join(", ")}]`;
				}
			}
		}
		summary.push({ battery: "schedules", count: battery.schedules.length, mismatches });
		if (mismatches > 0) {
			throw new Error(`${firstError} (${mismatches} mismatched in total)`);
		}
	});

	it(`ACT/ACT ICMA (${battery.icma.length} cases) match QuantLib`, () => {
		let maxError = 0;
		let worst: IcmaVector | undefined;
		for (const vector of battery.icma) {
			const actual = dayCountFraction(vector.start, vector.end, "ACT/ACT ICMA", {
				frequency: vector.frequency,
				referenceStart: vector.referenceStart,
				referenceEnd: vector.referenceEnd,
			});
			const diff = Math.abs(actual - vector.expected);
			if (diff > maxError) {
				maxError = diff;
				worst = vector;
			}
		}
		summary.push({ battery: "icma", count: battery.icma.length, mismatches: maxError > TOLERANCE ? 1 : 0 });
		if (maxError > TOLERANCE && worst) {
			throw new Error(`ICMA mismatch at ${worst.start}..${worst.end} (ref ${worst.referenceStart}..${worst.referenceEnd}, f=${worst.frequency}): off by ${maxError}`);
		}
		expect(maxError).toBeLessThanOrEqual(TOLERANCE);
	});

	afterAll(() => {
		if (summary.length === 0) return;
		const reference = battery.quantlibVersion ? `QuantLib ${battery.quantlibVersion}` : "QuantLib";
		const total = summary.reduce((n, s) => n + s.count, 0);
		const clean = summary.every((s) => s.mismatches === 0);
		const bar = "=".repeat(62);
		const rows = summary.map(
			(s) => `  ${s.battery.padEnd(22)} ${String(s.count).padStart(6)} cases   ${s.mismatches === 0 ? "EXACT" : `${s.mismatches} MISMATCHED`}`,
		);
		const lines = [
			"",
			bar,
			`  shikamaru calendars  vs  ${reference}   (differential proof)`,
			bar,
			...rows,
			bar,
			`  ${total} cases vs ${reference}.  ${clean ? "Zero drift." : "DRIFT DETECTED."}`,
			bar,
			"",
		];
		console.log(lines.join("\n"));
	});
});
