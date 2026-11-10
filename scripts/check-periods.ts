/**
 * Prints how the period screen slices a real player's matches, to check a
 * surprising number (e.g. a big win-rate jump) against raw FACEIT data.
 * Read-only: fetches from FACEIT, never writes to Blob.
 *
 * Usage: npx tsx scripts/check-periods.ts <nickname> [30|50]
 * Needs FACEIT_API_KEY in .env.local.
 */
import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

async function main() {
  const [nickname, windowArg] = process.argv.slice(2);

  if (!nickname) {
    throw new Error("Usage: npx tsx scripts/check-periods.ts <nickname> [30|50]");
  }

  const { resolveProfile } = await import("../lib/playerService");
  const { syncPlayerMatches } = await import("../lib/matchArchive");
  const { comparePeriods, parsePeriodWindow } = await import("../lib/periodMetrics");

  const profile = await resolveProfile(nickname);
  const { matches } = await syncPlayerMatches(profile.playerId, null);
  const ids = matches.map((match) => match.match_id);
  const window = parsePeriodWindow(windowArg);
  const result = comparePeriods(matches, window);
  const previous = result.chartMatches.slice(0, result.previousCount);
  const recent = result.chartMatches.slice(result.previousCount);

  console.log(`${profile.nickname} (${profile.playerId})`);
  console.log(
    `collected ${matches.length} matches, ${new Set(ids).size} unique, ${matches.filter((match) => !match.finished_at).length} without a finish time, ${matches.filter((match) => match.result === null).length} without a result`,
  );

  for (const [name, period] of [
    ["previous", previous],
    ["recent", recent],
  ] as const) {
    const wins = period.filter((match) => match.result === "W").length;
    const losses = period.filter((match) => match.result === "L").length;
    console.log(
      `${name}: ${period.length} matches, ${period[0]?.finished_at ?? "?"} .. ${period.at(-1)?.finished_at ?? "?"}, W ${wins} / L ${losses}`,
    );
    console.log(`  ${period.map((match) => match.result ?? "?").join("")}`);
  }

  for (const metric of result.metrics) {
    console.log(
      `${metric.label.padEnd(22)} ${String(metric.valueB?.toFixed(2)).padStart(7)} -> ${String(metric.valueA?.toFixed(2)).padStart(7)}  z=${metric.changeZ?.toFixed(2) ?? "-"} ${metric.changeLevel ?? "-"}${metric.smallSample ? " (small sample)" : ""}`,
    );
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
