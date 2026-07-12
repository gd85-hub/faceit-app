import { Fragment } from "react";
import Link from "next/link";
import { formatDiff, formatMetricValue } from "@/lib/formatters";
import { groupLabels, verdictLabels } from "@/lib/labels";
import { metricDefinitions } from "@/lib/metricDefinitions";
import { MetricSignal } from "@/components/MetricSignal";
import { metricGridRow } from "@/components/metricGrid";
import type { ComparisonResult, MetricComparison } from "@/types/comparison";
import type { MetricKey } from "@/types/metrics";

type MetricComparisonTableProps = {
  comparison: ComparisonResult;
  nicknameA: string;
  nicknameB: string;
};

const hintsByMetricKey = new Map<MetricKey, string>(
  metricDefinitions.map((definition) => [definition.key, definition.hint]),
);

const chartMetricByKey = new Map<MetricKey, "kd" | "adr">([
  ["avgKd", "kd"],
  ["adr", "adr"],
]);

function truncateNickname(nickname: string) {
  return nickname.length > 20 ? `${nickname.slice(0, 20)}...` : nickname;
}

function displayDiff(metric: MetricComparison) {
  if (metric.status === "neutral") {
    return "not compared";
  }

  if (
    metric.diff === null ||
    metric.diffPercent === null ||
    metric.status === "even" ||
    metric.status === "unknown"
  ) {
    return "\u2014";
  }

  return formatDiff(metric.diff, metric.format);
}

function diffClass(metric: MetricComparison) {
  if (metric.status === "ahead") {
    return "text-[var(--accent)]";
  }

  if (metric.status === "even" || metric.status === "neutral") {
    return "text-[var(--text-faint)]";
  }

  return "text-[var(--text-dim)]";
}

function diffTextClass(metric: MetricComparison) {
  return [
    "border border-[var(--border)] px-3 py-2 text-right font-mono tabular-nums",
    metric.status === "neutral" ? "text-xs" : "",
    diffClass(metric),
  ]
    .filter(Boolean)
    .join(" ");
}

function ChartGlyph() {
  return (
    <svg
      aria-hidden="true"
      className="h-3.5 w-3.5"
      viewBox="0 0 16 16"
      fill="none"
    >
      <path
        d="M2 12.5h12M3.5 10l2.5-3 2 2 4-5"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.5"
      />
    </svg>
  );
}

function MetricLabel({
  metric,
  nicknameA,
  nicknameB,
}: {
  metric: MetricComparison;
  nicknameA: string;
  nicknameB: string;
}) {
  const chartMetric = chartMetricByKey.get(metric.key);
  const label = (
    <>
      <span className="block text-sm text-[var(--text)]">
        {metric.label}
      </span>
      <span className="mt-1 hidden text-xs text-[var(--text-dim)] md:block">
        {hintsByMetricKey.get(metric.key) ?? ""}
      </span>
    </>
  );

  if (!chartMetric) {
    return label;
  }

  const params = new URLSearchParams({
    playerA: nicknameA,
    playerB: nicknameB,
    metric: chartMetric,
  });

  return (
    <Link
      href={`/chart?${params.toString()}`}
      target="_blank"
      rel="noreferrer"
      className="group inline-flex max-w-full flex-col focus:outline focus:outline-2 focus:outline-offset-2 focus:outline-[var(--text)]"
    >
      <span className="flex items-center gap-1.5 text-sm text-[var(--text)] group-hover:underline">
        <span>{metric.label}</span>
        <ChartGlyph />
        <span className="sr-only">Open match dynamics chart</span>
      </span>
      <span className="mt-1 hidden text-xs text-[var(--text-dim)] md:block">
        {hintsByMetricKey.get(metric.key) ?? ""}
      </span>
    </Link>
  );
}

export function MetricComparisonTable({
  comparison,
  nicknameA,
  nicknameB,
}: MetricComparisonTableProps) {
  const headerA = truncateNickname(nicknameA);
  const headerB = truncateNickname(nicknameB);

  return (
    <table className="block w-full border-collapse text-sm">
      <thead className="block">
        <tr className={metricGridRow}>
          <th
            scope="col"
            className="border border-[var(--border)] px-3 py-2 text-left font-medium text-[var(--text-dim)]"
          >
            Metric
          </th>
          <th
            scope="col"
            className="whitespace-nowrap border border-[var(--border)] px-3 py-2 text-right font-medium text-[var(--text-dim)]"
          >
            {headerA}
          </th>
          <th
            scope="col"
            className="whitespace-nowrap border border-[var(--border)] px-3 py-2 text-right font-medium text-[var(--text-dim)]"
          >
            {headerB}
          </th>
          <th
            scope="col"
            className="border border-[var(--border)] px-3 py-2 text-right font-medium text-[var(--text-dim)]"
          >
            Diff
          </th>
          <th
            scope="col"
            className="hidden border border-[var(--border)] px-3 py-2 text-right font-medium text-[var(--text-dim)] md:block"
          >
            Status
          </th>
        </tr>
      </thead>
      <tbody className="block">
        {comparison.groups.map((group) => (
          <Fragment key={group.group}>
            <tr className="grid grid-cols-1">
              <th
                scope="rowgroup"
                colSpan={5}
                className="border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-left font-semibold text-[var(--text)]"
              >
                {groupLabels[group.group]} {"\u2014"}{" "}
                {verdictLabels(group.verdict, nicknameA, nicknameB)}
              </th>
            </tr>
            {group.metrics.map((metric) => (
              <tr key={metric.key} className={metricGridRow}>
                <th
                  scope="row"
                  className="border border-[var(--border)] px-3 py-2 text-left font-normal"
                >
                  <MetricLabel
                    metric={metric}
                    nicknameA={nicknameA}
                    nicknameB={nicknameB}
                  />
                </th>
                <td className="border border-[var(--border)] px-3 py-2 text-right font-mono text-base font-medium tabular-nums text-[var(--text)]">
                  {formatMetricValue(metric.valueA, metric.format)}
                </td>
                <td className="border border-[var(--border)] px-3 py-2 text-right font-mono text-base font-medium tabular-nums text-[var(--text-dim)]">
                  {formatMetricValue(metric.valueB, metric.format)}
                </td>
                <td className={diffTextClass(metric)}>
                  {displayDiff(metric)}
                </td>
                <td className="hidden border border-[var(--border)] px-3 py-2 text-right md:block">
                  <MetricSignal status={metric.status} />
                </td>
              </tr>
            ))}
          </Fragment>
        ))}
      </tbody>
    </table>
  );
}
