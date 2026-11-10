"use client";

import { useMemo } from "react";
import {
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatMetricValue } from "@/lib/formatters";
import { SEASON_RESET_LABEL, seasonStartIndex } from "@/lib/season";

export type TrendPoint = {
  date: string | null;
  map: string | null;
  result: "W" | "L" | null;
  kd: number | null;
};

type ChartDatum = TrendPoint & {
  idx: number;
  smooth: number | null;
};

const ROLLING_WINDOW = 5;
const LINE_COLOR = "#3b82f6";

function withRollingAverage(points: TrendPoint[]): ChartDatum[] {
  return points.map((point, index) => {
    const windowValues = points
      .slice(Math.max(0, index - ROLLING_WINDOW + 1), index + 1)
      .map((item) => item.kd)
      .filter((value): value is number => value !== null);

    return {
      ...point,
      idx: index + 1,
      smooth:
        windowValues.length > 0
          ? windowValues.reduce((sum, value) => sum + value, 0) /
            windowValues.length
          : null,
    };
  });
}

function TrendTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ payload: ChartDatum }>;
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
      <div className="font-mono tabular-nums">
        K/D {formatMetricValue(datum.kd, "ratio")}
      </div>
    </div>
  );
}

export function PeriodTrendChart({
  points,
  recentStartIndex,
  recentLabel,
}: {
  /** Oldest to newest. */
  points: TrendPoint[];
  /** 0-based index of the first match of the recent period. */
  recentStartIndex: number;
  recentLabel: string;
}) {
  const data = useMemo(() => withRollingAverage(points), [points]);
  const seasonIndex = seasonStartIndex(points.map((point) => point.date));

  return (
    <div className="h-[300px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart
          data={data}
          margin={{ top: 24, right: 16, bottom: 28, left: 0 }}
        >
          <CartesianGrid stroke="var(--border)" vertical={false} />
          <XAxis
            dataKey="idx"
            type="number"
            domain={[1, Math.max(data.length, 1)]}
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
            tick={{ fill: "var(--text-dim)", fontSize: 12 }}
            tickFormatter={(value) => formatMetricValue(Number(value), "ratio")}
          />
          <Tooltip content={<TrendTooltip />} />
          {recentStartIndex > 0 ? (
            <ReferenceLine
              x={recentStartIndex + 0.5}
              stroke="var(--text-faint)"
              strokeDasharray="4 4"
              label={{
                value: recentLabel,
                position: "insideTopRight",
                fill: "var(--text-dim)",
                fontSize: 11,
              }}
            />
          ) : null}
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
          <Line
            type="monotone"
            dataKey="smooth"
            stroke={LINE_COLOR}
            strokeWidth={3}
            dot={false}
            connectNulls
            isAnimationActive={false}
          />
          <Scatter
            dataKey="kd"
            fill={LINE_COLOR}
            opacity={0.35}
            isAnimationActive={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
