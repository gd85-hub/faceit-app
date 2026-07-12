import { describe, expect, it } from "vitest";
import {
  formatDiff,
  formatMetricValue,
  formatPercent,
  formatPercentagePoints,
} from "@/lib/formatters";

describe("formatMetricValue", () => {
  it("formats values by metric format", () => {
    expect(formatMetricValue(53, "percent")).toBe("53%");
    expect(formatMetricValue(43, "percent")).toBe("43%");
    expect(formatMetricValue(1.13, "ratio")).toBe("1.13");
    expect(formatMetricValue(0.7324964, "ratio")).toBe("0.73");
    expect(formatMetricValue(81, "number")).toBe("81");
    expect(formatMetricValue(81.03, "number")).toBe("81.03");
    expect(formatMetricValue(81.034, "number")).toBe("81.03");
    expect(formatMetricValue(91.21, "number")).toBe("91.21");
    expect(formatMetricValue(3.60, "number")).toBe("3.6");
    expect(formatMetricValue(1259, "integer")).toBe("1259");
  });

  it("formats null and non-finite values as dashes", () => {
    expect(formatMetricValue(null, "number")).toBe("\u2014");
    expect(formatMetricValue(Number.NaN, "number")).toBe("\u2014");
    expect(formatMetricValue(Infinity, "number")).toBe("\u2014");
  });
});

describe("formatDiff", () => {
  it("formats signed diffs by metric format", () => {
    expect(formatDiff(2, "percent")).toBe("+2 pp");
    expect(formatDiff(-0.13, "ratio")).toBe("-0.13");
    expect(formatDiff(0, "integer")).toBe("0");
    expect(formatDiff(0, "percent")).toBe("0 pp");
    expect(formatDiff(-10.179999999999993, "number")).toBe("-10.18");
    expect(formatDiff(-10.188, "number")).toBe("-10.19");
  });

  it("formats null and non-finite diffs as dashes", () => {
    expect(formatDiff(null, "number")).toBe("\u2014");
    expect(formatDiff(Number.NaN, "number")).toBe("\u2014");
    expect(formatDiff(Infinity, "number")).toBe("\u2014");
  });
});

describe("formatPercentagePoints", () => {
  it("formats percentage-point diffs", () => {
    expect(formatPercentagePoints(-7)).toBe("-7 pp");
  });
});

describe("formatPercent", () => {
  it("formats signed percents with zero decimals", () => {
    expect(formatPercent(3.9)).toBe("+4%");
    expect(formatPercent(-0.27)).toBe("0%");
    expect(formatPercent(0)).toBe("0%");
  });

  it("formats null and non-finite percents as dashes", () => {
    expect(formatPercent(null)).toBe("\u2014");
    expect(formatPercent(Number.NaN)).toBe("\u2014");
    expect(formatPercent(Infinity)).toBe("\u2014");
  });
});
