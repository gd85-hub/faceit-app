type RecentFormProps = {
  recentResults: ("W" | "L")[] | null;
};

export function RecentForm({ recentResults }: RecentFormProps) {
  const label = recentResults
    ? `Last 5 matches: ${recentResults.join(" ")}`
    : "No recent matches";

  return (
    <div>
      {recentResults ? (
        <div
          aria-label={label}
          className="flex gap-1.5 font-mono text-sm tabular-nums"
        >
          {recentResults.slice(0, 5).map((result, index) => (
            <span
              key={`${result}-${index}`}
              className={
                result === "W"
                  ? "text-[var(--accent)]"
                  : "text-[var(--text-faint)]"
              }
            >
              {result}
            </span>
          ))}
        </div>
      ) : (
        <p aria-label={label} className="font-mono text-sm text-[var(--text-faint)]">
          No recent matches
        </p>
      )}
      <p className="mt-1 text-xs text-[var(--text-dim)]">last 5, oldest first</p>
    </div>
  );
}
