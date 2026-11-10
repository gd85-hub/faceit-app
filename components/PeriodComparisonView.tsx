import Link from "next/link";
import { PeriodTrendChart } from "@/components/PeriodTrendChart";
import { formatMetricValue } from "@/lib/formatters";
import {
  CHANGE_LEVEL_LABELS,
  displayChange,
  isWorse,
  sortByChange,
} from "@/lib/periodDisplay";
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

function LevelCell({ metric }: { metric: PeriodMetricView }) {
  if (metric.smallSample || metric.changeLevel === null) {
    return <span className="text-[var(--text-faint)]">Small sample</span>;
  }

  return (
    <span
      className={
        metric.changeLevel === "noise"
          ? "text-[var(--text-faint)]"
          : "text-[var(--text)]"
      }
    >
      {CHANGE_LEVEL_LABELS[metric.changeLevel]}
    </span>
  );
}

function MetricTable({
  metrics,
  window,
}: {
  metrics: PeriodMetricView[];
  window: number;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[520px] text-sm">
        <thead>
          <tr className="border-b border-[var(--border)] text-left text-xs text-[var(--text-dim)]">
            <th className="py-2 pr-3 font-medium">Metric</th>
            <th className="px-3 py-2 text-right font-medium">Last {window}</th>
            <th className="px-3 py-2 text-right font-medium">
              Previous {window}
            </th>
            <th
              className="px-3 py-2 text-right font-medium"
              title="+ means better, even for metrics where smaller is better"
            >
              Better / worse
            </th>
            <th className="py-2 pl-3 text-right font-medium">Is it real?</th>
          </tr>
        </thead>
        <tbody>
          {sortByChange(metrics).map((metric) => (
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
              <td className="px-3 py-2 text-right font-mono tabular-nums">
                <ChangeCell metric={metric} />
              </td>
              <td className="py-2 pl-3 text-right text-xs">
                <LevelCell metric={metric} />
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
  const { window } = data;
  const hasRealDip = data.metrics.some(
    (metric) =>
      !metric.smallSample &&
      metric.changeLevel !== "noise" &&
      metric.changeLevel !== null &&
      isWorse(metric),
  );
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
          <Card>
            <h2 className="mb-1 text-lg font-semibold">All the numbers</h2>
            <p className="mb-3 text-sm text-[var(--text-dim)]">
              Biggest changes first, up or down. &ldquo;Normal swing&rdquo;
              means the difference is no bigger than the usual ups and downs
              between matches.
              {hasRealDip
                ? ` Every player has rough stretches, and over ${window} matches a few bad games move these numbers a lot.`
                : ""}
            </p>
            <MetricTable metrics={data.metrics} window={window} />
          </Card>

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
