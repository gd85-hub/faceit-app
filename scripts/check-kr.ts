import { readFile } from "node:fs/promises";
import path from "node:path";

const NICKNAMES = ["mina616", "opponent-a", "opponent-b"] as const;

type StatsResponse = {
  lifetime?: Record<string, unknown>;
};

function finiteNumber(value: unknown): number | null {
  if (value === "" || value === null || value === undefined) {
    return null;
  }

  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : null;
}

async function main() {
  for (const nickname of NICKNAMES) {
    const filePath = path.join(
      process.cwd(),
      "fixtures",
      "faceit",
      nickname,
      "stats.json",
    );
    const stats = JSON.parse(await readFile(filePath, "utf8")) as StatsResponse;
    const lifetime = stats.lifetime ?? {};
    const kills = finiteNumber(lifetime["Total Kills with extended stats"]);
    const rounds = finiteNumber(lifetime["Total Rounds with extended stats"]);
    const averageKd = lifetime["Average K/D Ratio"];
    const kr = kills !== null && rounds !== null && rounds !== 0
      ? kills / rounds
      : null;

    console.log(
      [
        nickname,
        `kills: ${kills ?? "n/a"}`,
        `rounds: ${rounds ?? "n/a"}`,
        `kr: ${kr === null ? "n/a" : kr.toFixed(3)}`,
        `lifetime Average K/D Ratio: ${String(averageKd)}`,
      ].join(" | "),
    );
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
