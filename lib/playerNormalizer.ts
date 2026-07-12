import type { PlayerProfile } from "@/types/stats";

type ObjectLike = Record<string, unknown>;

function isObjectLike(value: unknown): value is ObjectLike {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stringOrNull(value: unknown): string | null {
  return typeof value === "string" && value !== "" ? value : null;
}

function numberOrNull(value: unknown): number | null {
  if (value === "" || value === null || value === undefined) {
    return null;
  }

  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : null;
}

export function normalizeProfile(raw: unknown): PlayerProfile {
  const source = isObjectLike(raw) ? raw : {};
  const games = isObjectLike(source.games) ? source.games : {};
  const cs2 = isObjectLike(games.cs2) ? games.cs2 : {};

  return {
    playerId: stringOrNull(source.player_id) ?? "",
    nickname: stringOrNull(source.nickname) ?? "",
    avatar: stringOrNull(source.avatar),
    country: stringOrNull(source.country),
    skillLevel: numberOrNull(cs2.skill_level),
    elo: numberOrNull(cs2.faceit_elo),
  };
}
