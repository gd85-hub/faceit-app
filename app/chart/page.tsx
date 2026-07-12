import { Suspense } from "react";
import { MatchSeriesChartPage } from "@/components/MatchSeriesChartPage";
import { SiteHeader } from "@/components/SiteHeader";

function ChartPageFallback() {
  return (
    <div className="mx-auto max-w-5xl px-4">
      <div className="flex items-center gap-3 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-5 text-[var(--text)]">
        <div
          className="h-5 w-5 animate-spin rounded-full border-2 border-[var(--border)] border-t-[var(--text)]"
          aria-hidden="true"
        />
        <span>Collecting last 20 matches…</span>
      </div>
    </div>
  );
}

export default function ChartPage() {
  return (
    <>
      <SiteHeader />
      <main className="min-h-[calc(100vh-56px)] bg-[var(--bg)] py-8 text-[var(--text)]">
        <Suspense fallback={<ChartPageFallback />}>
          <MatchSeriesChartPage />
        </Suspense>
      </main>
    </>
  );
}
