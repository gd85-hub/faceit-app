import { formatMetricValue } from "@/lib/formatters";
import type { PeriodComparison, PeriodMetricView } from "@/lib/periodMetrics";
import type { MetricKey } from "@/types/metrics";

/** Metrics that describe the player's own play, as opposed to team results. */
const PERSONAL_METRICS: MetricKey[] = ["avgKd", "kda", "adr"];
const MAX_HEADLINE_METRICS = 2;

/** True when the change moved in the "better" direction for this metric. */
export function isImprovement(metric: PeriodMetricView) {
  if (metric.diff === null || metric.diff === 0) {
    return false;
  }

  return metric.direction === "lower" ? metric.diff < 0 : metric.diff > 0;
}

function isWorse(metric: PeriodMetricView) {
  return metric.diff !== null && metric.diff !== 0 && !isImprovement(metric);
}

/** Changed by more than likely noise, with enough matches to say so. */
function moved(metric: PeriodMetricView) {
  return (
    !metric.smallSample &&
    (metric.changeLevel === "significant" || metric.changeLevel === "likely")
  );
}

function byZ(a: PeriodMetricView, b: PeriodMetricView) {
  return (b.changeZ ?? 0) - (a.changeZ ?? 0);
}

function headlineMetrics(metrics: PeriodMetricView[]) {
  const usable = metrics.filter((metric) => !metric.smallSample);
  const significant = usable.filter(
    (metric) => metric.changeLevel === "significant",
  );
  const pool =
    significant.length > 0
      ? significant
      : usable.filter((metric) => metric.changeLevel === "likely");

  return pool.toSorted(byZ).slice(0, MAX_HEADLINE_METRICS);
}

function lowerFirst(label: string) {
  return /^[A-Z][a-z]/.test(label)
    ? label[0].toLowerCase() + label.slice(1)
    : label;
}

function describeChange(metric: PeriodMetricView) {
  const from = formatMetricValue(metric.valueB, metric.format);
  const to = formatMetricValue(metric.valueA, metric.format);
  return `your ${lowerFirst(metric.label)} went from ${from} to ${to}`;
}

function joinChanges(metrics: PeriodMetricView[]) {
  const [first, second] = metrics.map(describeChange);
  return second ? `${first}, and ${second}` : first;
}

function capitalize(text: string) {
  return text[0].toUpperCase() + text.slice(1);
}

function shiftSentence(metrics: PeriodMetricView[]) {
  const level = metrics[0].changeLevel;
  const allBetter = metrics.every(isImprovement);
  const allWorse = metrics.every(isWorse);

  if (level === "significant") {
    if (allBetter) {
      return "That's bigger than the normal ups and downs, so it's a real step up.";
    }

    if (allWorse) {
      return "That's more than the normal ups and downs, so it's a real dip for now. Dips like this usually pass.";
    }

    return "Both moves are bigger than the normal ups and downs.";
  }

  return "That's probably a real change, but it could still be normal ups and downs. The next matches will tell.";
}

function meaningSentence(metrics: PeriodMetricView[]) {
  const winRate = metrics.find((metric) => metric.key === "winRate");
  const personal = metrics.filter((metric) =>
    PERSONAL_METRICS.includes(metric.key),
  );
  const winsUp = winRate !== undefined && moved(winRate) && isImprovement(winRate);
  const winsDown = winRate !== undefined && moved(winRate) && isWorse(winRate);
  const personalUp = personal.some(
    (metric) => moved(metric) && isImprovement(metric),
  );
  const personalDown = personal.some((metric) => moved(metric) && isWorse(metric));

  if (winsUp && personalDown) {
    return "You're winning more even though your own numbers dipped a bit, so the wins are coming from the whole team.";
  }

  if (winsUp && !personalUp) {
    return "You're winning more while your own numbers stayed about the same, so the team is doing more with the same play from you.";
  }

  if (winsDown && personalUp) {
    return "Your own play got better, but the wins haven't caught up yet. With random teammates that happens a lot.";
  }

  if (personalUp && !winsUp && !winsDown) {
    return "Your own numbers went up, and the wins haven't moved yet. They often follow a bit later.";
  }

  return null;
}

/**
 * Two or three plain sentences answering "am I playing better?".
 * Never claims movement that is within normal match-to-match swing.
 */
export function periodVerdict(data: PeriodComparison): string[] {
  if (data.smallSample) {
    return [
      `There are only ${data.previousCount} matches before your last ${data.recentCount}. That's a small sample, so it's too early to say whether anything changed.`,
      "Play a few more matches and check back.",
    ];
  }

  const metrics = data.metrics;
  const headline = headlineMetrics(metrics);

  if (headline.length === 0) {
    return [
      `No real shifts over these ${data.window} matches: everything is holding steady.`,
    ];
  }

  const changeWord = headline.length > 1 ? "changes" : "change";
  const sentences = [
    `The biggest ${changeWord}: ${joinChanges(headline)}.`,
    shiftSentence(headline),
  ];
  const meaning = meaningSentence(metrics);

  if (meaning) {
    sentences.push(meaning);
  }

  return sentences.map(capitalize);
}
