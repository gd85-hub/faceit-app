import { formatDiff } from "@/lib/formatters";
import type { MetricComparison } from "@/types/comparison";

type ChangeInput = Pick<MetricComparison, "diff" | "direction" | "format">;

export type ChangeDisplay = {
  /** Signed so that "+" always means better for this metric. */
  text: string;
  arrow: "up" | "down" | "flat";
  tone: "better" | "worse" | "flat";
};

/**
 * Change in "better is positive" terms. For a lower-is-better metric (K/D
 * spread) a rise from 0.37 to 0.61 is shown as -0.24 with a down arrow,
 * because the player got less steady.
 */
export function betterSignedDiff(metric: ChangeInput): number | null {
  if (metric.diff === null) {
    return null;
  }

  return metric.direction === "lower" ? -metric.diff : metric.diff;
}

export function isImprovement(metric: ChangeInput) {
  const signed = betterSignedDiff(metric);
  return signed !== null && signed > 0 && metric.direction !== "neutral";
}

export function isWorse(metric: ChangeInput) {
  const signed = betterSignedDiff(metric);
  return signed !== null && signed < 0 && metric.direction !== "neutral";
}

export function displayChange(metric: ChangeInput): ChangeDisplay {
  const signed = betterSignedDiff(metric);
  const text = formatDiff(signed, metric.format);

  if (signed === null || signed === 0 || metric.direction === "neutral") {
    return { text, arrow: "flat", tone: "flat" };
  }

  return signed > 0
    ? { text, arrow: "up", tone: "better" }
    : { text, arrow: "down", tone: "worse" };
}
