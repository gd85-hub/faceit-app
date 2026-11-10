export default function ProgressLoading() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <div className="flex items-center gap-3 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-5 text-[var(--text)]">
        <div
          className="h-5 w-5 animate-spin rounded-full border-2 border-[var(--border)] border-t-[var(--text)]"
          aria-hidden="true"
        />
        <span>Collecting matches…</span>
      </div>
    </div>
  );
}
