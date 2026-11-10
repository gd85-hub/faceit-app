import { readFile } from "node:fs/promises";
import path from "node:path";

const NICKNAMES = ["mina616", "opponent-a", "opponent-b"] as const;

type ValidationResult = {
  nickname: string;
  segmentMatches: number;
  lifetimeMatches: number | null;
  differencePercent: number | null;
  passes: boolean;
};

type StatsResponse = {
  lifetime?: Record<string, unknown>;
  segments?: Array<{
    mode?: unknown;
    type?: unknown;
    stats?: Record<string, unknown>;
  }>;
};

function finiteNumber(value: unknown): number | null {
  if (value === "" || value === null || value === undefined) {
    return null;
  }

  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : null;
}

export async function validateSegments(): Promise<ValidationResult[]> {
  const results: ValidationResult[] = [];

  for (const nickname of NICKNAMES) {
    const filePath = path.join(
      process.cwd(),
      "fixtures",
      "faceit",
      nickname,
      "stats.json",
    );
    const raw = JSON.parse(await readFile(filePath, "utf8")) as StatsResponse;
    const segments = Array.isArray(raw.segments) ? raw.segments : [];

    const segmentMatches = segments
      .filter((segment) => segment.mode === "5v5" && segment.type === "Map")
      .reduce((sum, segment) => {
        return sum + (finiteNumber(segment.stats?.["Matches"]) ?? 0);
      }, 0);

    const lifetimeMatches = finiteNumber(raw.lifetime?.["Matches"]);
    const differencePercent =
      lifetimeMatches && lifetimeMatches !== 0
        ? Math.abs(segmentMatches - lifetimeMatches) / lifetimeMatches * 100
        : null;

    results.push({
      nickname,
      segmentMatches,
      lifetimeMatches,
      differencePercent,
      passes: differencePercent !== null && differencePercent <= 10,
    });
  }

  return results;
}

function formatPercent(value: number | null) {
  return value === null ? "n/a" : `${value.toFixed(2)}%`;
}

async function main() {
  const results = await validateSegments();

  for (const result of results) {
    console.log(
      [
        result.nickname,
        `5v5 segment Matches sum: ${result.segmentMatches}`,
        `lifetime Matches: ${result.lifetimeMatches ?? "n/a"}`,
        `difference: ${formatPercent(result.differencePercent)}`,
        `passes: ${result.passes ? "yes" : "no"}`,
      ].join(" | "),
    );
  }

  const failed = results.filter((result) => !result.passes);
  if (failed.length > 0) {
    process.exitCode = 1;
  }
}

if (process.argv[1]?.endsWith("validate-segments.ts")) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
