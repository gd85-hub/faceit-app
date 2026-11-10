import { compare } from "@/lib/comparisonEngine";
import { crossesSeasonStart } from "@/lib/season";
import type { ComparisonResult, MetricComparison } from "@/types/comparison";
import type { DerivedMetricDefinition, MetricKey } from "@/types/metrics";
import type { NormalizedStats } from "@/types/stats";
import type { CollectedMatch } from "@/types/matches";

export const PERIOD_WINDOWS = [30, 50] as const;
export type PeriodWindow = (typeof PERIOD_WINDOWS)[number];
export const DEFAULT_PERIOD_WINDOW: PeriodWindow = 30;

/**
 * A period with fewer matches than this is a small sample: its numbers are
 * shown, but a lower value is not called a drop.
 */
export const MIN_PERIOD_MATCHES = 15;
/** "K/D in losses" needs at least this many losses in each period. */
export const MIN_LOSSES = 5;

export function parsePeriodWindow(
  value: string | undefined | null,
): PeriodWindow {
  return value === "50" ? 50 : DEFAULT_PERIOD_WINDOW;
}

/** Per-period aggregates the period metric catalog reads from. */
type PeriodValues = Partial<Record<MetricKey, number | null>>;

function fromValues(key: MetricKey) {
  return (values: Record<string, unknown>) => {
    const value = values[key];
    return typeof value === "number" && Number.isFinite(value) ? value : null;
  };
}

/** Same shape as the lifetime catalog, so comparisonEngine runs unchanged. */
export const periodMetricDefinitions: readonly DerivedMetricDefinition[] = [
  {
    key: "avgKd",
    label: "K/D",
    group: "fragging",
    direction: "higher",
    format: "ratio",
    significance: "primary",
    hint: "kills per death, averaged over matches",
    compute: fromValues("avgKd"),
  },
  {
    key: "kda",
    label: "K/D/A",
    group: "fragging",
    direction: "higher",
    format: "ratio",
    significance: "secondary",
    hint: "kills plus assists per death",
    compute: fromValues("kda"),
  },
  {
    key: "adr",
    label: "ADR",
    group: "fragging",
    direction: "higher",
    format: "number",
    significance: "primary",
    hint: "average damage per round",
    compute: fromValues("adr"),
  },
  {
    key: "hsPercent",
    label: "Headshots",
    group: "fragging",
    direction: "higher",
    format: "percent",
    significance: "secondary",
    hint: "share of kills that were headshots",
    compute: fromValues("hsPercent"),
  },
  {
    key: "winRate",
    label: "Win rate",
    group: "results",
    direction: "higher",
    format: "percent",
    significance: "primary",
    hint: "share of matches won",
    compute: fromValues("winRate"),
  },
  {
    key: "kdSpread",
    label: "Stability",
    group: "consistency",
    direction: "lower",
    format: "ratio",
    significance: "primary",
    hint: "how much K/D jumps between matches; smaller is steadier",
    compute: fromValues("kdSpread"),
  },
  {
    key: "worstThirdAdr",
    label: "ADR on off days",
    group: "consistency",
    direction: "higher",
    format: "number",
    significance: "primary",
    hint: "average ADR in the weakest third of matches",
    compute: fromValues("worstThirdAdr"),
  },
  {
    key: "lossKd",
    label: "K/D in losses",
    group: "consistency",
    direction: "higher",
    format: "ratio",
    significance: "primary",
    hint: "K/D in matches that were lost",
    compute: fromValues("lossKd"),
  },
];

function mean(values: number[]) {
  return values.length === 0
    ? null
    : values.reduce((sum, value) => sum + value, 0) / values.length;
}

function standardDeviation(values: number[]) {
  const average = mean(values);

  if (average === null || values.length < 2) {
    return null;
  }

  const variance =
    values.reduce((sum, value) => sum + (value - average) ** 2, 0) /
    (values.length - 1);
  return Math.sqrt(variance);
}

/** Per-match K/D; a deathless match counts as kills / 1. */
export function matchKd(match: CollectedMatch) {
  if (match.kills === null || match.deaths === null) {
    return null;
  }

  return match.kills / Math.max(match.deaths, 1);
}

function present<T>(values: Array<T | null>): T[] {
  return values.filter((value): value is T => value !== null);
}

export function periodValues(matches: readonly CollectedMatch[]): PeriodValues {
  const kds = present(matches.map(matchKd));
  const kdas = present(
    matches.map((match) =>
      match.kills === null || match.deaths === null
        ? null
        : (match.kills + (match.assists ?? 0)) / Math.max(match.deaths, 1),
    ),
  );
  const adrs = present(matches.map((match) => match.adr));
  const decided = matches.filter((match) => match.result !== null);
  const losses = decided.filter((match) => match.result === "L");
  const lossKds = present(losses.map(matchKd));
  let kills = 0;
  let headshots = 0;

  for (const match of matches) {
    if (match.kills !== null && match.hs_percent !== null) {
      kills += match.kills;
      headshots += (match.kills * match.hs_percent) / 100;
    }
  }

  const sortedAdrs = adrs.toSorted((a, b) => a - b);
  const worstThird = sortedAdrs.slice(0, Math.ceil(sortedAdrs.length / 3));

  return {
    avgKd: mean(kds),
    kda: mean(kdas),
    adr: mean(adrs),
    hsPercent: kills > 0 ? (headshots / kills) * 100 : null,
    winRate:
      decided.length > 0
        ? ((decided.length - losses.length) / decided.length) * 100
        : null,
    kdSpread: standardDeviation(kds),
    worstThirdAdr: mean(worstThird),
    lossKd: lossKds.length >= MIN_LOSSES ? mean(lossKds) : null,
  };
}

function toStats(values: PeriodValues): NormalizedStats {
  const metrics = Object.fromEntries(
    periodMetricDefinitions.map((definition) => [
      definition.key,
      definition.compute(values),
    ]),
  ) as NormalizedStats["metrics"];

  return { metrics, recentResults: null };
}

export type PeriodMetricView = MetricComparison & {
  hint: string;
  /** Not enough matches to call the change; never presented as a drop. */
  smallSample: boolean;
};

export type PeriodComparison = {
  window: PeriodWindow;
  recentCount: number;
  previousCount: number;
  /** One of the periods has fewer than MIN_PERIOD_MATCHES matches. */
  smallSample: boolean;
  crossesSeason: boolean;
  comparison: ComparisonResult;
  improved: PeriodMetricView[];
  steady: PeriodMetricView[];
  dipped: PeriodMetricView[];
  uncertain: PeriodMetricView[];
  /** Matches of both periods, oldest to newest, for the chart. */
  chartMatches: CollectedMatch[];
};

function lossCount(matches: readonly CollectedMatch[]) {
  return matches.filter((match) => match.result === "L").length;
}

/**
 * Compares the last `window` matches (A) with the `window` before them (B)
 * using the unchanged comparison engine. `matches` must be newest first.
 */
export function comparePeriods(
  matches: readonly CollectedMatch[],
  window: PeriodWindow,
): PeriodComparison {
  const recent = matches.slice(0, window);
  const previous = matches.slice(window, window * 2);
  const smallSample =
    recent.length < MIN_PERIOD_MATCHES || previous.length < MIN_PERIOD_MATCHES;
  const fewLosses =
    lossCount(recent) < MIN_LOSSES || lossCount(previous) < MIN_LOSSES;
  const comparison = compare(
    toStats(periodValues(recent)),
    toStats(periodValues(previous)),
    {
      nicknameA: `Last ${window}`,
      nicknameB: `Previous ${window}`,
      definitions: periodMetricDefinitions,
    },
  );
  const hints = new Map(
    periodMetricDefinitions.map((definition) => [
      definition.key,
      definition.hint,
    ]),
  );
  const views = comparison.groups
    .flatMap((group) => group.metrics)
    .map(
      (metric): PeriodMetricView => ({
        ...metric,
        hint: hints.get(metric.key) ?? "",
        smallSample:
          smallSample ||
          (metric.key === "lossKd" && fewLosses) ||
          metric.status === "unknown",
      }),
    );
  const chartMatches = [...recent, ...previous].toReversed();

  return {
    window,
    recentCount: recent.length,
    previousCount: previous.length,
    smallSample,
    crossesSeason: crossesSeasonStart(
      chartMatches.map((match) => match.finished_at),
    ),
    comparison,
    improved: views.filter(
      (view) => !view.smallSample && view.status === "ahead",
    ),
    steady: views.filter((view) => !view.smallSample && view.status === "even"),
    dipped: views.filter(
      (view) => !view.smallSample && view.status === "behind",
    ),
    uncertain: views.filter((view) => view.smallSample),
    chartMatches,
  };
}
