import { describe, expect, it } from "vitest";
import { normalizeBulkItem } from "@/lib/matchCollector";
import {
  comparePeriods,
  parsePeriodWindow,
  periodMetricDefinitions,
  periodValues,
} from "@/lib/periodMetrics";
import {
  SEASON_10_START,
  crossesSeasonStart,
  seasonStartIndex,
} from "@/lib/season";
import type { CollectedMatch } from "@/types/matches";
import { fixtureItems } from "./faceitMock";

function fixtureMatches(): CollectedMatch[] {
  return fixtureItems("mina616", "games-stats.json")
    .map(normalizeBulkItem)
    .filter((match): match is CollectedMatch => match !== null);
}

function match(overrides: Partial<CollectedMatch>): CollectedMatch {
  return {
    match_id: Math.random().toString(36),
    finished_at: "2026-11-01T00:00:00Z",
    map: "de_mirage",
    result: "W",
    kills: 20,
    deaths: 10,
    assists: 5,
    adr: 90,
    hs_percent: 50,
    rounds: 24,
    ...overrides,
  };
}

describe("periodValues", () => {
  it("computes every period metric from per-match stats", () => {
    const values = periodValues([
      match({ kills: 20, deaths: 10, assists: 0, adr: 100, result: "W" }),
      match({ kills: 10, deaths: 10, assists: 10, adr: 70, result: "L" }),
      match({ kills: 15, deaths: 0, assists: 0, adr: 40, result: "L" }),
    ]);

    expect(values.avgKd).toBeCloseTo((2 + 1 + 15) / 3);
    expect(values.kda).toBeCloseTo((2 + 2 + 15) / 3);
    expect(values.adr).toBeCloseTo(70);
    expect(values.hsPercent).toBeCloseTo(50);
    expect(values.winRate).toBeCloseTo(33.33, 1);
    expect(values.kdSpread).toBeGreaterThan(0);
    // Worst third of 3 matches = the single lowest ADR.
    expect(values.worstThirdAdr).toBe(40);
    // Only 2 losses: too few to judge play in losses.
    expect(values.lossKd).toBeNull();
  });
});

describe("periodMetricDefinitions", () => {
  it("has unique labels and no second metric named after ADR", () => {
    const labels = periodMetricDefinitions.map((definition) => definition.label);

    expect(new Set(labels).size).toBe(labels.length);
    // "ADR, ..., ADR on off days" in one list read as ADR twice.
    expect(labels.filter((label) => label.startsWith("ADR"))).toEqual(["ADR"]);
  });

  it("lists every metric exactly once in a comparison", () => {
    const result = comparePeriods(fixtureMatches(), 30);

    expect(result.metrics.map((metric) => metric.key).toSorted()).toEqual(
      periodMetricDefinitions.map((definition) => definition.key).toSorted(),
    );
  });
});

describe("comparePeriods", () => {
  it("compares the last 30 with the 30 before them through the engine", () => {
    const result = comparePeriods(fixtureMatches(), 30);

    expect(result.recentCount).toBe(30);
    expect(result.previousCount).toBe(30);
    expect(result.smallSample).toBe(false);
    expect(result.comparison.groups.map((group) => group.group)).toEqual([
      "fragging",
      "results",
      "consistency",
    ]);
    expect(
      result.improved.length +
        result.steady.length +
        result.dipped.length +
        result.uncertain.length,
    ).toBe(8);
    expect(result.chartMatches).toHaveLength(60);
    // Chart is oldest to newest.
    expect(result.chartMatches[0].finished_at! < result.chartMatches[59].finished_at!).toBe(
      true,
    );
  });

  it("supports a 50-match window", () => {
    const result = comparePeriods(fixtureMatches(), parsePeriodWindow("50"));

    expect(result.window).toBe(50);
    expect(result.recentCount).toBe(50);
    expect(result.previousCount).toBe(50);
  });

  it("calls a short history a small sample instead of a drop", () => {
    const matches = [
      ...Array.from({ length: 30 }, () => match({ kills: 30, deaths: 10 })),
      ...Array.from({ length: 8 }, () => match({ kills: 10, deaths: 10 })),
    ];

    const result = comparePeriods(matches, 30);

    expect(result.smallSample).toBe(true);
    expect(result.dipped).toEqual([]);
    expect(result.improved).toEqual([]);
    expect(result.uncertain).toHaveLength(8);
  });

  it("shows a real dip only behind the dipped list, never as an improvement", () => {
    const matches = [
      ...Array.from({ length: 30 }, (_, index) =>
        match({ kills: 10, deaths: 10, result: index % 2 ? "W" : "L" }),
      ),
      ...Array.from({ length: 30 }, (_, index) =>
        match({ kills: 20, deaths: 10, result: index % 2 ? "W" : "L" }),
      ),
    ];

    const result = comparePeriods(matches, 30);

    expect(result.dipped.map((metric) => metric.key)).toContain("avgKd");
    expect(result.improved.map((metric) => metric.key)).not.toContain("avgKd");
  });

  it("treats K/D in losses as a small sample when there are few losses", () => {
    const matches = Array.from({ length: 60 }, () => match({ result: "W" }));

    const result = comparePeriods(matches, 30);

    expect(result.uncertain.map((metric) => metric.key)).toEqual(["lossKd"]);
  });
});

describe("season 10", () => {
  it("starts on 2026-12-09", () => {
    expect(SEASON_10_START).toBe("2026-12-09");
  });

  it("finds where an oldest-to-newest series crosses the Elo reset", () => {
    const dates = [
      "2026-12-07T10:00:00Z",
      "2026-12-08T23:59:00Z",
      "2026-12-09T00:30:00Z",
      "2026-12-10T00:00:00Z",
    ];

    expect(seasonStartIndex(dates)).toBe(2);
    expect(crossesSeasonStart(dates)).toBe(true);
  });

  it("does not mark series that lie entirely on one side", () => {
    expect(seasonStartIndex(["2026-11-01T00:00:00Z", "2026-11-02T00:00:00Z"])).toBeNull();
    expect(seasonStartIndex(["2026-12-10T00:00:00Z", "2026-12-11T00:00:00Z"])).toBeNull();
  });

  it("flags period comparisons that span the reset", () => {
    const matches = Array.from({ length: 60 }, (_, index) =>
      match({
        finished_at: new Date(
          Date.UTC(2026, 11, 20) - index * 12 * 3600_000,
        ).toISOString(),
      }),
    );

    expect(comparePeriods(matches, 30).crossesSeason).toBe(true);
  });
});
