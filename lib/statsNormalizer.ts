import { metricDefinitions } from "@/lib/metricDefinitions";
import type {
  DerivedMetricDefinition,
  MetricDefinition,
  MetricKey,
  SourceMetricDefinition,
} from "@/types/metrics";
import type { MetricValue, NormalizedStats } from "@/types/stats";

type ObjectLike = Record<string, unknown>;

function isObjectLike(value: unknown): value is ObjectLike {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseMetricValue(
  rawValue: unknown,
  definition: SourceMetricDefinition,
): MetricValue {
  if (rawValue === "" || rawValue === null || rawValue === undefined) {
    return null;
  }

  const numberValue = Number(rawValue);
  if (!Number.isFinite(numberValue)) {
    return null;
  }

  if (definition.format === "integer") {
    return Math.round(numberValue);
  }

  if (definition.format === "percent" && definition.sourceScale === 100) {
    return Math.round(numberValue * 1000) / 10;
  }

  return numberValue;
}

function isDerivedDefinition(
  definition: MetricDefinition,
): definition is DerivedMetricDefinition {
  return "compute" in definition;
}

function normalizeRecentResults(rawLifetime: ObjectLike): ("W" | "L")[] | null {
  const rawResults = rawLifetime["Recent Results"];

  if (!Array.isArray(rawResults) || rawResults.length === 0) {
    return null;
  }

  const results = rawResults.flatMap((result) => {
    if (result === "1") {
      return ["W" as const];
    }

    if (result === "0") {
      return ["L" as const];
    }

    return [];
  });

  return results.length > 0 ? results : null;
}

export function normalizeStats(raw: unknown): NormalizedStats | null {
  if (!isObjectLike(raw) || !isObjectLike(raw.lifetime)) {
    return null;
  }

  const metrics = {} as Record<MetricKey, MetricValue>;

  for (const definition of metricDefinitions) {
    metrics[definition.key] =
      isDerivedDefinition(definition)
        ? definition.compute(raw.lifetime)
        : parseMetricValue(raw.lifetime[definition.sourceKey], definition);
  }

  return {
    metrics,
    recentResults: normalizeRecentResults(raw.lifetime),
  };
}
