import { describe, expect, it } from "vitest";
import {
  changeSignificance,
  classifyChange,
  compare,
} from "@/lib/comparisonEngine";
import { comparePeriods } from "@/lib/periodMetrics";
import type { CollectedMatch } from "@/types/matches";
import { readFixture } from "./fixtures";
import { normalizeStats } from "@/lib/statsNormalizer";

let nextId = 0;

function match(overrides: Partial<CollectedMatch>): CollectedMatch {
  nextId += 1;
  return {
    match_id: `m-${nextId}`,
    finished_at: new Date(Date.UTC(2026, 10, 1) - nextId * 3600_000).toISOString(),
    map: "de_mirage",
    result: "W",
    kills: 20,
    deaths: 20,
    assists: 4,
    adr: 80,
    hs_percent: 45,
    rounds: 24,
    ...overrides,
  };
}

/** Deterministic zig-zag around a centre, so the spread is large. */
function wobble(index: number, centre: number, amplitude: number) {
  const pattern = [-1, 0.6, -0.3, 1, -0.8, 0.2, 0.9, -0.5, 0.1, -0.2];
  return centre + amplitude * pattern[index % pattern.length];
}

function metric(result: ReturnType<typeof comparePeriods>, key: string) {
  return result.comparison.groups
    .flatMap((group) => group.metrics)
    .find((item) => item.key === key)!;
}

describe("classifyChange", () => {
  it("uses 2 SE and 1 SE as the boundaries", () => {
    expect(classifyChange(2.01)).toBe("significant");
    expect(classifyChange(2)).toBe("likely");
    expect(classifyChange(1)).toBe("likely");
    expect(classifyChange(0.99)).toBe("noise");
  });

  it("combines both standard errors", () => {
    // SE of the difference = sqrt(3² + 4²) = 5.
    expect(changeSignificance(12, 3, 4)).toEqual({
      changeLevel: "significant",
      changeZ: 2.4,
    });
    expect(changeSignificance(7.5, 3, 4).changeLevel).toBe("likely");
    expect(changeSignificance(4, 3, 4).changeLevel).toBe("noise");
  });

  it("is null when a side has no standard error", () => {
    expect(changeSignificance(1, null, 0.2)).toEqual({
      changeLevel: null,
      changeZ: null,
    });
  });
});

describe("change level in comparisonEngine results", () => {
  it("calls a small shift inside a wide spread noise", () => {
    // ADR swings ±30 per match; the period means differ by ~2.
    const recent = Array.from({ length: 30 }, (_, index) =>
      match({ adr: wobble(index, 82, 30) }),
    );
    const previous = Array.from({ length: 30 }, (_, index) =>
      match({ adr: wobble(index + 3, 80, 30) }),
    );

    const adr = metric(comparePeriods([...recent, ...previous], 30), "adr");

    expect(adr.diff).not.toBe(0);
    expect(adr.changeLevel).toBe("noise");
  });

  it("calls a clear shift significant", () => {
    const recent = Array.from({ length: 30 }, (_, index) =>
      match({ adr: wobble(index, 100, 8) }),
    );
    const previous = Array.from({ length: 30 }, (_, index) =>
      match({ adr: wobble(index, 75, 8) }),
    );

    const adr = metric(comparePeriods([...recent, ...previous], 30), "adr");

    expect(adr.changeLevel).toBe("significant");
    expect(adr.changeZ).toBeGreaterThan(2);
  });

  it("tests win rate as a difference of proportions", () => {
    const withWins = (wins: number) =>
      Array.from({ length: 30 }, (_, index) =>
        match({ result: index < wins ? "W" : "L" }),
      );

    // 63% vs 37% over 30 matches each: just over 2 SE.
    const big = metric(comparePeriods([...withWins(19), ...withWins(11)], 30), "winRate");
    // 53% vs 47%: well within normal swings.
    const small = metric(comparePeriods([...withWins(16), ...withWins(14)], 30), "winRate");

    expect(big.diff).toBeCloseTo(26.67, 1);
    expect(big.changeLevel).toBe("significant");
    expect(small.changeLevel).toBe("noise");
  });

  it("stays null for lifetime comparisons, which have no sample", () => {
    const stats = normalizeStats(readFixture("mina616", "stats.json"))!;
    const result = compare(stats, stats);

    expect(
      result.groups
        .flatMap((group) => group.metrics)
        .every((item) => item.changeLevel === null && item.changeZ === null),
    ).toBe(true);
  });
});
