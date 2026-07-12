import type { NormalizedStats, PlayerProfile } from "@/types/stats";

const TTL_MS = 60_000;
const MAX_ENTRIES = 500;

type CacheEntry<T> = {
  value: T;
  expiresAt: number;
  createdAt: number;
};

const profileCache = new Map<string, CacheEntry<PlayerProfile>>();
const statsCache = new Map<string, CacheEntry<NormalizedStats | null>>();
const playerIdCache = new Map<string, CacheEntry<string>>();

function totalEntries() {
  return profileCache.size + statsCache.size + playerIdCache.size;
}

function pruneExpired(now = Date.now()) {
  for (const [playerId, entry] of profileCache) {
    if (entry.expiresAt <= now) {
      profileCache.delete(playerId);
    }
  }

  for (const [playerId, entry] of statsCache) {
    if (entry.expiresAt <= now) {
      statsCache.delete(playerId);
    }
  }

  for (const [nickname, entry] of playerIdCache) {
    if (entry.expiresAt <= now) {
      playerIdCache.delete(nickname);
    }
  }
}

function pruneOldest() {
  while (totalEntries() > MAX_ENTRIES) {
    let oldest:
      | {
          kind: "profile" | "stats" | "playerId";
          key: string;
          createdAt: number;
        }
      | null = null;

    for (const [playerId, entry] of profileCache) {
      if (!oldest || entry.createdAt < oldest.createdAt) {
        oldest = { kind: "profile", key: playerId, createdAt: entry.createdAt };
      }
    }

    for (const [playerId, entry] of statsCache) {
      if (!oldest || entry.createdAt < oldest.createdAt) {
        oldest = { kind: "stats", key: playerId, createdAt: entry.createdAt };
      }
    }

    for (const [nickname, entry] of playerIdCache) {
      if (!oldest || entry.createdAt < oldest.createdAt) {
        oldest = {
          kind: "playerId",
          key: nickname,
          createdAt: entry.createdAt,
        };
      }
    }

    if (!oldest) {
      return;
    }

    if (oldest.kind === "profile") {
      profileCache.delete(oldest.key);
    } else if (oldest.kind === "stats") {
      statsCache.delete(oldest.key);
    } else {
      playerIdCache.delete(oldest.key);
    }
  }
}

function getCached<T>(map: Map<string, CacheEntry<T>>, playerId: string): T | undefined {
  const entry = map.get(playerId);

  if (!entry) {
    return undefined;
  }

  if (entry.expiresAt <= Date.now()) {
    map.delete(playerId);
    return undefined;
  }

  return entry.value;
}

function setCached<T>(map: Map<string, CacheEntry<T>>, playerId: string, value: T) {
  const now = Date.now();
  pruneExpired(now);
  map.set(playerId, {
    value,
    createdAt: now,
    expiresAt: now + TTL_MS,
  });
  pruneOldest();
}

export function getCachedProfile(playerId: string) {
  return getCached(profileCache, playerId);
}

export function setCachedProfile(playerId: string, profile: PlayerProfile) {
  setCached(profileCache, playerId, profile);
}

export function getCachedStats(playerId: string) {
  return getCached(statsCache, playerId);
}

export function setCachedStats(playerId: string, stats: NormalizedStats | null) {
  setCached(statsCache, playerId, stats);
}

export function getCachedPlayerId(nickname: string) {
  return getCached(playerIdCache, nickname.toLowerCase());
}

export function setCachedPlayerId(nickname: string, playerId: string) {
  setCached(playerIdCache, nickname.toLowerCase(), playerId);
}

export function clearCacheForTests() {
  profileCache.clear();
  statsCache.clear();
  playerIdCache.clear();
}
