type ComparisonSummaryProps = {
  summary: string[];
};

export function ComparisonSummary({ summary }: ComparisonSummaryProps) {
  if (summary.length === 0) {
    return null;
  }

  return (
    <section className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4">
      <h2 className="mb-3 text-sm font-semibold text-[var(--text)]">
        Summary
      </h2>
      <ul className="space-y-2 text-sm text-[var(--text-dim)]">
        {summary.slice(0, 3).map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
    </section>
  );
}
