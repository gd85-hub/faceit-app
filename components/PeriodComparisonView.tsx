import Link from "next/link";
import { PeriodTrendChart } from "@/components/PeriodTrendChart";
import { formatMetricValue } from "@/lib/formatters";
import { displayChange } from "@/lib/periodDisplay";
import {
  PERIOD_WINDOWS,
  matchKd,
  type PeriodComparison,
  type PeriodMetricView,
} from "@/lib/periodMetrics";
import { periodVerdict } from "@/lib/periodVerdict";
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
            <th
              className="py-2 pl-3 text-right font-medium"
              title="+ means better, even for metrics where smaller is better"
            >
              Better / worse
            </th>
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
                  <ChangeCell metric={metric} />
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

const ARROWS = { up: "▲", down: "▼", flat: "=" } as const;

function ChangeCell({ metric }: { metric: PeriodMetricView }) {
  const change = displayChange(metric);
  const toneClass =
    change.tone === "better"
      ? "text-[var(--accent)]"
      : change.tone === "worse"
        ? "text-[var(--text-dim)]"
        : "text-[var(--text-faint)]";

  return (
    <span className={`inline-flex items-center gap-1.5 ${toneClass}`}>
      <span aria-hidden="true" className="text-[10px]">
        {ARROWS[change.arrow]}
      </span>
      <span>{change.text}</span>
      <span className="sr-only">
        {change.tone === "flat" ? "no change" : change.tone}
      </span>
    </span>
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
  const verdict = periodVerdict(data);
  const chartPoints = data.chartMatches.map((match) => ({
    date: match.finished_at,
    map: match.map,
    result: match.result,
    kd: matchKd(match),
  }));

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4">
      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-[var(--text-dim)]">
            {nickname} · last {window} matches compared with the {window}{" "}
            before
          </p>
          <WindowToggle nickname={nickname} window={window} />
        </div>
        <div className="max-w-3xl space-y-3">
          {verdict.map((sentence, index) =>
            index === 0 ? (
              <h1
                key={sentence}
                className="text-2xl font-semibold leading-snug tracking-tight"
              >
                {sentence}
              </h1>
            ) : (
              <p key={sentence} className="text-lg leading-relaxed">
                {sentence}
              </p>
            ),
          )}
          {data.crossesSeason ? (
            <p className="text-sm text-[var(--accent)]">{SEASON_RESET_NOTE}</p>
          ) : null}
        </div>
      </section>

      <details className="group space-y-6">
        <summary className="inline-flex cursor-pointer list-none items-center gap-2 rounded-md border border-[var(--border)] px-4 py-2 text-sm font-medium text-[var(--text)] hover:border-[var(--text)] focus:outline focus:outline-2 focus:outline-offset-2 focus:outline-[var(--text)]">
          <span className="group-open:hidden">What exactly changed</span>
          <span className="hidden group-open:inline">Hide details</span>
        </summary>

        <div className="mt-6 space-y-6">
          {improved.length > 0 || steady.length > 0 ? (
            <Card>
              <h2 className="mb-1 text-lg font-semibold">What got better</h2>
              {improved.length > 0 ? (
                <MetricTable metrics={improved} window={window} />
              ) : null}
              {steady.length > 0 ? (
                <p className="mt-4 text-sm text-[var(--text-dim)]">
                  Holding steady:{" "}
                  {steady.map((metric) => metric.label).join(", ")}.
                </p>
              ) : null}
            </Card>
          ) : null}

          {uncertain.length > 0 ? (
            <Card>
              <h2 className="mb-1 text-lg font-semibold">Small sample</h2>
              <p className="mb-3 text-sm text-[var(--text-dim)]">
                Too few matches behind these numbers to call a change either
                way.
              </p>
              <MetricTable
                metrics={uncertain}
                window={window}
                showChange={false}
              />
            </Card>
          ) : null}

          {dipped.length > 0 ? (
            <Card>
              <h2 className="mb-1 text-lg font-semibold">Where it dipped</h2>
              <p className="mb-3 text-sm text-[var(--text-dim)]">
                Every player has stretches like this. Over {window} matches a
                few rough games move these numbers a lot.
              </p>
              <MetricTable metrics={dipped} window={window} />
            </Card>
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
      </details>
    </div>
  );
}
