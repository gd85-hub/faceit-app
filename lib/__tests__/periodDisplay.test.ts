import { describe, expect, it } from "vitest";
import { displayChange, isImprovement, isWorse } from "@/lib/periodDisplay";
import { periodMetricDefinitions } from "@/lib/periodMetrics";

function definition(key: string) {
  return periodMetricDefinitions.find((item) => item.key === key)!;
}

describe("displayChange", () => {
  it("flips sign and arrow for a lower-is-better metric that got worse", () => {
    const stability = definition("kdSpread");
    // 0.37 -> 0.61: more spread, less steady.
    const metric = { ...stability, diff: 0.61 - 0.37 };

    expect(stability.direction).toBe("lower");
    expect(displayChange(metric)).toEqual({
      text: "-0.24",
      arrow: "down",
      tone: "worse",
    });
    expect(isWorse(metric)).toBe(true);
    expect(isImprovement(metric)).toBe(false);
  });

  it("shows a lower-is-better metric that fell as an improvement", () => {
    const metric = { ...definition("kdSpread"), diff: -0.1 };

    expect(displayChange(metric)).toEqual({
      text: "+0.1",
      arrow: "up",
      tone: "better",
    });
  });

  it("keeps the sign for higher-is-better metrics", () => {
    expect(displayChange({ ...definition("avgKd"), diff: 0.16 })).toEqual({
      text: "+0.16",
      arrow: "up",
      tone: "better",
    });
    expect(displayChange({ ...definition("winRate"), diff: -5 })).toEqual({
      text: "-5 pp",
      arrow: "down",
      tone: "worse",
    });
  });

  it("is flat for no change or missing data", () => {
    expect(displayChange({ ...definition("adr"), diff: 0 }).arrow).toBe("flat");
    expect(displayChange({ ...definition("adr"), diff: null })).toEqual({
      text: "—",
      arrow: "flat",
      tone: "flat",
    });
  });
});
