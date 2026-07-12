import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { metricDefinitions } from "@/lib/metricDefinitions";
import { normalizeProfile } from "@/lib/playerNormalizer";
import { normalizeStats } from "@/lib/statsNormalizer";
import type { SourceMetricDefinition } from "@/types/metrics";

function readSample<T>(nickname: string, fileName: string): T {
  return JSON.parse(
    readFileSync(
      path.join(process.cwd(), "api-samples", nickname, fileName),
      "utf8",
    ),
  ) as T;
}

describe("normalizeStats", () => {
  it("normalizes lifetime metrics from minaa_ stats", () => {
    const stats = normalizeStats(readSample("minaa_", "stats.json"));

    expect(stats?.metrics.avgKd).toBe(1.13);
    expect(stats?.metrics.winRate).toBe(49);
    expect(stats?.metrics.hsPercent).toBe(43);
  });

  it("converts fractional percent sources to 0..100 project units", () => {
    const stats = normalizeStats(readSample("minaa_", "stats.json"));

    expect(stats?.metrics.entrySuccess).toBe(53);
  });

  it("computes lifetime K/R for all three real samples", () => {
    expect(normalizeStats(readSample("minaa_", "stats.json"))?.metrics.kr).toBeCloseTo(
      0.732,
      3,
    );
    expect(
      normalizeStats(readSample("I-Perfect-I", "stats.json"))?.metrics.kr,
    ).toBeCloseTo(0.848, 3);
    expect(
      normalizeStats(readSample("Eyes_team", "stats.json"))?.metrics.kr,
    ).toBeCloseTo(0.77, 3);
  });

  it("has the same ordering by kr and avgKd for these samples", () => {
    const nicknames = ["minaa_", "I-Perfect-I", "Eyes_team"];
    const normalized = nicknames.map((nickname) => ({
      nickname,
      stats: normalizeStats(readSample(nickname, "stats.json")),
    }));

    const byKr = normalized
      .toSorted((a, b) => b.stats!.metrics.kr! - a.stats!.metrics.kr!)
      .map(({ nickname }) => nickname);
    const byAvgKd = normalized
      .toSorted((a, b) => b.stats!.metrics.avgKd! - a.stats!.metrics.avgKd!)
      .map(({ nickname }) => nickname);

    expect(byKr).toEqual(byAvgKd);
  });

  it("returns null for kr when lifetime rounds is zero", () => {
    const stats = normalizeStats({
      lifetime: {
        "Total Kills with extended stats": "10",
        "Total Rounds with extended stats": "0",
      },
    });

    expect(stats?.metrics.kr).toBeNull();
  });

  it("returns null for kr when a required lifetime field is absent", () => {
    const stats = normalizeStats({
      lifetime: {
        "Total Kills with extended stats": "10",
      },
    });

    expect(stats?.metrics.kr).toBeNull();
  });

  it("normalizes recent results to W/L values", () => {
    const stats = normalizeStats(readSample("minaa_", "stats.json"));

    expect(stats?.recentResults?.slice(0, 3)).toEqual(["W", "L", "W"]);
  });

  it("returns null when lifetime is absent", () => {
    expect(normalizeStats({})).toBeNull();
  });

  it("returns all metric values as null for an empty lifetime object", () => {
    const stats = normalizeStats({ lifetime: {} });

    expect(stats).not.toBeNull();
    expect(Object.values(stats!.metrics)).toHaveLength(metricDefinitions.length);
    expect(Object.values(stats!.metrics).every((value) => value === null)).toBe(
      true,
    );
    expect(Object.values(stats!.metrics)).not.toContain(0);
  });

  it("normalizes empty string metric values to null, not zero", () => {
    const stats = normalizeStats({
      lifetime: {
        "Average K/D Ratio": "",
      },
    });

    expect(stats?.metrics.avgKd).toBeNull();
    expect(stats?.metrics.avgKd).not.toBe(0);
  });
});

describe("normalizeProfile", () => {
  it("normalizes cs2 elo and skill level as numbers for all three players", () => {
    for (const nickname of ["minaa_", "I-Perfect-I", "Eyes_team"]) {
      const profile = normalizeProfile(readSample(nickname, "player.json"));

      expect(typeof profile.elo).toBe("number");
      expect(typeof profile.skillLevel).toBe("number");
    }
  });

  it("normalizes empty string profile fields to null where fields are nullable", () => {
    const profile = normalizeProfile({
      player_id: "player-id",
      nickname: "nickname",
      avatar: "",
      country: "",
      games: {
        cs2: {
          faceit_elo: "",
          skill_level: "",
        },
      },
    });

    expect(profile.avatar).toBeNull();
    expect(profile.country).toBeNull();
    expect(profile.elo).toBeNull();
    expect(profile.skillLevel).toBeNull();
  });

  it("normalizes an empty avatar string to null", () => {
    const profile = normalizeProfile({
      player_id: "player-id",
      nickname: "nickname",
      avatar: "",
      country: "ru",
      games: {
        cs2: {
          faceit_elo: 1000,
          skill_level: 5,
        },
      },
    });

    expect(profile.avatar).toBeNull();
  });

  it("sets cs2 elo and skill level to null when games.cs2 is absent", () => {
    const profile = normalizeProfile({
      player_id: "player-id",
      nickname: "nickname",
      avatar: "avatar",
      country: "ru",
      games: {},
    });

    expect(profile.elo).toBeNull();
    expect(profile.skillLevel).toBeNull();
  });
});

describe("metricDefinitions", () => {
  it("includes kr as the only derived metric", () => {
    expect(
      metricDefinitions
        .filter((definition) => "compute" in definition)
        .map((definition) => definition.key),
    ).toEqual(["kr"]);
    expect(metricDefinitions.map((definition) => definition.key)).not.toContain(
      "avgDeaths",
    );
  });

  it("marks matches as a neutral context metric", () => {
    expect(
      metricDefinitions.find((definition) => definition.key === "matches")
        ?.direction,
    ).toBe("neutral");
  });

  it("has a non-empty hint for every metric", () => {
    for (const definition of metricDefinitions) {
      expect(definition.hint.trim(), `${definition.key} hint`).not.toBe("");
    }
  });

  it("uses source keys that exist in every real lifetime sample", () => {
    const lifetimes = ["minaa_", "I-Perfect-I", "Eyes_team"].map((nickname) => {
      const stats = readSample<{ lifetime: Record<string, unknown> }>(
        nickname,
        "stats.json",
      );
      return { nickname, lifetime: stats.lifetime };
    });
    const sourceDefinitions = metricDefinitions.filter(
      (definition): definition is SourceMetricDefinition =>
        !("compute" in definition),
    );

    for (const definition of sourceDefinitions) {
      for (const { nickname, lifetime } of lifetimes) {
        expect(
          Object.hasOwn(lifetime, definition.sourceKey),
          `${definition.key} sourceKey "${definition.sourceKey}" missing in ${nickname}`,
        ).toBe(true);
      }
    }
  });
});
