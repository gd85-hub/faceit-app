import { compare } from "@/lib/comparisonEngine";
import { mergeMatches } from "@/lib/matchStore";
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
    // Not "ADR ...": next to the ADR metric that read like a duplicate.
    label: "Damage in weak games",
    group: "consistency",
    direction: "higher",
    format: "number",
    significance: "primary",
    hint: "average damage per round in the weakest third of matches",
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

/** Value and standard error of one metric over one period. */
type Estimate = { value: number | null; se: number | null };

function meanEstimate(values: number[]): Estimate {
  const sd = standardDeviation(values);
  return {
    value: mean(values),
    se: sd === null ? null : sd / Math.sqrt(values.length),
  };
}

/**
 * Win rate as a proportion, in percent. The SE uses (wins + 0.5) / (n + 1) so
 * a period with 0% or 100% wins does not get a zero SE.
 */
function proportionEstimate(wins: number, total: number): Estimate {
  if (total === 0) {
    return { value: null, se: null };
  }

  const adjusted = (wins + 0.5) / (total + 1);
  return {
    value: (wins / total) * 100,
    se: Math.sqrt((adjusted * (1 - adjusted)) / total) * 100,
  };
}

/** Spread of K/D; SE of a sample SD ≈ sd / sqrt(2(n − 1)). */
function spreadEstimate(values: number[]): Estimate {
  const sd = standardDeviation(values);
  return {
    value: sd,
    se: sd === null ? null : sd / Math.sqrt(2 * (values.length - 1)),
  };
}

export function periodEstimates(
  matches: readonly CollectedMatch[],
): Partial<Record<MetricKey, Estimate>> {
  const kds = present(matches.map(matchKd));
  const kdas = present(
    matches.map((match) =>
      match.kills === null || match.deaths === null
        ? null
        : (match.kills + (match.assists ?? 0)) / Math.max(match.deaths, 1),
    ),
  );
  const adrs = present(matches.map((match) => match.adr));
  const headshotShares = present(matches.map((match) => match.hs_percent));
  const decided = matches.filter((match) => match.result !== null);
  const losses = decided.filter((match) => match.result === "L");
  const lossKds = present(losses.map(matchKd));
  const sortedAdrs = adrs.toSorted((a, b) => a - b);
  const worstThird = sortedAdrs.slice(0, Math.ceil(sortedAdrs.length / 3));

  return {
    avgKd: meanEstimate(kds),
    kda: meanEstimate(kdas),
    adr: meanEstimate(adrs),
    // Average of per-match headshot %, like FACEIT's "Average Headshots %".
    hsPercent: meanEstimate(headshotShares),
    winRate: proportionEstimate(decided.length - losses.length, decided.length),
    kdSpread: spreadEstimate(kds),
    worstThirdAdr: meanEstimate(worstThird),
    lossKd:
      lossKds.length >= MIN_LOSSES
        ? meanEstimate(lossKds)
        : { value: null, se: null },
  };
}

export function periodValues(matches: readonly CollectedMatch[]): PeriodValues {
  return Object.fromEntries(
    Object.entries(periodEstimates(matches)).map(([key, estimate]) => [
      key,
      estimate.value,
    ]),
  ) as PeriodValues;
}

function toStats(matches: readonly CollectedMatch[]): NormalizedStats {
  const estimates = periodEstimates(matches);
  const values = periodValues(matches);
  const metrics = Object.fromEntries(
    periodMetricDefinitions.map((definition) => [
      definition.key,
      definition.compute(values),
    ]),
  ) as NormalizedStats["metrics"];
  const standardErrors = Object.fromEntries(
    periodMetricDefinitions.map((definition) => [
      definition.key,
      estimates[definition.key]?.se ?? null,
    ]),
  );

  return { metrics, recentResults: null, standardErrors };
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
  /** Every metric, in catalog order. */
  metrics: PeriodMetricView[];
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
 * using the comparison engine. Input order does not matter: matches are
 * deduplicated by match_id and ordered by finish time here, so the periods
 * never depend on how storage happened to order them.
 */
export function comparePeriods(
  input: readonly CollectedMatch[],
  window: PeriodWindow,
): PeriodComparison {
  const matches = mergeMatches([], input);
  const recent = matches.slice(0, window);
  const previous = matches.slice(window, window * 2);
  const smallSample =
    recent.length < MIN_PERIOD_MATCHES || previous.length < MIN_PERIOD_MATCHES;
  const fewLosses =
    lossCount(recent) < MIN_LOSSES || lossCount(previous) < MIN_LOSSES;
  const comparison = compare(
    toStats(recent),
    toStats(previous),
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
    metrics: views,
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
