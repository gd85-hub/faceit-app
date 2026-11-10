import type {
  MetricDirection,
  MetricFormat,
  MetricGroup,
  MetricKey,
  MetricSignificance,
} from "./metrics";

export type MetricStatus = "ahead" | "behind" | "even" | "neutral" | "unknown";
/**
 * How sure we are that a change is real rather than normal match-to-match
 * swing: |diff| > 2 SE, 1–2 SE, < 1 SE of the difference.
 */
export type ChangeLevel = "significant" | "likely" | "noise";
export type GroupVerdict =
  | "A_stronger"
  | "B_stronger"
  | "close"
  | "insufficient";

export interface MetricComparison {
  key: MetricKey;
  label: string;
  group: MetricGroup;
  direction: MetricDirection;
  format: MetricFormat;
  significance: MetricSignificance;
  valueA: number | null;
  valueB: number | null;
  diff: number | null;
  diffPercent: number | null;
  status: MetricStatus;
  /** Null when either side has no standard error (e.g. lifetime stats). */
  changeLevel: ChangeLevel | null;
  /** |diff| divided by the standard error of the difference. */
  changeZ: number | null;
}

export interface GroupComparison {
  group: MetricGroup;
  verdict: GroupVerdict;
  aheadCount: number;
  behindCount: number;
  evenCount: number;
  comparable: number;
  metrics: MetricComparison[];
}

export interface ComparisonHighlight {
  group: MetricGroup;
  metricKey: MetricKey;
  metric: MetricComparison;
}

export interface ClosestGroup {
  group: MetricGroup;
  comparable: number;
}

export interface WeakestGroup {
  group: MetricGroup;
  behindPrimaryCount: number;
  worstMetricKey: MetricKey;
}

export interface ComparisonResult {
  groups: GroupComparison[];
  biggestGap: ComparisonHighlight | null;
  weakestGroup: WeakestGroup | null;
  closest: ClosestGroup | null;
  summary: string[];
}
