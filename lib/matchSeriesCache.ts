const TTL_MS = 10 * 60_000;
const MAX_ENTRIES = 100;

export type MatchSeriesRawPoint = {
  idx: number;
  date: string;
  map: string | null;
  result: "W" | "L" | null;
  kills: number | null;
  deaths: number | null;
  adr: number | null;
};

export type CachedMatchSeriesPair = {
  A: {
    nickname: string;
    points: MatchSeriesRawPoint[];
  };
  B: {
    nickname: string;
    points: MatchSeriesRawPoint[];
  };
};

type CacheEntry = {
  value: CachedMatchSeriesPair;
  expiresAt: number;
  createdAt: number;
};

const matchSeriesCache = new Map<string, CacheEntry>();

export function matchSeriesCacheKey(playerA: string, playerB: string) {
  return `${playerA.toLowerCase()}|${playerB.toLowerCase()}`;
}

function pruneExpired(now = Date.now()) {
  for (const [key, entry] of matchSeriesCache) {
    if (entry.expiresAt <= now) {
      matchSeriesCache.delete(key);
    }
  }
}

function pruneOldest() {
  while (matchSeriesCache.size > MAX_ENTRIES) {
    let oldest: { key: string; createdAt: number } | null = null;

    for (const [key, entry] of matchSeriesCache) {
      if (!oldest || entry.createdAt < oldest.createdAt) {
        oldest = { key, createdAt: entry.createdAt };
      }
    }

    if (!oldest) {
      return;
    }

    matchSeriesCache.delete(oldest.key);
  }
}

export function getCachedMatchSeriesPair(key: string) {
  const entry = matchSeriesCache.get(key);

  if (!entry) {
    return undefined;
  }

  if (entry.expiresAt <= Date.now()) {
    matchSeriesCache.delete(key);
    return undefined;
  }

  return entry.value;
}

export function setCachedMatchSeriesPair(
  key: string,
  value: CachedMatchSeriesPair,
) {
  const now = Date.now();
  pruneExpired(now);
  matchSeriesCache.set(key, {
    value,
    createdAt: now,
    expiresAt: now + TTL_MS,
  });
  pruneOldest();
}

export function clearMatchSeriesCacheForTests() {
  matchSeriesCache.clear();
}
