import { formatMetricValue } from "@/lib/formatters";
import { groupLabels } from "@/lib/labels";
import type {
  ComparisonResult,
  GroupComparison,
  MetricComparison,
  MetricStatus,
} from "@/types/comparison";

type HeadlineVerdictProps = {
  comparison: ComparisonResult;
  nicknameA: string;
  nicknameB: string;
};

type PlayerSide = "A" | "B";

type MetricColumn = {
  heading: string;
  mode: "stronger" | "closest";
  metrics: MetricComparison[];
};

function groupName(group: GroupComparison["group"]) {
  return groupLabels[group].toLowerCase();
}

function formatGroupList(groups: GroupComparison["group"][]) {
  if (groups.length === 0) {
    return "";
  }

  if (groups.length === 1) {
    return groupName(groups[0]);
  }

  return `${groups.slice(0, -1).map(groupName).join(", ")} and ${groupName(
    groups[groups.length - 1],
  )}`;
}

export function scoreGroups(comparison: ComparisonResult) {
  const groupsA = comparison.groups
    .filter((group) => group.verdict === "A_stronger")
    .map((group) => group.group);
  const groupsB = comparison.groups
    .filter((group) => group.verdict === "B_stronger")
    .map((group) => group.group);
  const closeCount = comparison.groups.filter(
    (group) => group.verdict === "close" || group.verdict === "insufficient",
  ).length;

  return { groupsA, groupsB, closeCount };
}

function scoreLine(
  groupsA: GroupComparison["group"][],
  groupsB: GroupComparison["group"][],
  closeCount: number,
  nicknameA: string,
  nicknameB: string,
) {
  const leader =
    groupsB.length > groupsA.length
      ? { nickname: nicknameB, count: groupsB.length }
      : { nickname: nicknameA, count: groupsA.length };
  const other =
    leader.nickname === nicknameA
      ? { nickname: nicknameB, count: groupsB.length }
      : { nickname: nicknameA, count: groupsA.length };
  const parts = [`${leader.nickname} ${leader.count}`, `${other.count} ${other.nickname}`];

  if (closeCount > 0) {
    parts.push(`${closeCount} close`);
  }

  return parts.join(" \u00b7 ");
}

function summaryLine(
  groupsA: GroupComparison["group"][],
  groupsB: GroupComparison["group"][],
  nicknameA: string,
  nicknameB: string,
) {
  const leaderIsA = groupsA.length >= groupsB.length;
  const leader = leaderIsA
    ? { nickname: nicknameA, groups: groupsA }
    : { nickname: nicknameB, groups: groupsB };
  const other = leaderIsA
    ? { nickname: nicknameB, groups: groupsB }
    : { nickname: nicknameA, groups: groupsA };

  if (groupsA.length === groupsB.length) {
    const clauses = [`${nicknameA} and ${nicknameB} are even overall`];

    if (groupsA.length > 0) {
      clauses.push(`${nicknameA} leads in ${formatGroupList(groupsA)}`);
    }

    if (groupsB.length > 0) {
      clauses.push(`${nicknameB} leads on ${formatGroupList(groupsB)}`);
    }

    return `${clauses.join("; ")}.`;
  }

  const clauses = [
    `${leader.nickname} stronger overall \u2014 leads in ${formatGroupList(
      leader.groups,
    )}`,
  ];

  if (other.groups.length > 0) {
    clauses.push(`${other.nickname} leads on ${formatGroupList(other.groups)}`);
  }

  return `${clauses.join("; ")}.`;
}

function allMetrics(comparison: ComparisonResult) {
  return comparison.groups.flatMap((group) => group.metrics);
}

function metricGap(metric: MetricComparison) {
  return Math.abs(metric.diffPercent ?? 0);
}

function leadingStatus(side: PlayerSide): MetricStatus {
  return side === "A" ? "ahead" : "behind";
}

function trailingStatus(side: PlayerSide): MetricStatus {
  return side === "A" ? "behind" : "ahead";
}

export function columnMetrics(
  comparison: ComparisonResult,
  side: PlayerSide,
  nickname: string,
): MetricColumn {
  const comparable = allMetrics(comparison).filter(
    (metric) =>
      metric.diffPercent !== null &&
      metric.status !== "unknown" &&
      metric.status !== "neutral",
  );
  const leading = comparable.filter(
    (metric) => metric.status === leadingStatus(side),
  );
  const leadingPrimary = leading
    .filter((metric) => metric.significance === "primary")
    .toSorted((aMetric, bMetric) => metricGap(bMetric) - metricGap(aMetric))
    .slice(0, 4);

  if (leadingPrimary.length > 0) {
    const leadingSecondary = leading
      .filter((metric) => metric.significance === "secondary")
      .toSorted((aMetric, bMetric) => metricGap(bMetric) - metricGap(aMetric));

    return {
      heading: `Stronger for ${nickname}`,
      mode: "stronger",
      metrics: [...leadingPrimary, ...leadingSecondary].slice(0, 4),
    };
  }

  return {
    heading: `Closest for ${nickname}`,
    mode: "closest",
    metrics: comparable
      .filter((metric) => metric.status === trailingStatus(side))
      .toSorted((aMetric, bMetric) => metricGap(aMetric) - metricGap(bMetric))
      .slice(0, 3),
  };
}

function playerValue(metric: MetricComparison, side: PlayerSide) {
  return side === "A" ? metric.valueA : metric.valueB;
}

function otherValue(metric: MetricComparison, side: PlayerSide) {
  return side === "A" ? metric.valueB : metric.valueA;
}

function MetricColumnList({
  column,
  side,
}: {
  column: MetricColumn;
  side: PlayerSide;
}) {
  const headingClass =
    column.mode === "stronger" ? "text-[var(--accent)]" : "text-[var(--text-dim)]";
  const valueClass =
    column.mode === "stronger" ? "text-[var(--accent)]" : "text-[var(--text-dim)]";

  return (
    <div>
      <h2 className={["text-sm font-semibold", headingClass].join(" ")}>
        {column.heading}
      </h2>
      {column.metrics.length > 0 ? (
        <ul className="mt-4 space-y-3">
          {column.metrics.map((metric) => (
            <li
              key={metric.key}
              className="grid grid-cols-[minmax(0,1fr)_auto] gap-4 text-sm"
            >
              <span className="truncate text-[var(--text-dim)]">
                {metric.label}
              </span>
              <span className="font-mono tabular-nums text-[var(--text-dim)]">
                <span className={valueClass}>
                  {formatMetricValue(playerValue(metric, side), metric.format)}
                </span>{" "}
                vs {formatMetricValue(otherValue(metric, side), metric.format)}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-4 text-sm text-[var(--text-dim)]">
          No comparable primary metrics.
        </p>
      )}
    </div>
  );
}

export function HeadlineVerdict({
  comparison,
  nicknameA,
  nicknameB,
}: HeadlineVerdictProps) {
  const { groupsA, groupsB, closeCount } = scoreGroups(comparison);
  const columnA = columnMetrics(comparison, "A", nicknameA);
  const columnB = columnMetrics(comparison, "B", nicknameB);

  return (
    <section className="rounded-lg border border-[var(--border)] bg-[var(--surface-2)] p-7 shadow-sm">
      <div>
        <p className="text-4xl font-bold tracking-tight text-[var(--text)]">
          {scoreLine(groupsA, groupsB, closeCount, nicknameA, nicknameB)}
        </p>
        <p className="mt-3 text-sm text-[var(--text-dim)]">
          {summaryLine(groupsA, groupsB, nicknameA, nicknameB)}
        </p>

        <div className="mt-8 grid gap-8 border-t border-[var(--border)] pt-6 md:grid-cols-2">
          <MetricColumnList column={columnA} side="A" />
          <div className="border-[var(--border)] md:border-l md:pl-8">
            <MetricColumnList column={columnB} side="B" />
          </div>
        </div>
      </div>
    </section>
  );
}
