import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  columnMetrics,
  scoreGroups,
  scoreLine,
  summaryLine,
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
  it("uses weakestGroup as the hero source instead of biggestGap visibility", () => {
    const result = compare(
      statsWithMetrics({
        avgKd: 0.9,
        kr: 0.9,
        winRate: 40,
      }),
      statsWithMetrics({
        avgKd: 1,
        kr: 1,
        winRate: 80,
      }),
    );

    expect(result.weakestGroup).toEqual({
      group: "fragging",
      behindPrimaryCount: 2,
      worstMetricKey: "avgKd",
    });
  });

  it("does not contain the old You're headline text", () => {
    const source = readFileSync(
      path.join(process.cwd(), "components", "HeadlineVerdict.tsx"),
      "utf8",
    );

    expect(source).not.toContain("You're");
    expect(source).not.toContain("You&apos;re");
  });

  it("counts group verdicts for the headline score", () => {
    const result = compare(
      statsWithMetrics({
        avgKd: 0.9,
        kr: 0.9,
        winRate: 70,
        clutch1v1: 55,
      }),
      statsWithMetrics({
        avgKd: 1,
        kr: 1,
        winRate: 50,
        clutch1v1: 40,
      }),
    );

    const score = scoreGroups(result);

    expect(score.groupsA).toContain("results");
    expect(score.groupsA).toContain("clutch");
    expect(score.groupsB).toContain("fragging");
    expect(score.closeCount).toBe(2);
    expect(score.closeGroups).toHaveLength(2);
  });

  it("keeps even groups out of the large score and names them in the summary", () => {
    const result = compare(
      statsWithMetrics({
        avgKd: 0.9,
        kr: 0.9,
        adr: 80,
        hsPercent: 40,
        entrySuccess: 50,
        clutch1v1: 40,
        clutch1v2: 20,
        flashSuccess: 50,
        winRate: 50,
      }),
      statsWithMetrics({
        avgKd: 1,
        kr: 1,
        adr: 90,
        hsPercent: 45,
        entrySuccess: 55,
        clutch1v1: 45,
        clutch1v2: 25,
        flashSuccess: 55,
        winRate: 50,
      }),
    );
    const score = scoreGroups(result);

    expect(scoreLine(score.groupsA, score.groupsB, "kvxk", "I-Perfect-I")).toBe(
      "I-Perfect-I 4 \u00b7 0 kvxk",
    );
    expect(
      summaryLine(score.groupsA, score.groupsB, score.closeGroups, "kvxk", "I-Perfect-I"),
    ).toContain("results are even.");
  });

  it("does not put trailing metrics in a Stronger column", () => {
    const result = compare(
      statsWithMetrics({
        avgKd: 0.1,
        kr: 0.1,
        adr: 0.1,
        winRate: 49,
        clutch1v1: 35,
      }),
      statsWithMetrics({
        avgKd: 1,
        kr: 1,
        adr: 1,
        winRate: 50,
        clutch1v1: 40,
      }),
    );

    expect(result.weakestGroup?.group).toBe("fragging");

    const column = columnMetrics(result, "A", "Player A");

    expect(column.mode).toBe("closest");
    expect(column.heading).toBe("Player A");
    expect(column.metrics.every((metric) => metric.status === "behind")).toBe(
      true,
    );
  });

  it("fills Stronger column with real secondary advantages after primary ones", () => {
    const result = compare(
      statsWithMetrics({
        avgKd: 0.1,
        kr: 0.1,
        flashSuccess: 60,
        enemiesFlash: 2,
        utilDmgRound: 5,
      }),
      statsWithMetrics({
        avgKd: 1,
        kr: 1,
        flashSuccess: 50,
        enemiesFlash: 1,
        utilDmgRound: 1,
      }),
    );

    expect(result.weakestGroup?.group).toBe("fragging");

    const column = columnMetrics(result, "A", "Player A");
    const strongKeys = column.metrics.map((metric) => metric.key);

    expect(column.mode).toBe("stronger");
    expect(strongKeys[0]).toBe("flashSuccess");
    expect(strongKeys).toContain("enemiesFlash");
    expect(strongKeys).toContain("utilDmgRound");
    expect(column.metrics.every((metric) => metric.status === "ahead")).toBe(
      true,
    );
  });
});

describe("metric hints", () => {
  it("do not address the reader as you or your", () => {
    for (const definition of metricDefinitions) {
      expect(definition.hint).not.toMatch(/\b(you|your)\b/i);
    }
  });
});
