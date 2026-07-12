"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useReducer } from "react";
import {
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Scatter,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatMetricValue } from "@/lib/formatters";

type ChartMetric = "kd" | "adr";

type SeriesPoint = {
  idx: number;
  date: string;
  map: string | null;
  result: "W" | "L" | null;
  raw: number | null;
  smooth: number | null;
};

type MatchSeriesResponse = {
  metric: ChartMetric;
  players: {
    A: {
      nickname: string;
      points: SeriesPoint[];
    };
    B: {
      nickname: string;
      points: SeriesPoint[];
    };
  };
};

type ChartDatum = {
  idx: number;
  aRaw: number | null;
  aSmooth: number | null;
  aDate: string;
  aMap: string | null;
  aResult: "W" | "L" | null;
  bRaw: number | null;
  bSmooth: number | null;
  bDate: string;
  bMap: string | null;
  bResult: "W" | "L" | null;
};

type TooltipPayload = {
  payload: ChartDatum;
};

type ChartTooltipProps = {
  active?: boolean;
  payload?: TooltipPayload[];
};

const metricLabels = {
  kd: "K/D",
  adr: "ADR",
} satisfies Record<ChartMetric, string>;

const playerColors = {
  A: "#3b82f6",
  B: "#f59e0b",
} satisfies Record<"A" | "B", string>;

type ChartState = {
  data: MatchSeriesResponse | null;
  error: string | null;
  loading: boolean;
};

type ChartAction =
  | { type: "loading" }
  | { type: "success"; data: MatchSeriesResponse }
  | { type: "error"; error: string };

function chartReducer(_state: ChartState, action: ChartAction): ChartState {
  switch (action.type) {
    case "loading":
      return { data: null, error: null, loading: true };
    case "success":
      return { data: action.data, error: null, loading: false };
    case "error":
      return { data: null, error: action.error, loading: false };
  }
}

function parseMetric(value: string | null): ChartMetric {
  return value === "adr" ? "adr" : "kd";
}

function chartFormat(metric: ChartMetric) {
  return metric === "kd" ? "ratio" : "number";
}

function buildChartData(data: MatchSeriesResponse): ChartDatum[] {
  const length = Math.max(
    data.players.A.points.length,
    data.players.B.points.length,
  );

  return Array.from({ length }, (_, index) => {
    const pointA = data.players.A.points[index];
    const pointB = data.players.B.points[index];

    return {
      idx: index + 1,
      aRaw: pointA?.raw ?? null,
      aSmooth: pointA?.smooth ?? null,
      aDate: pointA?.date ?? "",
      aMap: pointA?.map ?? null,
      aResult: pointA?.result ?? null,
      bRaw: pointB?.raw ?? null,
      bSmooth: pointB?.smooth ?? null,
      bDate: pointB?.date ?? "",
      bMap: pointB?.map ?? null,
      bResult: pointB?.result ?? null,
    };
  });
}

function playerLineColor(player: "A" | "B") {
  return playerColors[player];
}

function MetricTabs({
  playerA,
  playerB,
  metric,
}: {
  playerA: string;
  playerB: string;
  metric: ChartMetric;
}) {
  return (
    <div className="flex gap-2" aria-label="Metric">
      {(["kd", "adr"] as const).map((option) => {
        const params = new URLSearchParams({
          playerA,
          playerB,
          metric: option,
        });
        const active = option === metric;

        return (
          <Link
            key={option}
            href={`/chart?${params.toString()}`}
            className={[
              "rounded-md border px-3 py-1.5 text-sm font-medium transition-colors focus:outline focus:outline-2 focus:outline-offset-2 focus:outline-[var(--text)]",
              active
                ? "border-[var(--text)] text-[var(--text)]"
                : "border-[var(--border)] text-[var(--text-dim)] hover:text-[var(--text)]",
            ].join(" ")}
            aria-current={active ? "page" : undefined}
          >
            {metricLabels[option]}
          </Link>
        );
      })}
    </div>
  );
}

function Spinner() {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-5 text-[var(--text)]">
      <div
        className="h-5 w-5 animate-spin rounded-full border-2 border-[var(--border)] border-t-[var(--text)]"
        aria-hidden="true"
      />
      <span>Collecting last 20 matches…</span>
    </div>
  );
}

function ChartTooltip({
  active,
  payload,
  metric,
  nicknameA,
  nicknameB,
}: ChartTooltipProps & {
  metric: ChartMetric;
  nicknameA: string;
  nicknameB: string;
}) {
  if (!active || !payload?.length) {
    return null;
  }

  const datum = payload[0]?.payload;
  if (!datum) {
    return null;
  }

  const format = chartFormat(metric);

  return (
    <div className="rounded-md border border-[var(--border)] bg-[var(--surface)] p-3 text-xs text-[var(--text)] shadow-sm">
      <div className="mb-2 font-mono text-[var(--text-dim)]">
        Match {datum.idx}
      </div>
      <div className="space-y-2">
        <div>
          <div className="font-medium">{nicknameA}</div>
          <div className="text-[var(--text-dim)]">
            {datum.aDate || "date missing"} · {datum.aMap ?? "map missing"} ·{" "}
            {datum.aResult ?? "result missing"}
          </div>
          <div className="font-mono tabular-nums">
            raw {metricLabels[metric]}: {formatMetricValue(datum.aRaw, format)}
          </div>
        </div>
        <div>
          <div className="font-medium">{nicknameB}</div>
          <div className="text-[var(--text-dim)]">
            {datum.bDate || "date missing"} · {datum.bMap ?? "map missing"} ·{" "}
            {datum.bResult ?? "result missing"}
          </div>
          <div className="font-mono tabular-nums">
            raw {metricLabels[metric]}: {formatMetricValue(datum.bRaw, format)}
          </div>
        </div>
      </div>
    </div>
  );
}

function ChartLegend({
  nicknameA,
  nicknameB,
}: {
  nicknameA: string;
  nicknameB: string;
}) {
  return (
    <div
      className="mb-3 flex flex-wrap justify-end gap-4 text-xs"
      aria-label="Chart legend"
    >
      {[
        { nickname: nicknameA, color: playerLineColor("A") },
        { nickname: nicknameB, color: playerLineColor("B") },
      ].map((item) => (
        <span
          key={item.nickname}
          className="inline-flex items-center gap-2"
          style={{ color: item.color }}
        >
          <span
            className="h-2.5 w-2.5 rounded-full"
            style={{ backgroundColor: item.color }}
            aria-hidden="true"
          />
          <span>{item.nickname}</span>
        </span>
      ))}
    </div>
  );
}

function MatchSeriesChart({ data }: { data: MatchSeriesResponse }) {
  const chartData = useMemo(() => buildChartData(data), [data]);
  const format = chartFormat(data.metric);
  const nicknameA = data.players.A.nickname;
  const nicknameB = data.players.B.nickname;

  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4">
      <ChartLegend nicknameA={nicknameA} nicknameB={nicknameB} />
      <div className="h-[420px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart
            data={chartData}
            margin={{ top: 12, right: 16, bottom: 28, left: 8 }}
          >
            <CartesianGrid stroke="var(--border)" vertical={false} />
            <XAxis
              dataKey="idx"
              stroke="var(--text-dim)"
              tick={{ fill: "var(--text-dim)", fontSize: 12 }}
              label={{
                value: "match number (oldest to newest)",
                position: "insideBottom",
                offset: -18,
                fill: "var(--text-dim)",
                fontSize: 12,
              }}
            />
            <YAxis
              stroke="var(--text-dim)"
              tick={{ fill: "var(--text-dim)", fontSize: 12 }}
              tickFormatter={(value) =>
                formatMetricValue(Number(value), format)
              }
            />
            <Tooltip
              content={
                <ChartTooltip
                  metric={data.metric}
                  nicknameA={nicknameA}
                  nicknameB={nicknameB}
                />
              }
            />
            <Line
              type="monotone"
              dataKey="aSmooth"
              name={`${nicknameA} smooth`}
              stroke={playerLineColor("A")}
              strokeWidth={3}
              dot={false}
              connectNulls
              isAnimationActive={false}
            />
            <Line
              type="monotone"
              dataKey="bSmooth"
              name={`${nicknameB} smooth`}
              stroke={playerLineColor("B")}
              strokeWidth={3}
              dot={false}
              connectNulls
              isAnimationActive={false}
            />
            <Scatter
              dataKey="aRaw"
              name={`${nicknameA} raw`}
              fill={playerLineColor("A")}
              opacity={0.35}
              isAnimationActive={false}
            />
            <Scatter
              dataKey="bRaw"
              name={`${nicknameB} raw`}
              fill={playerLineColor("B")}
              opacity={0.35}
              isAnimationActive={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export function MatchSeriesChartPage() {
  const searchParams = useSearchParams();
  const playerA = searchParams.get("playerA") ?? "";
  const playerB = searchParams.get("playerB") ?? "";
  const metric = parseMetric(searchParams.get("metric"));
  const [{ data, error, loading }, dispatch] = useReducer(chartReducer, {
    data: null,
    error: null,
    loading: true,
  });

  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams({
      playerA,
      playerB,
      metric,
    });

    dispatch({ type: "loading" });

    fetch(`/api/match-series?${params.toString()}`, {
      signal: controller.signal,
    })
      .then(async (response) => {
        const body = await response.json() as MatchSeriesResponse | {
          error?: { message?: string };
        };

        if (!response.ok) {
          throw new Error(
            "error" in body && body.error?.message
              ? body.error.message
              : "Could not load match series.",
          );
        }

        dispatch({ type: "success", data: body as MatchSeriesResponse });
      })
      .catch((fetchError: unknown) => {
        if (fetchError instanceof Error && fetchError.name === "AbortError") {
          return;
        }

        dispatch({
          type: "error",
          error:
            fetchError instanceof Error
              ? fetchError.message
              : "Could not load match series.",
        });
      });

    return () => controller.abort();
  }, [playerA, playerB, metric]);

  const comparisonParams = new URLSearchParams({
    playerA,
    playerB,
  });

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4">
      <Link
        href={`/compare?${comparisonParams.toString()}`}
        className="inline-flex text-sm text-[var(--text-dim)] transition-colors hover:text-[var(--text)] focus:outline focus:outline-2 focus:outline-offset-2 focus:outline-[var(--text)]"
      >
        {"\u2190"} Back to comparison
      </Link>

      <section className="space-y-4">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-[var(--text)]">
              {playerA} vs {playerB} {"\u2014"} {metricLabels[metric]} over last
              20 matches
            </h1>
            <p className="mt-2 text-sm text-[var(--text-dim)]">
              Smooth lines use a 5-match moving average. Raw values are shown as
              faint points.
            </p>
          </div>
          <MetricTabs playerA={playerA} playerB={playerB} metric={metric} />
        </div>

        {loading ? <Spinner /> : null}

        {error ? (
          <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-5 text-sm text-[var(--text)]">
            {error}
          </div>
        ) : null}

        {!loading && data ? <MatchSeriesChart data={data} /> : null}
      </section>
    </div>
  );
}
