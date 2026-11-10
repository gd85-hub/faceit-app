import { describe, expect, it } from "vitest";
import { comparePeriods } from "@/lib/periodMetrics";
import { periodVerdict } from "@/lib/periodVerdict";
import type { CollectedMatch } from "@/types/matches";

let nextId = 0;

function match(overrides: Partial<CollectedMatch>): CollectedMatch {
  nextId += 1;
  return {
    match_id: `v-${nextId}`,
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

const PATTERN = [-1, 0.6, -0.3, 1, -0.8, 0.2, 0.9, -0.5, 0.1, -0.2];

/** 30 matches with the given win count and noisy, centred personal stats. */
function period(
  wins: number,
  { kills = 20, adr = 80 }: { kills?: number; adr?: number } = {},
) {
  return Array.from({ length: 30 }, (_, index) =>
    match({
      result: index % 30 < wins ? "W" : "L",
      kills: Math.round(kills + 6 * PATTERN[index % 10]),
      adr: adr + 20 * PATTERN[(index + 4) % 10],
    }),
  );
}

describe("periodVerdict", () => {
  it("says nothing moved when every change is within normal swing", () => {
    const verdict = periodVerdict(
      comparePeriods([...period(15), ...period(14)], 30),
    );

    expect(verdict).toEqual([
      "No real shifts over these 30 matches: everything is holding steady.",
    ]);
  });

  it("names the biggest real change and calls it a real step up", () => {
    const verdict = periodVerdict(
      comparePeriods(
        [...period(15, { adr: 105 }), ...period(15, { adr: 80 })],
        30,
      ),
    );

    // A whole-distribution ADR shift also lifts ADR in the weakest matches.
    expect(verdict[0]).toMatch(/^The biggest changes?: your ADR/);
    expect(verdict[0]).toContain("your ADR went from 80 to 105");
    expect(verdict[1]).toContain("bigger than the normal ups and downs");
  });

  it("explains wins rising while personal stats stay flat", () => {
    const verdict = periodVerdict(
      comparePeriods([...period(19), ...period(11)], 30),
    );

    expect(verdict[0]).toContain("your win rate went from 37% to 63%");
    expect(verdict.at(-1)).toContain(
      "You're winning more while your own numbers stayed about the same",
    );
    expect(verdict.length).toBeLessThanOrEqual(3);
  });

  it("calls a short history a small sample, not a change", () => {
    const verdict = periodVerdict(
      comparePeriods([...period(25, { adr: 120 }), ...period(5).slice(0, 8)], 30),
    );

    expect(verdict.join(" ")).toContain("small sample");
    expect(verdict.join(" ")).not.toMatch(/went from/);
  });

  it("uses likely changes only when there is nothing significant", () => {
    // 60% vs 40% over 30 matches each is about 1.6 SE.
    const verdict = periodVerdict(
      comparePeriods([...period(18), ...period(12)], 30),
    );

    expect(verdict[0]).toBe(
      "The biggest change: your win rate went from 40% to 60%.",
    );
    expect(verdict[1]).toContain("probably a real change");
  });

  it("words a likely dip as a possible dip, not a real change", () => {
    const verdict = periodVerdict(
      comparePeriods([...period(12), ...period(18)], 30),
    );

    expect(verdict[0]).toBe(
      "The biggest change: your win rate went from 60% to 40%.",
    );
    expect(verdict[1]).toContain("might be a small dip");
  });
});
