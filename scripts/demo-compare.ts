import { access, readFile } from "node:fs/promises";
import path from "node:path";
import { compare } from "@/lib/comparisonEngine";
import { normalizeStats } from "@/lib/statsNormalizer";

const DONK_SH1RO_PAIR = ["donk666", "sh1ro"] as const;
const FALLBACK_PAIR = ["minaa_", "I-Perfect-I"] as const;

async function readStats(nickname: string) {
  const filePath = path.join(
    process.cwd(),
    "api-samples",
    nickname,
    "stats.json",
  );

  return JSON.parse(await readFile(filePath, "utf8")) as unknown;
}

function formatValue(value: number | null) {
  return value === null ? "null" : String(value);
}

function primaryCounts(group: ReturnType<typeof compare>["groups"][number]) {
  const aheadPrimaryCount = group.metrics.filter(
    (metric) =>
      metric.significance === "primary" &&
      metric.status === "ahead" &&
      metric.diffPercent !== null,
  ).length;
  const behindPrimaryCount = group.metrics.filter(
    (metric) =>
      metric.significance === "primary" &&
      metric.status === "behind" &&
      metric.diffPercent !== null,
  ).length;

  return {
    aheadPrimaryCount,
    behindPrimaryCount,
    netDeficit: behindPrimaryCount - aheadPrimaryCount,
  };
}

async function hasStatsSample(nickname: string) {
  try {
    await access(path.join(process.cwd(), "api-samples", nickname, "stats.json"));
    return true;
  } catch {
    return false;
  }
}

async function demoPairs() {
  const hasDonkSh1ro = await Promise.all(
    DONK_SH1RO_PAIR.map((nickname) => hasStatsSample(nickname)),
  );

  return hasDonkSh1ro.every(Boolean)
    ? [DONK_SH1RO_PAIR, FALLBACK_PAIR]
    : [FALLBACK_PAIR];
}

async function printDemoPair(nicknameA: string, nicknameB: string) {
  const statsA = normalizeStats(await readStats(nicknameA));
  const statsB = normalizeStats(await readStats(nicknameB));

  if (!statsA || !statsB) {
    throw new Error("Expected normalized stats for both demo players");
  }

  const result = compare(statsA, statsB, { nicknameA, nicknameB });

  console.log(`pair: ${nicknameA} vs ${nicknameB}`);

  for (const group of result.groups) {
    const counts = primaryCounts(group);

    console.log(
      `${group.group}: verdict=${group.verdict}, comparable=${group.comparable}, aheadPrimary=${counts.aheadPrimaryCount}, behindPrimary=${counts.behindPrimaryCount}, netDeficit=${counts.netDeficit}, ahead=${group.aheadCount}, behind=${group.behindCount}, even=${group.evenCount}`,
    );

    for (const metric of group.metrics) {
      console.log(
        `  ${metric.label}: valueA=${formatValue(metric.valueA)}, valueB=${formatValue(metric.valueB)}, diff=${formatValue(metric.diff)}, diffPercent=${formatValue(metric.diffPercent)}, status=${metric.status}`,
      );
    }
  }

  console.log(
    `biggestGap: ${
      result.biggestGap
        ? `${result.biggestGap.group} / ${result.biggestGap.metric.label}`
        : "null"
    }`,
  );
  console.log(
    `weakestGroup: ${
      result.weakestGroup
        ? `${result.weakestGroup.group} / behindPrimary=${result.weakestGroup.behindPrimaryCount} / worstMetric=${result.weakestGroup.worstMetricKey}`
        : "null"
    }`,
  );
  console.log(
    `closest: ${
      result.closest
        ? `${result.closest.group} (${result.closest.comparable})`
        : "null"
    }`,
  );
  console.log("summary:");
  for (const line of result.summary) {
    console.log(line);
  }
}

async function main() {
  const pairs = await demoPairs();

  for (const [index, pair] of pairs.entries()) {
    if (index > 0) {
      console.log("");
    }

    await printDemoPair(pair[0], pair[1]);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
