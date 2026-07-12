import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  groupVerdictBuckets,
  groupVerdictText,
  headlineSummary,
} from "@/components/HeadlineVerdict";
import { compare } from "@/lib/comparisonEngine";
import { metricDefinitions } from "@/lib/metricDefinitions";
import type { NormalizedStats } from "@/types/stats";

function statsWithMetrics(
  values: Partial<NormalizedStats["metrics"]>,
): NormalizedStats {
  const metrics = Object.fromEntries(
    metricDefinitions.map((definition) => [definition.key, null]),
  ) as NormalizedStats["metrics"];

  return {
    metrics: {
      ...metrics,
      ...values,
    },
    recentResults: null,
  };
}

describe("HeadlineVerdict data", () => {
  it("summarizes group verdicts without a numeric score", () => {
    const result = compare(
      statsWithMetrics({
        avgKd: 1.2,
        kr: 0.9,
        adr: 90,
        hsPercent: 50,
        winRate: 50,
        entrySuccess: 60,
        clutch1v1: 45,
        flashSuccess: 55,
      }),
      statsWithMetrics({
        avgKd: 1,
        kr: 0.8,
        adr: 80,
        hsPercent: 40,
        winRate: 50,
        entrySuccess: 50,
        clutch1v1: 40,
        flashSuccess: 50,
      }),
    );
    const buckets = groupVerdictBuckets(result);

    expect(headlineSummary(buckets, "I-Perfect-I", "kvxk")).toBe(
      "I-Perfect-I is stronger in fragging, entry, clutch and utility; results are even.",
    );
  });

  it("formats every group verdict as words", () => {
    const result = compare(
      statsWithMetrics({
        avgKd: 1.2,
        winRate: 50,
        entrySuccess: 60,
        clutch1v1: 45,
        flashSuccess: 55,
      }),
      statsWithMetrics({
        avgKd: 1,
        winRate: 50,
        entrySuccess: 50,
        clutch1v1: 40,
        flashSuccess: 50,
      }),
    );
    const verdicts = Object.fromEntries(
      result.groups.map((group) => [
        group.group,
        groupVerdictText(group, "I-Perfect-I", "kvxk"),
      ]),
    );

    expect(verdicts).toMatchObject({
      fragging: "I-Perfect-I higher",
      results: "even",
      entry: "I-Perfect-I higher",
      clutch: "I-Perfect-I higher",
      utility: "I-Perfect-I higher",
    });
  });

  it("does not contain old scoreboard or column copy", () => {
    const source = readFileSync(
      path.join(process.cwd(), "components", "HeadlineVerdict.tsx"),
      "utf8",
    );

    expect(source).not.toContain("Where each player comes out ahead");
    expect(source).not.toContain("leads here");
    expect(source).not.toContain("smallest gaps");
    expect(source).not.toContain("Stronger for");
    expect(source).not.toContain("Closest for");
    expect(source).not.toContain("scoreLine");
    expect(source).not.toContain("You're");
    expect(source).not.toContain("You&apos;re");
  });
});

describe("metric hints", () => {
  it("do not address the reader as you or your", () => {
    for (const definition of metricDefinitions) {
      expect(definition.hint).not.toMatch(/\b(you|your)\b/i);
    }
  });
});
