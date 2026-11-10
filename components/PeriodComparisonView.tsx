import Link from "next/link";
import { PeriodTrendChart } from "@/components/PeriodTrendChart";
import { formatDiff, formatMetricValue } from "@/lib/formatters";
import {
  MIN_PERIOD_MATCHES,
  PERIOD_WINDOWS,
  matchKd,
  type PeriodComparison,
  type PeriodMetricView,
} from "@/lib/periodMetrics";
import { SEASON_RESET_NOTE } from "@/lib/season";

function WindowToggle({
  nickname,
  window,
}: {
  nickname: string;
  window: PeriodComparison["window"];
}) {
  return (
    <div className="flex gap-2" aria-label="Period length">
      {PERIOD_WINDOWS.map((option) => {
        const params = new URLSearchParams({
          player: nickname,
          window: String(option),
        });
        const active = option === window;

        return (
          <Link
            key={option}
            href={`/progress?${params.toString()}`}
            aria-current={active ? "page" : undefined}
            className={[
              "rounded-md border px-3 py-1.5 text-sm font-medium transition-colors focus:outline focus:outline-2 focus:outline-offset-2 focus:outline-[var(--text)]",
              active
                ? "border-[var(--text)] text-[var(--text)]"
                : "border-[var(--border)] text-[var(--text-dim)] hover:text-[var(--text)]",
            ].join(" ")}
          >
            {option} matches
          </Link>
        );
      })}
    </div>
  );
}

function MetricTable({
  metrics,
  window,
  showChange = true,
}: {
  metrics: PeriodMetricView[];
  window: number;
  showChange?: boolean;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[420px] text-sm">
        <thead>
          <tr className="border-b border-[var(--border)] text-left text-xs text-[var(--text-dim)]">
            <th className="py-2 pr-3 font-medium">Metric</th>
            <th className="px-3 py-2 text-right font-medium">Last {window}</th>
            <th className="px-3 py-2 text-right font-medium">
              Previous {window}
            </th>
            <th className="py-2 pl-3 text-right font-medium">Change</th>
          </tr>
        </thead>
        <tbody>
          {metrics.map((metric) => (
            <tr
              key={metric.key}
              className="border-b border-[var(--border)] last:border-b-0"
            >
              <td className="py-2 pr-3">
                <div className="font-medium text-[var(--text)]">
                  {metric.label}
                </div>
                <div className="text-xs text-[var(--text-dim)]">
                  {metric.hint}
                </div>
              </td>
              <td className="px-3 py-2 text-right font-mono tabular-nums">
                {formatMetricValue(metric.valueA, metric.format)}
              </td>
              <td className="px-3 py-2 text-right font-mono tabular-nums text-[var(--text-dim)]">
                {formatMetricValue(metric.valueB, metric.format)}
              </td>
              <td className="py-2 pl-3 text-right font-mono tabular-nums">
                {showChange ? (
                  formatDiff(metric.diff, metric.format)
                ) : (
                  <span className="font-sans text-xs text-[var(--text-dim)]">
                    small sample
                  </span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-5">
      {children}
    </section>
  );
}

export function PeriodComparisonView({
  nickname,
  data,
}: {
  nickname: string;
  data: PeriodComparison;
}) {
  const { window, improved, steady, dipped, uncertain } = data;
  const chartPoints = data.chartMatches.map((match) => ({
    date: match.finished_at,
    map: match.map,
    result: match.result,
    kd: matchKd(match),
  }));

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {nickname}: last {window} vs previous {window}
          </h1>
          <p className="mt-2 text-sm text-[var(--text-dim)]">
            The same player, two stretches of matches side by side.
          </p>
        </div>
        <WindowToggle nickname={nickname} window={window} />
      </div>

      {data.smallSample ? (
        <p className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4 text-sm text-[var(--text-dim)]">
          Small sample: {data.recentCount} recent and {data.previousCount}{" "}
          earlier matches. With fewer than {MIN_PERIOD_MATCHES} matches in a
          stretch, a few games swing every number, so nothing here counts as a
          drop yet.
        </p>
      ) : null}

      {data.crossesSeason ? (
        <p className="rounded-lg border border-[var(--accent)] p-4 text-sm text-[var(--text)]">
          {SEASON_RESET_NOTE}
        </p>
      ) : null}

      {data.smallSample ? null : (
      <Card>
        <h2 className="mb-1 text-lg font-semibold">What got better</h2>
        {improved.length > 0 ? (
          <MetricTable metrics={improved} window={window} />
        ) : (
          <p className="text-sm text-[var(--text-dim)]">
            No big jumps this time. That is normal over {window} matches;
            progress often shows up a stretch later.
          </p>
        )}
        {steady.length > 0 ? (
          <p className="mt-4 text-sm text-[var(--text-dim)]">
            Holding steady:{" "}
            {steady.map((metric) => metric.label).join(", ")}.
          </p>
        ) : null}
      </Card>
      )}

      {uncertain.length > 0 && !data.smallSample ? (
        <Card>
          <h2 className="mb-1 text-lg font-semibold">Small sample</h2>
          <p className="mb-3 text-sm text-[var(--text-dim)]">
            Too few matches behind these numbers to call a change either way.
          </p>
          <MetricTable metrics={uncertain} window={window} showChange={false} />
        </Card>
      ) : null}

      {data.smallSample && uncertain.length > 0 ? (
        <Card>
          <h2 className="mb-3 text-lg font-semibold">The numbers so far</h2>
          <MetricTable metrics={uncertain} window={window} showChange={false} />
        </Card>
      ) : null}

      {dipped.length > 0 ? (
        <details className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-5">
          <summary className="cursor-pointer text-sm font-medium text-[var(--text-dim)] hover:text-[var(--text)]">
            Where it dipped ({dipped.length})
          </summary>
          <p className="mb-3 mt-3 text-sm text-[var(--text-dim)]">
            Every player has stretches like this. Over {window} matches a few
            rough games move these numbers a lot.
          </p>
          <MetricTable metrics={dipped} window={window} />
        </details>
      ) : null}

      <Card>
        <h2 className="mb-1 text-lg font-semibold">K/D match by match</h2>
        <p className="mb-3 text-sm text-[var(--text-dim)]">
          Line: 5-match average. Dots: single matches.
        </p>
        <PeriodTrendChart
          points={chartPoints}
          recentStartIndex={data.previousCount}
          recentLabel={`last ${window}`}
        />
      </Card>
    </div>
  );
}
