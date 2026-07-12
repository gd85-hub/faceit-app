import { formatDiff, formatMetricValue } from "@/lib/formatters";
import { groupHints, groupLabels, verdictLabels } from "@/lib/labels";
import type { GroupComparison, MetricComparison } from "@/types/comparison";

type GroupCardProps = {
  group: GroupComparison;
  nicknameA: string;
  nicknameB: string;
  className?: string;
};

function sortedMetrics(group: GroupComparison) {
  const active = group.metrics.filter((metric) => metric.direction !== "neutral");
  const neutral = group.metrics.filter((metric) => metric.direction === "neutral");

  return [...active, ...neutral];
}

function truncateNickname(nickname: string) {
  return nickname.length > 12 ? `${nickname.slice(0, 12)}...` : nickname;
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
    "text-right font-mono tabular-nums",
    metric.status === "neutral" ? "text-xs" : "",
    diffClass(metric),
  ]
    .filter(Boolean)
    .join(" ");
}

export function GroupCard({
  group,
  nicknameA,
  nicknameB,
  className,
}: GroupCardProps) {
  return (
    <section
      className={[
        "rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <div className="mb-5 grid grid-cols-[minmax(0,1fr)_3.5rem_3.5rem_3.5rem] gap-3">
        <div>
          <h2 className="text-lg font-semibold text-[var(--text)]">
            {groupLabels[group.group]}
          </h2>
          <p className="mt-1 text-xs text-[var(--text-dim)]">{groupHints[group.group]}</p>
          <p className="mt-1 text-xs text-[var(--text-dim)]">
            {verdictLabels(group.verdict, nicknameA, nicknameB)}
          </p>
        </div>
        <span className="pt-1 text-right text-xs text-[var(--text-dim)]">
          {truncateNickname(nicknameA)}
        </span>
        <span className="pt-1 text-right text-xs text-[var(--text-dim)]">
          {truncateNickname(nicknameB)}
        </span>
        <span className="pt-1 text-right text-xs text-[var(--text-dim)]">Diff</span>
      </div>

      <div className="space-y-4">
        {sortedMetrics(group).map((metric) => (
          <div
            key={metric.key}
            className="grid grid-cols-[minmax(0,1fr)_3.5rem_3.5rem_3.5rem] gap-3 text-sm"
          >
            <div className="min-w-0">
              <p className="truncate text-sm font-normal text-[var(--text)]">
                {metric.label}
              </p>
            </div>
            <span className="text-right font-mono text-base font-medium tabular-nums text-[var(--text)]">
              {formatMetricValue(metric.valueA, metric.format)}
            </span>
            <span className="text-right font-mono text-base font-medium tabular-nums text-[var(--text-dim)]">
              {formatMetricValue(metric.valueB, metric.format)}
            </span>
            <span className={diffTextClass(metric)}>
              {displayDiff(metric)}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}
