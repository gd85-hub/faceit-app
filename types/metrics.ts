export type MetricFormat = "percent" | "ratio" | "number" | "integer";
export type MetricDirection = "higher" | "lower" | "neutral";
export type MetricSignificance = "primary" | "secondary";
export type MetricGroup =
  | "fragging"
  | "results"
  | "entry"
  | "clutch"
  | "utility"
  | "consistency";
export type MetricKey =
  | "avgKd"
  | "kr"
  | "adr"
  | "hsPercent"
  | "winRate"
  | "matches"
  | "longestWin"
  | "currentWin"
  | "entryRate"
  | "entrySuccess"
  | "clutch1v1"
  | "clutch1v2"
  | "flashSuccess"
  | "enemiesFlash"
  | "utilDmgRound"
  // Period (per-match) metrics, see lib/periodMetrics.ts.
  | "kaPerDeath"
  | "kdSpread"
  | "worstThirdAdr"
  | "lossKd";

export interface BaseMetricDefinition {
  key: MetricKey;
  label: string;
  group: MetricGroup;
  direction: MetricDirection;
  format: MetricFormat;
  significance: MetricSignificance;
  hint: string;
}

export interface SourceMetricDefinition extends BaseMetricDefinition {
  sourceKey: string;
  sourceScale: 1 | 100;
  compute?: never;
}

export interface DerivedMetricDefinition extends BaseMetricDefinition {
  compute: (lifetime: Record<string, unknown>) => number | null;
  sourceKey?: never;
  sourceScale?: never;
}

export type MetricDefinition = SourceMetricDefinition | DerivedMetricDefinition;
