#!/usr/bin/env python3
"""
Generate the QuantLib differential vector battery for shikamaru.

Runs QuantLib (the de-facto reference) over many date pairs and writes the
expected day-count fractions to test/vectors/quantlib.json. The TypeScript
differential test then asserts shikamaru matches every value exactly.

Usage:
    pip install QuantLib
    npm run vectors   (or: python scripts/generate-vectors.py)

Deterministic (seeded), so re-running is stable. Re-run whenever the supported
conventions change or QuantLib is upgraded, then commit test/vectors/quantlib.json.
"""

import json
import os
import random
from importlib.metadata import version

import QuantLib as ql

SEED = 42
PAIRS_PER_CONVENTION = 600
YEAR_MIN = 1995
YEAR_MAX = 2055
# Far-future termination so no generated end date is ever the termination date;
# this matches shikamaru's default (endIsTermination = false) for 30E/360 ISDA.
# QuantLib caps dates at year 2199.
FAR_FUTURE = ql.Date(31, 12, 2199)

CONVENTIONS = {
    "30/360": ql.Thirty360(ql.Thirty360.BondBasis),
    "30E/360": ql.Thirty360(ql.Thirty360.European),
    "30E/360 ISDA": ql.Thirty360(ql.Thirty360.ISDA, FAR_FUTURE),
    "ACT/360": ql.Actual360(),
    "ACT/365F": ql.Actual365Fixed(),
    "ACT/ACT ISDA": ql.ActualActual(ql.ActualActual.ISDA),
}


def random_date(rng):
    year = rng.randint(YEAR_MIN, YEAR_MAX)
    month = rng.randint(1, 12)
    last = ql.Date.endOfMonth(ql.Date(1, month, year)).dayOfMonth()
    # Bias toward month-ends so the 30/360 and leap edges get exercised.
    day = last if rng.random() < 0.25 else rng.randint(1, last)
    return ql.Date(day, month, year)


def iso(qd):
    return f"{qd.year():04d}-{qd.month():02d}-{qd.dayOfMonth():02d}"


def main():
    rng = random.Random(SEED)
    vectors = []
    for name, day_counter in CONVENTIONS.items():
        produced = 0
        while produced < PAIRS_PER_CONVENTION:
            start = random_date(rng)
            end = random_date(rng)
            if end <= start:
                continue
            vectors.append(
                {
                    "start": iso(start),
                    "end": iso(end),
                    "convention": name,
                    "expected": day_counter.yearFraction(start, end),
                }
            )
            produced += 1

    payload = {
        "quantlibVersion": version("QuantLib"),
        "count": len(vectors),
        "vectors": vectors,
    }
    out_dir = os.path.join(os.path.dirname(__file__), "..", "test", "vectors")
    os.makedirs(out_dir, exist_ok=True)
    out_path = os.path.join(out_dir, "quantlib.json")
    with open(out_path, "w", encoding="utf-8") as handle:
        json.dump(payload, handle)
    print(f"Wrote {len(vectors)} vectors (QuantLib {payload['quantlibVersion']}) to {out_path}")


if __name__ == "__main__":
    main()
