import type { MetricFormat } from "@/types/metrics";

function finite(value: number | null) {
  return value !== null && Number.isFinite(value);
}

function decimalsFor(format: MetricFormat) {
  return format === "ratio" || format === "number" ? 2 : 0;
}

function valueForFormat(value: number, format: MetricFormat) {
  return format === "percent" || format === "integer"
    ? Math.round(value)
    : value;
}

function formattedNumber(value: number, format: MetricFormat) {
  if (format === "ratio" || format === "number") {
    return Number(value.toFixed(2)).toString();
  }

  return value.toFixed(decimalsFor(format));
}

export function formatMetricValue(
  value: number | null,
  format: MetricFormat,
): string {
  if (!finite(value)) {
    return "\u2014";
  }

  const formatted = formattedNumber(valueForFormat(value!, format), format);
  return format === "percent" ? `${formatted}%` : formatted;
}

export function formatDiff(diff: number | null, format: MetricFormat): string {
  if (!finite(diff)) {
    return "\u2014";
  }

  if (format === "percent") {
    return formatPercentagePoints(diff);
  }

  const formattedValue = valueForFormat(diff!, format);
  const sign = formattedValue > 0 ? "+" : "";
  const formatted = formattedNumber(formattedValue, format);
  return `${sign}${formatted}`;
}

export function formatPercentagePoints(diff: number | null): string {
  if (!finite(diff)) {
    return "\u2014";
  }

  const formattedValue = Number(diff!.toFixed(2));
  const sign = formattedValue > 0 ? "+" : "";
  return `${sign}${formattedValue} pp`;
}

export function formatPercent(diffPercent: number | null): string {
  if (!finite(diffPercent)) {
    return "\u2014";
  }

  const rounded = Math.round(diffPercent!);
  const sign = rounded > 0 ? "+" : "";
  return `${sign}${rounded}%`;
}
