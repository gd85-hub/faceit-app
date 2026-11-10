"use client";

import { useMemo, useState } from "react";
import {
  CartesianGrid,
  ComposedChart,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatMetricValue } from "@/lib/formatters";
import { SEASON_RESET_LABEL, seasonStartIndex } from "@/lib/season";

export type TrendMetric = "kd" | "adr" | "win";

export type TrendPoint = {
  date: string | null;
  map: string | null;
  result: "W" | "L" | null;
  kd: number | null;
  adr: number | null;
};

/** Period averages, exactly as shown in the table. */
export type PeriodMeans = Record<
  TrendMetric,
  { previous: number | null; recent: number | null }
>;

type ChartDatum = TrendPoint & {
  idx: number;
  value: number | null;
};

const METRICS: Record<
  TrendMetric,
  { label: string; format: "ratio" | "number" | "percent" }
> = {
  kd: { label: "K/D", format: "ratio" },
  adr: { label: "ADR", format: "number" },
  win: { label: "Win rate", format: "percent" },
};

const DOT_COLOR = "#3b82f6";
const STEP_COLOR = "var(--text)";

function pointValue(point: TrendPoint, metric: TrendMetric) {
  if (metric === "win") {
    return point.result === null ? null : point.result === "W" ? 100 : 0;
  }

  return point[metric];
}

function TrendTooltip({
  active,
  payload,
  metric,
}: {
  active?: boolean;
  payload?: Array<{ payload: ChartDatum }>;
  metric: TrendMetric;
}) {
  const datum = active ? payload?.[0]?.payload : undefined;

  if (!datum) {
    return null;
  }

  return (
    <div className="rounded-md border border-[var(--border)] bg-[var(--surface)] p-3 text-xs text-[var(--text)] shadow-sm">
      <div className="font-mono text-[var(--text-dim)]">Match {datum.idx}</div>
      <div className="text-[var(--text-dim)]">
        {datum.date ? datum.date.slice(0, 10) : "date missing"} ·{" "}
        {datum.map ?? "map missing"} · {datum.result ?? "result missing"}
      </div>
      {metric === "win" ? null : (
        <div className="font-mono tabular-nums">
          {METRICS[metric].label}{" "}
          {formatMetricValue(datum.value, METRICS[metric].format)}
        </div>
      )}
    </div>
  );
}

export function PeriodTrendChart({
  points,
  means,
  recentStartIndex,
  window,
  initialMetric = "kd",
}: {
  /** Oldest to newest. */
  points: TrendPoint[];
  means: PeriodMeans;
  /** 0-based index of the first match of the recent period. */
  recentStartIndex: number;
  window: number;
  initialMetric?: TrendMetric;
}) {
  const [metric, setMetric] = useState<TrendMetric>(initialMetric);
  const { format, label } = METRICS[metric];
  const data = useMemo(
    () =>
      points.map((point, index) => ({
        ...point,
        idx: index + 1,
        value: pointValue(point, metric),
      })),
    [points, metric],
  );
  const seasonIndex = seasonStartIndex(points.map((point) => point.date));
  const lastIdx = Math.max(data.length, 1);
  const previousMean = means[metric].previous;
  const recentMean = means[metric].recent;
  const steps = [
    recentStartIndex > 0 && previousMean !== null
      ? { key: "previous", from: 1, to: recentStartIndex, y: previousMean, text: `previous ${window}: ${formatMetricValue(previousMean, format)}` }
      : null,
    recentMean !== null
      ? { key: "recent", from: recentStartIndex + 1, to: lastIdx, y: recentMean, text: `last ${window}: ${formatMetricValue(recentMean, format)}` }
      : null,
  ].filter((step) => step !== null);

  return (
    <div className="space-y-3">
      <div className="flex gap-2" role="group" aria-label="Chart metric">
        {(Object.keys(METRICS) as TrendMetric[]).map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => setMetric(option)}
            aria-pressed={option === metric}
            className={[
              "rounded-md border px-3 py-1 text-xs font-medium transition-colors focus:outline focus:outline-2 focus:outline-offset-2 focus:outline-[var(--text)]",
              option === metric
                ? "border-[var(--text)] text-[var(--text)]"
                : "border-[var(--border)] text-[var(--text-dim)] hover:text-[var(--text)]",
            ].join(" ")}
          >
            {METRICS[option].label}
          </button>
        ))}
      </div>
      <div className="h-[300px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart
            data={data}
            margin={{ top: 28, right: 16, bottom: 28, left: 0 }}
          >
            <CartesianGrid stroke="var(--border)" vertical={false} />
            <XAxis
              dataKey="idx"
              type="number"
              domain={[1, lastIdx]}
              stroke="var(--text-dim)"
              tick={{ fill: "var(--text-dim)", fontSize: 12 }}
              label={{
                value: "match (oldest to newest)",
                position: "insideBottom",
                offset: -18,
                fill: "var(--text-dim)",
                fontSize: 12,
              }}
            />
            <YAxis
              stroke="var(--text-dim)"
              domain={metric === "win" ? [0, 100] : ["auto", "auto"]}
              tick={{ fill: "var(--text-dim)", fontSize: 12 }}
              tickFormatter={(value) => formatMetricValue(Number(value), format)}
            />
            <Tooltip content={<TrendTooltip metric={metric} />} />
            <Scatter
              dataKey="value"
              name={label}
              fill={DOT_COLOR}
              opacity={metric === "win" ? 0.25 : 0.3}
              isAnimationActive={false}
            />
            {recentStartIndex > 0 ? (
              <ReferenceLine
                x={recentStartIndex + 0.5}
                stroke="var(--text-faint)"
                strokeDasharray="4 4"
              />
            ) : null}
            {steps.map((step) => (
              <ReferenceLine
                key={step.key}
                segment={[
                  { x: step.from, y: step.y },
                  { x: step.to, y: step.y },
                ]}
                stroke={STEP_COLOR}
                strokeWidth={3}
                label={{
                  value: step.text,
                  position: "top",
                  fill: "var(--text)",
                  fontSize: 12,
                }}
              />
            ))}
            {seasonIndex !== null ? (
              <ReferenceLine
                x={seasonIndex + 0.5}
                stroke="var(--accent)"
                label={{
                  value: SEASON_RESET_LABEL,
                  position: "insideTopLeft",
                  fill: "var(--accent)",
                  fontSize: 11,
                }}
              />
            ) : null}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
