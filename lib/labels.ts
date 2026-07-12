import type { GroupVerdict, MetricStatus } from "@/types/comparison";
import type { MetricGroup } from "@/types/metrics";

export const groupLabels: Record<MetricGroup, string> = {
  fragging: "Fragging",
  results: "Results",
  entry: "Entry",
  clutch: "Clutch",
  utility: "Utility",
};

export const groupHints: Record<MetricGroup, string> = {
  fragging: "gunfights",
  results: "match outcomes",
  entry: "first duels of the round",
  clutch: "playing outnumbered",
  utility: "grenades and flashes",
};

export function verdictLabels(
  verdict: GroupVerdict,
  nicknameA: string,
  nicknameB: string,
) {
  switch (verdict) {
    case "A_stronger":
      return `${nicknameA} ahead in this group`;
    case "B_stronger":
      return `${nicknameB} ahead in this group`;
    case "close":
      return "Evenly matched";
    case "insufficient":
      return "Not enough data";
  }
}

export const statusLabels: Record<MetricStatus, string> = {
  ahead: "Ahead",
  behind: "Behind",
  even: "Even",
  neutral: "\u2014",
  unknown: "No data",
};
