import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, describe, expect, it } from "vitest";
import { dayCountFraction } from "../src/index.js";
import type { DayCountConvention } from "../src/index.js";

interface Vector {
	start: string;
	end: string;
	convention: DayCountConvention;
	expected: number;
}

const here = dirname(fileURLToPath(import.meta.url));
const vectorPath = join(here, "vectors", "quantlib.json");
const hasVectors = existsSync(vectorPath);

const TOLERANCE = 1e-10;

// Tolerates both the flat array and the metadata-wrapped shape.
function load(): { vectors: Vector[]; quantlibVersion: string | null } {
	const parsed = JSON.parse(readFileSync(vectorPath, "utf8"));
	if (Array.isArray(parsed)) {
		return { vectors: parsed as Vector[], quantlibVersion: null };
	}
	return { vectors: parsed.vectors as Vector[], quantlibVersion: parsed.quantlibVersion ?? null };
}

function fmtError(value: number): string {
	return value === 0 ? "0" : value.toExponential(1);
}

describe("QuantLib differential battery", () => {
	if (!hasVectors) {
		it.skip("vectors/quantlib.json not generated yet (run: pip install QuantLib && npm run vectors)", () => {});
		return;
	}

	const { vectors, quantlibVersion } = load();
	const conventions = [...new Set(vectors.map((v) => v.convention))];
	const summary: { convention: string; count: number; maxError: number }[] = [];

	for (const convention of conventions) {
		const cases = vectors.filter((v) => v.convention === convention);
		it(`${convention}  (${cases.length} cases) match QuantLib`, () => {
			let maxError = 0;
			let worst: Vector | undefined;
			for (const v of cases) {
				const diff = Math.abs(dayCountFraction(v.start, v.end, v.convention) - v.expected);
				if (diff > maxError) {
					maxError = diff;
					worst = v;
				}
			}
			summary.push({ convention, count: cases.length, maxError });
			if (maxError > TOLERANCE && worst) {
				throw new Error(`${convention} mismatch at ${worst.start}..${worst.end}: off by ${maxError}`);
			}
			expect(maxError).toBeLessThanOrEqual(TOLERANCE);
		});
	}

	afterAll(() => {
		if (summary.length === 0) return;
		const total = summary.reduce((n, s) => n + s.count, 0);
		const clean = summary.every((s) => s.maxError <= TOLERANCE);
		const reference = quantlibVersion ? `QuantLib ${quantlibVersion}` : "QuantLib";
		const bar = "=".repeat(62);
		const rows = summary
			.slice()
			.sort((a, b) => a.convention.localeCompare(b.convention))
			.map((s) => {
				const status = s.maxError <= TOLERANCE ? "EXACT" : "FAIL";
				return `  ${s.convention.padEnd(14)} ${String(s.count).padStart(5)} cases   max err ${fmtError(s.maxError).padStart(8)}   ${status}`;
			});
		const lines = [
			"",
			bar,
			`  shikamaru  vs  ${reference}   (differential proof)`,
			bar,
			...rows,
			bar,
			clean
				? `  ${total} / ${total} cases match ${reference} within ${TOLERANCE.toExponential(0)}.  Zero drift.`
				: `  DRIFT DETECTED against ${reference}; see the FAIL rows above.`,
			bar,
			"",
		];
		console.log(lines.join("\n"));
	});
});
