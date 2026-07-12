import type { MetricStatus } from "@/types/comparison";

type MetricSignalProps = {
  status: MetricStatus;
};

function symbolForStatus(status: MetricStatus) {
  switch (status) {
    case "ahead":
      return "\u2191";
    case "behind":
      return "\u2193";
    case "even":
      return "=";
    case "neutral":
    case "unknown":
      return "\u2014";
  }
}

function accessibleLabel(status: MetricStatus) {
  switch (status) {
    case "ahead":
      return "Ahead";
    case "behind":
      return "Behind";
    case "even":
      return "Even";
    case "neutral":
      return "Not compared";
    case "unknown":
      return "No data";
  }
}

export function MetricSignal({ status }: MetricSignalProps) {
  const toneClass =
    status === "ahead"
      ? "text-[var(--accent)]"
      : status === "neutral" || status === "unknown"
        ? "text-[var(--text-faint)]"
        : "text-[var(--text-dim)]";

  return (
    <span
      className={[
        "inline-flex min-w-6 justify-end tabular-nums",
        toneClass,
      ].join(" ")}
    >
      <span aria-hidden="true">{symbolForStatus(status)}</span>
      <span className="sr-only">{accessibleLabel(status)}</span>
    </span>
  );
}
