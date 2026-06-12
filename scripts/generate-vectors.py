#!/usr/bin/env python3
"""
Generate the QuantLib differential vector batteries for shikamaru.

Runs QuantLib (the de-facto reference) and writes expected values for the
TypeScript differential tests:

  test/vectors/quantlib.json           day-count fractions (v1 battery)
  test/vectors/quantlib-calendar.json  holiday calendars, business-day
                                       adjustment, advancing, schedules, and
                                       ACT/ACT ICMA fractions (v2 battery)

Usage:
    pip install QuantLib
    npm run vectors   (or: python scripts/generate-vectors.py)

Deterministic (seeded), so re-running is stable. Re-run whenever the supported
conventions or calendars change or QuantLib is upgraded, then commit both
vector files. The scheduled CI run regenerates against the LATEST QuantLib, so
real-world calendar changes surface as a red run (the drift watchdog).
"""

import json
import os
import random
from datetime import date as pydate
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

# Calendar id -> (QuantLib calendar, differential year range).
CALENDARS = {
    "us-federal": (ql.UnitedStates(ql.UnitedStates.Settlement), 1995, 2055),
    "nyse": (ql.UnitedStates(ql.UnitedStates.NYSE), 1995, 2055),
    "sifma-us": (ql.UnitedStates(ql.UnitedStates.GovernmentBond), 1995, 2055),
    "target": (ql.TARGET(), 2000, 2055),
    "uk": (ql.UnitedKingdom(ql.UnitedKingdom.Settlement), 1995, 2055),
}

BD_CONVENTIONS = {
    "following": ql.Following,
    "modified-following": ql.ModifiedFollowing,
    "preceding": ql.Preceding,
    "modified-preceding": ql.ModifiedPreceding,
    "unadjusted": ql.Unadjusted,
}

FREQUENCY_MONTHS = {"annual": 12, "semiannual": 6, "quarterly": 3, "monthly": 1}
GENERATION_RULES = {"backward": ql.DateGeneration.Backward, "forward": ql.DateGeneration.Forward}

ADJUSTMENT_HOLIDAY_SAMPLES = 40
ADJUSTMENT_RANDOM_SAMPLES = 20
ADVANCES_PER_CALENDAR = 80
SCHEDULES_PER_CALENDAR = 30
ICMA_CASES = 240


def random_date(rng, year_min, year_max):
    year = rng.randint(year_min, year_max)
    month = rng.randint(1, 12)
    last = ql.Date.endOfMonth(ql.Date(1, month, year)).dayOfMonth()
    # Bias toward month-ends so the 30/360 and leap edges get exercised.
    day = last if rng.random() < 0.25 else rng.randint(1, last)
    return ql.Date(day, month, year)


def iso(qd):
    return f"{qd.year():04d}-{qd.month():02d}-{qd.dayOfMonth():02d}"


def day_count_vectors(rng):
    vectors = []
    for name, day_counter in CONVENTIONS.items():
        produced = 0
        while produced < PAIRS_PER_CONVENTION:
            start = random_date(rng, YEAR_MIN, YEAR_MAX)
            end = random_date(rng, YEAR_MIN, YEAR_MAX)
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
    return vectors


def known_differences(name, year_min, year_max):
    """Dates where the PUBLISHED source disagrees with QuantLib; excluded from the
    differential on both sides, with the citation living here."""
    if name == "us-federal":
        # OPM observed Juneteenth on 2021-06-18 (P.L. 117-17 signed 2021-06-17);
        # QuantLib Settlement gates Juneteenth at 2022 (markets and the Fed stayed open).
        return ["2021-06-18"]
    if name == "sifma-us":
        # SIFMA-recommended bond-market closes QuantLib GovernmentBond omits: the
        # September 11 attacks, and Friday observance when Veterans Day is a Saturday.
        dates = ["2001-09-11", "2001-09-12"]
        for year in range(year_min, year_max + 1):
            if pydate(year, 11, 11).weekday() == 5:
                dates.append(f"{year:04d}-11-10")
        return sorted(dates)
    return []


def holiday_vectors():
    entries = []
    for name, (calendar, year_min, year_max) in CALENDARS.items():
        holidays = calendar.holidayList(ql.Date(1, 1, year_min), ql.Date(31, 12, year_max), False)
        entries.append(
            {
                "calendar": name,
                "fromYear": year_min,
                "toYear": year_max,
                "holidays": [iso(d) for d in holidays],
                "knownDifferences": known_differences(name, year_min, year_max),
            }
        )
    return entries


def near_known_difference(name, qd, year_min, year_max):
    differences = set(known_differences(name, year_min, year_max))
    return any(iso(qd + offset) in differences for offset in range(-3, 4))


def adjustment_vectors(rng):
    entries = []
    for name, (calendar, year_min, year_max) in CALENDARS.items():
        dates = []
        holidays = list(calendar.holidayList(ql.Date(1, 1, year_min), ql.Date(31, 12, year_max), False))
        for holiday in rng.sample(holidays, min(ADJUSTMENT_HOLIDAY_SAMPLES, len(holidays))):
            dates.append(holiday + rng.randint(-2, 2))
        for _ in range(ADJUSTMENT_RANDOM_SAMPLES):
            dates.append(random_date(rng, year_min, year_max))
        # Skip neighborhoods of documented source-vs-QuantLib divergences.
        dates = [d for d in dates if not near_known_difference(name, d, year_min, year_max)]
        for date in dates:
            for convention_name, convention in BD_CONVENTIONS.items():
                entries.append(
                    {
                        "calendar": name,
                        "date": iso(date),
                        "convention": convention_name,
                        "expected": iso(calendar.adjust(date, convention)),
                    }
                )
    return entries


def advance_vectors(rng):
    entries = []
    counts = [i for i in range(-10, 11) if i != 0]
    for name, (calendar, year_min, year_max) in CALENDARS.items():
        for _ in range(ADVANCES_PER_CALENDAR):
            date = random_date(rng, year_min, year_max)
            count = rng.choice(counts)
            if near_known_difference(name, date, year_min, year_max):
                continue
            entries.append(
                {
                    "calendar": name,
                    "date": iso(date),
                    "count": count,
                    "expected": iso(calendar.advance(date, count, ql.Days)),
                }
            )
    return entries


def schedule_vectors(rng):
    entries = []
    for name, (calendar, year_min, year_max) in CALENDARS.items():
        for _ in range(SCHEDULES_PER_CALENDAR):
            effective = random_date(rng, year_min, year_max - 25)
            frequency_name = rng.choice(list(FREQUENCY_MONTHS))
            months = FREQUENCY_MONTHS[frequency_name]
            period_count = rng.randint(2, 20)
            extra_days = rng.choice([0, 0, rng.randint(1, 25)])
            termination = effective + ql.Period(period_count * months, ql.Months) + ql.Period(extra_days, ql.Days)
            generation_name = rng.choice(list(GENERATION_RULES))
            anchor = termination if generation_name == "backward" else effective
            end_of_month = bool(rng.getrandbits(1)) and ql.Date.isEndOfMonth(anchor)
            # End-of-month schedules pair with modified-following (the market default);
            # other QuantLib conventions resolve month-ends differently than the rule here.
            convention_name = "modified-following" if end_of_month else rng.choice(
                ["following", "modified-following", "preceding", "unadjusted"]
            )
            termination_convention_name = rng.choice([convention_name, "unadjusted"])
            schedule = ql.Schedule(
                effective,
                termination,
                ql.Period(months, ql.Months),
                calendar,
                BD_CONVENTIONS[convention_name],
                BD_CONVENTIONS[termination_convention_name],
                GENERATION_RULES[generation_name],
                end_of_month,
            )
            entries.append(
                {
                    "calendar": name,
                    "effective": iso(effective),
                    "termination": iso(termination),
                    "frequency": frequency_name,
                    "convention": convention_name,
                    "terminationConvention": termination_convention_name,
                    "generation": generation_name,
                    "endOfMonth": end_of_month,
                    "dates": [iso(d) for d in schedule],
                }
            )
    return entries


def icma_vectors(rng):
    isma = ql.ActualActual(ql.ActualActual.ISMA)
    entries = []
    for _ in range(ICMA_CASES):
        reference_start = random_date(rng, YEAR_MIN, YEAR_MAX)
        frequency = rng.choice([1, 2, 3, 4, 6, 12])
        months = 12 // frequency
        reference_end = reference_start + ql.Period(months, ql.Months)
        span = int(reference_end - reference_start)
        kind = rng.choice(["regular", "partial", "front-stub", "cross"])
        if kind == "regular":
            start, end = reference_start, reference_end
        elif kind == "partial":
            a = rng.randint(0, span - 1)
            b = rng.randint(a + 1, span)
            start, end = reference_start + a, reference_start + b
        elif kind == "front-stub":
            start, end = reference_start + rng.randint(1, span - 1), reference_end
        else:  # cross: the period runs past the reference end into later notional periods
            next_end = reference_end + ql.Period(months, ql.Months)
            start = reference_start + rng.randint(0, span - 1)
            end = reference_end + rng.randint(1, int(next_end - reference_end))
        entries.append(
            {
                "start": iso(start),
                "end": iso(end),
                "frequency": frequency,
                "referenceStart": iso(reference_start),
                "referenceEnd": iso(reference_end),
                "expected": isma.yearFraction(start, end, reference_start, reference_end),
            }
        )
    return entries


def write_payload(out_dir, filename, payload):
    out_path = os.path.join(out_dir, filename)
    with open(out_path, "w", encoding="utf-8") as handle:
        json.dump(payload, handle)
    return out_path


def main():
    rng = random.Random(SEED)
    quantlib_version = version("QuantLib")
    out_dir = os.path.join(os.path.dirname(__file__), "..", "test", "vectors")
    os.makedirs(out_dir, exist_ok=True)

    day_counts = day_count_vectors(rng)
    path_v1 = write_payload(
        out_dir,
        "quantlib.json",
        {"quantlibVersion": quantlib_version, "count": len(day_counts), "vectors": day_counts},
    )
    print(f"Wrote {len(day_counts)} day-count vectors (QuantLib {quantlib_version}) to {path_v1}")

    calendar_payload = {
        "quantlibVersion": quantlib_version,
        "holidays": holiday_vectors(),
        "adjustments": adjustment_vectors(rng),
        "advances": advance_vectors(rng),
        "schedules": schedule_vectors(rng),
        "icma": icma_vectors(rng),
    }
    path_v2 = write_payload(out_dir, "quantlib-calendar.json", calendar_payload)
    total_holidays = sum(len(entry["holidays"]) for entry in calendar_payload["holidays"])
    print(
        f"Wrote calendar battery to {path_v2}: {total_holidays} holidays, "
        f"{len(calendar_payload['adjustments'])} adjustments, {len(calendar_payload['advances'])} advances, "
        f"{len(calendar_payload['schedules'])} schedules, {len(calendar_payload['icma'])} ICMA cases"
    )


if __name__ == "__main__":
    main()
