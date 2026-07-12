import { metricDefinitions } from "@/lib/metricDefinitions";
import { formatDiff, formatMetricValue } from "@/lib/formatters";
import type { MetricDefinition, MetricGroup } from "@/types/metrics";
import type {
  ComparisonHighlight,
  ComparisonResult,
  GroupComparison,
  GroupVerdict,
  MetricComparison,
  MetricStatus,
  WeakestGroup,
} from "@/types/comparison";
import type { NormalizedStats } from "@/types/stats";

const GROUP_ORDER: MetricGroup[] = [
  "fragging",
  "results",
  "entry",
  "clutch",
  "utility",
];
const EVEN_DIFF_PERCENT_THRESHOLD = 3;

const SUMMARY_TEMPLATES = {
  biggestGap: (group: MetricGroup, metric: MetricComparison) =>
    `The largest deficit is in ${group}: ${metric.label} (${formatMetricValue(metric.valueA, metric.format)} vs ${formatMetricValue(metric.valueB, metric.format)} (${formatDiff(metric.diff, metric.format)})).`,
  strongerGroup: (
    verdict: Extract<GroupVerdict, "A_stronger" | "B_stronger">,
    nicknameA: string,
    nicknameB: string,
    group: MetricGroup,
  ) =>
    `${verdict === "A_stronger" ? nicknameA : nicknameB} is stronger in ${group}.`,
  closestGroup: (group: MetricGroup) =>
    `The closest group is ${group}.`,
  evenMetric: (metric: MetricComparison) =>
    `${metric.label} is even (${metric.valueA} vs ${metric.valueB}).`,
  insufficient: "There is not enough comparable data to summarize the comparison.",
} as const;

function compareMetricStatus(
  valueA: number | null,
  valueB: number | null,
  direction: MetricDefinition["direction"],
  diff: number | null,
  diffPercent: number | null,
): MetricStatus {
  if (direction === "neutral") {
    return "neutral";
  }

  if (valueA === null || valueB === null) {
    return "unknown";
  }

  if (
    diffPercent !== null &&
    Math.abs(diffPercent) < EVEN_DIFF_PERCENT_THRESHOLD
  ) {
    return "even";
  }

  if (direction === "higher") {
    return diff !== null && diff > 0 ? "ahead" : "behind";
  }

  return diff !== null && diff < 0 ? "ahead" : "behind";
}

function diffPercent(valueA: number | null, valueB: number | null) {
  if (valueA === null || valueB === null || valueB === 0) {
    return null;
  }

  return ((valueA - valueB) / Math.abs(valueB)) * 100;
}

function groupVerdict(
  aheadCount: number,
  behindCount: number,
  comparable: number,
): GroupVerdict {
  if (comparable === 0) {
    return "insufficient";
  }

  if (aheadCount === behindCount) {
    return "close";
  }

  if (aheadCount > behindCount) {
    return "A_stronger";
  }

  if (behindCount > aheadCount) {
    return "B_stronger";
  }

  return "close";
}

function buildMetricComparison(
  definition: MetricDefinition,
  a: NormalizedStats,
  b: NormalizedStats,
): MetricComparison {
  const valueA = a.metrics[definition.key] ?? null;
  const valueB = b.metrics[definition.key] ?? null;
  const diff = valueA === null || valueB === null ? null : valueA - valueB;
  const percentDiff = diffPercent(valueA, valueB);

  return {
    key: definition.key,
    label: definition.label,
    group: definition.group,
    direction: definition.direction,
    format: definition.format,
    significance: definition.significance,
    valueA,
    valueB,
    diff,
    diffPercent: percentDiff,
    status: compareMetricStatus(
      valueA,
      valueB,
      definition.direction,
      diff,
      percentDiff,
    ),
  };
}

function isCountable(metric: MetricComparison) {
  return metric.status === "ahead" || metric.status === "behind";
}

type WeakestGroupCandidate = WeakestGroup & {
  aheadPrimaryCount: number;
  netDeficit: number;
  worstDiffPercent: number;
};

function buildWeakestGroup(groups: GroupComparison[]): WeakestGroup | null {
  const candidates = groups
    .map((group): WeakestGroupCandidate | null => {
      if (group.verdict !== "B_stronger" || group.comparable < 2) {
        return null;
      }

      const aheadPrimaryMetrics = group.metrics.filter(
        (metric) =>
          metric.significance === "primary" &&
          metric.status === "ahead" &&
          metric.diffPercent !== null,
      );
      const behindPrimaryMetrics = group.metrics.filter(
        (metric) =>
          metric.significance === "primary" &&
          metric.status === "behind" &&
          metric.diffPercent !== null,
      );
      const worstMetric = behindPrimaryMetrics.toSorted(
        (aMetric, bMetric) =>
          Math.abs(bMetric.diffPercent!) - Math.abs(aMetric.diffPercent!),
      )[0];

      if (!worstMetric) {
        return null;
      }

      const behindPrimaryCount = behindPrimaryMetrics.length;
      const aheadPrimaryCount = aheadPrimaryMetrics.length;

      return {
        group: group.group,
        behindPrimaryCount,
        aheadPrimaryCount,
        netDeficit: behindPrimaryCount - aheadPrimaryCount,
        worstMetricKey: worstMetric.key,
        worstDiffPercent: Math.abs(worstMetric.diffPercent!),
      };
    })
    .filter((candidate): candidate is WeakestGroupCandidate => candidate !== null);

  const weakest = candidates.toSorted((aCandidate, bCandidate) => {
    const netDeficitDiff = bCandidate.netDeficit - aCandidate.netDeficit;

    if (netDeficitDiff !== 0) {
      return netDeficitDiff;
    }

    return bCandidate.worstDiffPercent - aCandidate.worstDiffPercent;
  })[0];

  if (!weakest) {
    return null;
  }

  return {
    group: weakest.group,
    behindPrimaryCount: weakest.behindPrimaryCount,
    worstMetricKey: weakest.worstMetricKey,
  };
}

function buildSummary(
  groups: GroupComparison[],
  biggestGap: ComparisonHighlight | null,
  closest: ComparisonResult["closest"],
  nicknameA: string,
  nicknameB: string,
) {
  if (groups.every((group) => group.verdict === "insufficient")) {
    return [SUMMARY_TEMPLATES.insufficient];
  }

  const summary: string[] = [];

  if (biggestGap !== null) {
    summary.push(SUMMARY_TEMPLATES.biggestGap(biggestGap.group, biggestGap.metric));
  }

  const strongerGroup = groups.find(
    (
      group,
    ): group is GroupComparison & {
      verdict: Extract<GroupVerdict, "A_stronger" | "B_stronger">;
    } => group.verdict === "A_stronger" || group.verdict === "B_stronger",
  );
  if (strongerGroup) {
    summary.push(
      SUMMARY_TEMPLATES.strongerGroup(
        strongerGroup.verdict,
        nicknameA,
        nicknameB,
        strongerGroup.group,
      ),
    );
  }

  if (closest !== null && closest.group !== biggestGap?.group) {
    summary.push(SUMMARY_TEMPLATES.closestGroup(closest.group));
  }

  const evenMetric = groups
    .flatMap((group) => group.metrics)
    .find((metric) => metric.status === "even");
  if (evenMetric && summary.length < 3) {
    summary.push(SUMMARY_TEMPLATES.evenMetric(evenMetric));
  }

  return summary.slice(0, 3);
}

type CompareOptions = {
  nicknameA?: string;
  nicknameB?: string;
};

export function compare(
  a: NormalizedStats,
  b: NormalizedStats,
  options: CompareOptions = {},
): ComparisonResult {
  const nicknameA = options.nicknameA ?? "A";
  const nicknameB = options.nicknameB ?? "B";
  const metrics = metricDefinitions.map((definition) =>
    buildMetricComparison(definition, a, b),
  );

  const groups = GROUP_ORDER.map((group) => {
    const groupMetrics = metrics.filter((metric) => metric.group === group);
    const countable = groupMetrics.filter(isCountable);
    const aheadCount = countable.filter((metric) => metric.status === "ahead").length;
    const behindCount = countable.filter(
      (metric) => metric.status === "behind",
    ).length;
    const evenCount = groupMetrics.filter((metric) => metric.status === "even").length;
    const comparable = aheadCount + behindCount + evenCount;

    return {
      group,
      verdict: groupVerdict(aheadCount, behindCount, comparable),
      aheadCount,
      behindCount,
      evenCount,
      comparable,
      metrics: groupMetrics,
    };
  });

  const biggestGapMetric = metrics
    .filter(
      (metric) =>
        metric.status === "behind" &&
        metric.significance === "primary" &&
        metric.diffPercent !== null,
    )
    .toSorted((aMetric, bMetric) => {
      return Math.abs(bMetric.diffPercent!) - Math.abs(aMetric.diffPercent!);
    })[0];
  const biggestGap: ComparisonHighlight | null = biggestGapMetric
    ? {
        group: biggestGapMetric.group,
        metricKey: biggestGapMetric.key,
        metric: biggestGapMetric,
      }
    : null;

  const closest = groups
    .filter((group) => group.verdict === "close")
    .map((group) => ({
      group: group.group,
      comparable: group.comparable,
    }))
    .toSorted((aGroup, bGroup) => {
      return bGroup.comparable - aGroup.comparable;
    })[0] ?? null;
  const weakestGroup = buildWeakestGroup(groups);

  return {
    groups,
    biggestGap,
    weakestGroup,
    closest,
    summary: buildSummary(groups, biggestGap, closest, nicknameA, nicknameB),
  };
}
