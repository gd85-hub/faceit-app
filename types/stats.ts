import type { MetricKey } from "./metrics";

export type MetricValue = number | null;

export interface PlayerProfile {
  playerId: string;
  nickname: string;
  avatar: string | null;
  country: string | null;
  skillLevel: number | null;
  elo: number | null;
}

export interface NormalizedStats {
  metrics: Record<MetricKey, MetricValue>;
  recentResults: ("W" | "L")[] | null;
}

export interface Player {
  profile: PlayerProfile;
  stats: NormalizedStats | null;
}
