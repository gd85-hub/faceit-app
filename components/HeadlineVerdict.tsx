import { groupLabels } from "@/lib/labels";
import type { ComparisonResult, GroupComparison } from "@/types/comparison";

type HeadlineVerdictProps = {
  comparison: ComparisonResult;
  nicknameA: string;
  nicknameB: string;
};

type GroupBucket = {
  groupsA: GroupComparison["group"][];
  groupsB: GroupComparison["group"][];
  evenGroups: GroupComparison["group"][];
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

export function groupVerdictBuckets(comparison: ComparisonResult): GroupBucket {
  return {
    groupsA: comparison.groups
      .filter((group) => group.verdict === "A_stronger")
      .map((group) => group.group),
    groupsB: comparison.groups
      .filter((group) => group.verdict === "B_stronger")
      .map((group) => group.group),
    evenGroups: comparison.groups
      .filter(
        (group) => group.verdict === "close" || group.verdict === "insufficient",
      )
      .map((group) => group.group),
  };
}

export function headlineSummary(
  { groupsA, groupsB, evenGroups }: GroupBucket,
  nicknameA: string,
  nicknameB: string,
) {
  const parts: string[] = [];

  if (groupsA.length > 0) {
    parts.push(`${nicknameA} is stronger in ${formatGroupList(groupsA)}`);
  }

  if (groupsB.length > 0) {
    parts.push(`${nicknameB} is stronger in ${formatGroupList(groupsB)}`);
  }

  if (evenGroups.length > 0) {
    parts.push(`${formatGroupList(evenGroups)} are even`);
  }

  return `${parts.join("; ")}.`;
}

export function groupVerdictText(
  group: GroupComparison,
  nicknameA: string,
  nicknameB: string,
) {
  switch (group.verdict) {
    case "A_stronger":
      return `${nicknameA} higher`;
    case "B_stronger":
      return `${nicknameB} higher`;
    case "close":
      return "even";
    case "insufficient":
      return "not enough data";
  }
}

function verdictClass(group: GroupComparison) {
  if (group.verdict === "A_stronger" || group.verdict === "B_stronger") {
    return "text-[var(--accent)]";
  }

  return "text-[var(--text-dim)]";
}

export function HeadlineVerdict({
  comparison,
  nicknameA,
  nicknameB,
}: HeadlineVerdictProps) {
  const buckets = groupVerdictBuckets(comparison);

  return (
    <section className="rounded-lg border border-[var(--border)] bg-[var(--surface-2)] p-7 shadow-sm">
      <div>
        <p className="text-3xl font-bold tracking-tight text-[var(--text)] md:text-4xl">
          {headlineSummary(buckets, nicknameA, nicknameB)}
        </p>

        <div className="mt-7 border-t border-[var(--border)] pt-5">
          <dl className="space-y-3">
            {comparison.groups.map((group) => (
              <div
                key={group.group}
                className="grid grid-cols-[minmax(0,1fr)_auto] gap-4 text-sm"
              >
                <dt className="text-[var(--text)]">{groupLabels[group.group]}</dt>
                <dd className={verdictClass(group)}>
                  {groupVerdictText(group, nicknameA, nicknameB)}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </div>
    </section>
  );
}
