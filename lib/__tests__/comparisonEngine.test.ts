import { describe, expect, it } from "vitest";
import { readFixture, type FixturePlayer } from "./fixtures";
import { compare } from "@/lib/comparisonEngine";
import { metricDefinitions } from "@/lib/metricDefinitions";
import { normalizeStats } from "@/lib/statsNormalizer";
import type { NormalizedStats } from "@/types/stats";

function readStats(player: FixturePlayer) {
  return readFixture(player, "stats.json");
}

function statsWithMetricValues(value: number): NormalizedStats {
  const metrics = Object.fromEntries(
    metricDefinitions.map((definition) => [definition.key, value]),
  ) as NormalizedStats["metrics"];

  return {
    metrics,
    recentResults: null,
  };
}

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

describe("compare", () => {
  it("includes metric direction from metricDefinitions", () => {
    const mina = normalizeStats(readStats("mina616"));
    const perfect = normalizeStats(readStats("opponent-a"));
    const result = compare(mina!, perfect!);
    const currentWin = result.groups
      .flatMap((group) => group.metrics)
      .find((metric) => metric.key === "currentWin");

    expect(currentWin?.direction).toBe("neutral");
    expect(
      metricDefinitions.find((definition) => definition.key === "currentWin")
        ?.direction,
    ).toBe("neutral");
  });

  it("does not count neutral metrics as comparable", () => {
    const mina = normalizeStats(readStats("mina616"));
    const perfect = normalizeStats(readStats("opponent-a"));
    const result = compare(mina!, perfect!);
    const resultsGroup = result.groups.find((group) => group.group === "results");

    expect(resultsGroup?.metrics.filter((metric) => metric.direction === "neutral"))
      .toHaveLength(3);
    expect(resultsGroup?.metrics.filter((metric) => metric.status === "neutral"))
      .toHaveLength(3);
    expect(resultsGroup?.comparable).toBe(1);
  });

  it("keeps null values as unknown comparisons", () => {
    const left = normalizeStats({ lifetime: {} });
    const right = normalizeStats(readStats("mina616"));
    const result = compare(left!, right!);

    expect(
      result.groups
        .flatMap((group) => group.metrics)
        .filter((metric) => metric.direction !== "neutral")
        .every((metric) => metric.status === "unknown"),
    ).toBe(true);
  });

  it("marks small percent differences as even", () => {
    const mina = normalizeStats(readStats("mina616"));
    const perfect = normalizeStats(readStats("opponent-a"));
    const result = compare(mina!, perfect!);
    const utilityDamage = result.groups
      .flatMap((group) => group.metrics)
      .find((metric) => metric.key === "utilDmgRound");

    expect(utilityDamage?.diffPercent).toBeCloseTo(-0.274, 3);
    expect(utilityDamage?.status).toBe("even");
  });

  it("uses diff sign when diffPercent is null", () => {
    const left = normalizeStats({
      lifetime: {
        ADR: "1",
      },
    });
    const right = normalizeStats({
      lifetime: {
        ADR: "0",
      },
    });
    const result = compare(left!, right!);
    const adr = result.groups
      .flatMap((group) => group.metrics)
      .find((metric) => metric.key === "adr");

    expect(adr?.diffPercent).toBeNull();
    expect(adr?.status).toBe("ahead");
  });

  it("returns null biggestGap when all comparable metrics are ahead", () => {
    const result = compare(statsWithMetricValues(10), statsWithMetricValues(1));

    expect(result.biggestGap).toBeNull();
  });

  it("chooses a behind metric over a larger ahead metric for biggestGap", () => {
    const left = normalizeStats(readStats("mina616"));
    const right = normalizeStats(readStats("opponent-a"));
    const result = compare(left!, right!);

    expect(result.biggestGap?.metric.key).not.toBe("enemiesFlash");
    expect(result.biggestGap?.metric.status).toBe("behind");
  });

  it("does not choose a secondary metric as biggestGap even when its percent diff is larger", () => {
    const left = statsWithMetrics({
      avgKd: 90,
      enemiesFlash: 1,
    });
    const right = statsWithMetrics({
      avgKd: 100,
      enemiesFlash: 10,
    });
    const result = compare(left, right);

    expect(result.biggestGap?.metricKey).toBe("avgKd");
  });

  it("does not choose enemiesFlash for donk666-like versus sh1ro-like stats", () => {
    const donkLike = statsWithMetrics({
      winRate: 61,
      enemiesFlash: 0.31,
    });
    const sh1roLike = statsWithMetrics({
      winRate: 68,
      enemiesFlash: 0.36,
    });
    const result = compare(donkLike, sh1roLike);

    expect(result.biggestGap?.metricKey).not.toBe("enemiesFlash");
  });

  it("selects weakestGroup by the number of primary behind metrics", () => {
    const left = statsWithMetrics({
      avgKd: 0.9,
      kr: 0.9,
      winRate: 40,
    });
    const right = statsWithMetrics({
      avgKd: 1,
      kr: 1,
      winRate: 80,
    });
    const result = compare(left, right);

    expect(result.weakestGroup).toEqual({
      group: "fragging",
      behindPrimaryCount: 2,
      worstMetricKey: "avgKd",
    });
  });

  it("breaks weakestGroup ties by the worst primary behind diffPercent", () => {
    const left = statsWithMetrics({
      avgKd: 90,
      kr: 100,
      clutch1v1: 80,
      clutch1v2: 100,
    });
    const right = statsWithMetrics({
      avgKd: 100,
      kr: 100,
      clutch1v1: 100,
      clutch1v2: 100,
    });
    const result = compare(left, right);

    expect(result.weakestGroup).toEqual({
      group: "clutch",
      behindPrimaryCount: 1,
      worstMetricKey: "clutch1v1",
    });
  });

  it("never selects an A_stronger group as weakestGroup", () => {
    const left = statsWithMetrics({
      avgKd: 1,
      kr: 10,
      adr: 10,
      hsPercent: 10,
      clutch1v1: 40,
      clutch1v2: 40,
    });
    const right = statsWithMetrics({
      avgKd: 100,
      kr: 1,
      adr: 1,
      hsPercent: 1,
      clutch1v1: 50,
      clutch1v2: 50,
    });
    const result = compare(left, right);

    expect(result.groups.find((group) => group.group === "fragging")?.verdict).toBe(
      "A_stronger",
    );
    expect(result.weakestGroup?.group).toBe("clutch");
  });

  it("does not select close groups as weakestGroup", () => {
    const left = statsWithMetrics({
      clutch1v1: 1,
      clutch1v2: 10,
      entryRate: 10,
      entrySuccess: 40,
    });
    const right = statsWithMetrics({
      clutch1v1: 100,
      clutch1v2: 1,
      entryRate: 20,
      entrySuccess: 50,
    });
    const result = compare(left, right);

    expect(result.groups.find((group) => group.group === "clutch")?.verdict).toBe(
      "close",
    );
    expect(result.weakestGroup?.group).toBe("entry");
  });

  it("returns null weakestGroup when all groups are A_stronger or close", () => {
    const result = compare(statsWithMetricValues(10), statsWithMetricValues(1));

    expect(result.weakestGroup).toBeNull();
  });

  it("counts netDeficit only from primary metrics", () => {
    const left = statsWithMetrics({
      entryRate: 10,
      entrySuccess: 40,
      flashSuccess: 60,
      enemiesFlash: 0.1,
      utilDmgRound: 1,
    });
    const right = statsWithMetrics({
      entryRate: 20,
      entrySuccess: 50,
      flashSuccess: 50,
      enemiesFlash: 1,
      utilDmgRound: 10,
    });
    const result = compare(left, right);

    expect(result.groups.find((group) => group.group === "utility")?.verdict).toBe(
      "B_stronger",
    );
    expect(result.weakestGroup).toEqual({
      group: "entry",
      behindPrimaryCount: 1,
      worstMetricKey: "entrySuccess",
    });
  });

  it("does not select a group with comparable equal to one as weakestGroup", () => {
    const left = statsWithMetrics({
      winRate: 40,
    });
    const right = statsWithMetrics({
      winRate: 50,
    });
    const result = compare(left, right);

    expect(result.groups.find((group) => group.group === "results")?.comparable).toBe(
      1,
    );
    expect(result.weakestGroup).toBeNull();
  });

  it("returns fragging as weakestGroup for mina616 versus opponent-a samples", () => {
    const mina = normalizeStats(readStats("mina616"));
    const perfect = normalizeStats(readStats("opponent-a"));
    const result = compare(mina!, perfect!);

    expect(result.weakestGroup?.group).toBe("fragging");
  });

  it("does not include two summary lines for the same biggestGap and closest group", () => {
    const donkLike = statsWithMetrics({
      avgKd: 0.8,
      kr: 1.1,
      adr: 100,
      winRate: 61,
    });
    const sh1roLike = statsWithMetrics({
      avgKd: 1,
      kr: 1,
      adr: 100,
      winRate: 68,
    });
    const result = compare(donkLike, sh1roLike, {
      nicknameA: "donk666",
      nicknameB: "sh1ro",
    });
    const fraggingLines = result.summary.filter((line) =>
      line.includes("fragging"),
    );

    expect(result.biggestGap?.group).toBe("fragging");
    expect(result.closest?.group).toBe("fragging");
    expect(fraggingLines).toHaveLength(1);
    expect(result.summary).toHaveLength(3);
  });

  it("uses spec verdicts and closest only from close groups", () => {
    const mina = normalizeStats(readStats("mina616"));
    const perfect = normalizeStats(readStats("opponent-a"));
    const result = compare(mina!, perfect!);

    expect(result.groups.map((group) => group.verdict)).not.toContain("behind");
    expect(result.groups.map((group) => group.verdict)).not.toContain("mixed");
    expect(result.groups.find((group) => group.group === "utility")?.verdict).toBe(
      "A_stronger",
    );
    expect(result.closest).toBeNull();
    expect(result.groups.every((group) => group.verdict !== "close")).toBe(true);
  });

  it("returns B_stronger in fragging for mina616 versus opponent-a samples", () => {
    const mina = normalizeStats(readStats("mina616"));
    const perfect = normalizeStats(readStats("opponent-a"));
    const fragging = compare(mina!, perfect!).groups.find(
      (group) => group.group === "fragging",
    );

    expect(fragging?.aheadCount).toBe(0);
    expect(fragging?.behindCount).toBe(4);
    expect(fragging?.verdict).toBe("B_stronger");
  });

  it("uses player nicknames in summary text", () => {
    const mina = normalizeStats(readStats("mina616"));
    const perfect = normalizeStats(readStats("opponent-a"));
    const result = compare(mina!, perfect!, {
      nicknameA: "mina616",
      nicknameB: "opponent-a",
    });

    expect(result.summary.join("\n")).toContain("opponent-a is stronger");
    expect(result.summary.join("\n")).not.toContain("Player A");
    expect(result.summary.join("\n")).not.toContain("Player B");
  });

  it("uses nicknameA in summary when player A has the stronger group", () => {
    const result = compare(statsWithMetricValues(10), statsWithMetricValues(1), {
      nicknameA: "mina616",
      nicknameB: "opponent-a",
    });

    expect(result.summary.join("\n")).toContain("mina616 is stronger");
    expect(result.summary.join("\n")).not.toContain("Player A");
    expect(result.summary.join("\n")).not.toContain("Player B");
  });

  it("returns close for ahead=1 and behind=1", () => {
    const left = statsWithMetrics({
      avgKd: 2,
      kr: 1,
    });
    const right = statsWithMetrics({
      avgKd: 1,
      kr: 2,
    });
    const fragging = compare(left, right).groups.find(
      (group) => group.group === "fragging",
    );

    expect(fragging?.aheadCount).toBe(1);
    expect(fragging?.behindCount).toBe(1);
    expect(fragging?.verdict).toBe("close");
  });

  it("returns A_stronger for ahead=3 and behind=1", () => {
    const left = statsWithMetrics({
      avgKd: 2,
      kr: 2,
      adr: 2,
      hsPercent: 1,
    });
    const right = statsWithMetrics({
      avgKd: 1,
      kr: 1,
      adr: 1,
      hsPercent: 2,
    });
    const fragging = compare(left, right).groups.find(
      (group) => group.group === "fragging",
    );

    expect(fragging?.aheadCount).toBe(3);
    expect(fragging?.behindCount).toBe(1);
    expect(fragging?.verdict).toBe("A_stronger");
  });

  it("returns A_stronger for ahead=2 and behind=1", () => {
    const left = statsWithMetrics({
      avgKd: 2,
      kr: 2,
      adr: 1,
    });
    const right = statsWithMetrics({
      avgKd: 1,
      kr: 1,
      adr: 2,
    });
    const fragging = compare(left, right).groups.find(
      (group) => group.group === "fragging",
    );

    expect(fragging?.aheadCount).toBe(2);
    expect(fragging?.behindCount).toBe(1);
    expect(fragging?.verdict).toBe("A_stronger");
  });

  it("returns A_stronger for ahead=2, behind=0, even=1", () => {
    const left = statsWithMetrics({
      avgKd: 2,
      kr: 2,
      adr: 10,
    });
    const right = statsWithMetrics({
      avgKd: 1,
      kr: 1,
      adr: 10,
    });
    const fragging = compare(left, right).groups.find(
      (group) => group.group === "fragging",
    );

    expect(fragging?.aheadCount).toBe(2);
    expect(fragging?.behindCount).toBe(0);
    expect(fragging?.evenCount).toBe(1);
    expect(fragging?.comparable).toBe(3);
    expect(fragging?.verdict).toBe("A_stronger");
  });

  it("returns close for ahead=0, behind=0, even=2", () => {
    const left = statsWithMetrics({
      avgKd: 1,
      kr: 1,
    });
    const right = statsWithMetrics({
      avgKd: 1,
      kr: 1,
    });
    const fragging = compare(left, right).groups.find(
      (group) => group.group === "fragging",
    );

    expect(fragging?.aheadCount).toBe(0);
    expect(fragging?.behindCount).toBe(0);
    expect(fragging?.evenCount).toBe(2);
    expect(fragging?.comparable).toBe(2);
    expect(fragging?.verdict).toBe("close");
  });

  it("returns insufficient when only neutral metrics are present", () => {
    const left = statsWithMetrics({
      matches: 10,
      longestWin: 5,
      currentWin: 1,
    });
    const right = statsWithMetrics({
      matches: 1,
      longestWin: 1,
      currentWin: 0,
    });
    const results = compare(left, right).groups.find(
      (group) => group.group === "results",
    );

    expect(results?.aheadCount).toBe(0);
    expect(results?.behindCount).toBe(0);
    expect(results?.evenCount).toBe(0);
    expect(results?.comparable).toBe(0);
    expect(results?.verdict).toBe("insufficient");
  });
});
