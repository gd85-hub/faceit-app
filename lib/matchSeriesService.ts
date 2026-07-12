import { faceitFetch, searchPlayer, type FaceitFetchError } from "@/lib/faceitClient";
import {
  getCachedMatchSeriesPair,
  matchSeriesCacheKey,
  setCachedMatchSeriesPair,
  type CachedMatchSeriesPair,
  type MatchSeriesRawPoint,
} from "@/lib/matchSeriesCache";
import {
  getCachedPlayerId,
  setCachedPlayerId,
} from "@/lib/cache";
import { validateCompareParams } from "@/lib/compareUseCase";
import { ApiError } from "@/lib/errors";

const GAME_ID = "cs2";
const HISTORY_PAGE_LIMIT = 5;
const HISTORY_PAGES = 4;
const TARGET_MATCHES = 20;
const ROLLING_WINDOW = 5;
const REQUEST_PAUSE_MS = 300;
let faceitRequestCount = 0;

export type MatchSeriesMetric = "kd" | "adr";

export type MatchSeriesPoint = {
  idx: number;
  date: string;
  map: string | null;
  result: "W" | "L" | null;
  raw: number | null;
  smooth: number | null;
};

export type MatchSeriesResponseBody = {
  metric: MatchSeriesMetric;
  players: {
    A: {
      nickname: string;
      points: MatchSeriesPoint[];
    };
    B: {
      nickname: string;
      points: MatchSeriesPoint[];
    };
  };
};

export type MatchSeriesResult = {
  body: MatchSeriesResponseBody;
  cacheStatus: "hit" | "miss";
};

type SearchResponse = {
  items?: Array<{
    player_id?: unknown;
  }>;
};

type HistoryTeam = {
  players?: Array<{ player_id?: unknown }>;
};

type HistoryItem = Record<string, unknown> & {
  match_id?: unknown;
  started_at?: unknown;
  status?: unknown;
  results?: {
    winner?: unknown;
  };
  teams?: Record<string, HistoryTeam>;
};

type HistoryResponse = {
  items?: HistoryItem[];
};

type PlayerStats = {
  player_id?: unknown;
  player_stats?: Record<string, unknown>;
};

type MatchStatsResponse = {
  rounds?: Array<{
    round_stats?: Record<string, unknown>;
    teams?: Array<{
      players?: PlayerStats[];
    }>;
  }>;
};

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function mapFaceitError(error: unknown): never {
  const faceitError = error as FaceitFetchError;
  const status = faceitError.status;

  if (status === 429) {
    throw new ApiError("RATE_LIMITED");
  }

  if (status === 504) {
    throw new ApiError("UPSTREAM_ERROR", { httpStatus: 504 });
  }

  if (typeof status === "number" && status >= 500) {
    throw new ApiError("UPSTREAM_ERROR", { httpStatus: 502 });
  }

  throw new ApiError("UPSTREAM_ERROR");
}

async function safeFaceitCall<T>(call: () => Promise<T>): Promise<T> {
  if (faceitRequestCount > 0) {
    await sleep(REQUEST_PAUSE_MS);
  }

  try {
    return await call();
  } catch (error) {
    mapFaceitError(error);
  } finally {
    faceitRequestCount += 1;
  }
}

function parseMetric(metric: string | null): MatchSeriesMetric {
  if (metric === "kd" || metric === "adr") {
    return metric;
  }

  throw new ApiError("INVALID_NICKNAME");
}

async function resolvePlayerId(nickname: string) {
  const cachedPlayerId = getCachedPlayerId(nickname);
  if (cachedPlayerId) {
    return cachedPlayerId;
  }

  const search = await safeFaceitCall(() => searchPlayer(nickname)) as SearchResponse;
  const firstItem = Array.isArray(search.items) ? search.items[0] : undefined;
  const playerId =
    typeof firstItem?.player_id === "string" ? firstItem.player_id : undefined;

  if (!playerId) {
    throw new ApiError("PLAYER_NOT_FOUND", { nicknames: [nickname] });
  }

  setCachedPlayerId(nickname, playerId);
  return playerId;
}

function isFinishedHistoryItem(item: HistoryItem) {
  return item.status === undefined || item.status === "finished";
}

function playerFaction(item: HistoryItem, playerId: string) {
  for (const [faction, team] of Object.entries(item.teams ?? {})) {
    if (team.players?.some((player) => player.player_id === playerId)) {
      return faction;
    }
  }

  return null;
}

function historyResult(item: HistoryItem, playerId: string): "W" | "L" | null {
  const faction = playerFaction(item, playerId);
  const winner = item.results?.winner;

  if (typeof faction !== "string" || typeof winner !== "string") {
    return null;
  }

  return faction === winner ? "W" : "L";
}

function formatDate(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return new Date(value * 1000).toISOString();
  }

  if (typeof value === "string") {
    const numericValue = Number(value);
    if (Number.isFinite(numericValue)) {
      return new Date(numericValue * 1000).toISOString();
    }

    const parsed = Date.parse(value);
    if (Number.isFinite(parsed)) {
      return new Date(parsed).toISOString();
    }
  }

  return "";
}

function numberField(stats: Record<string, unknown>, key: string) {
  const numberValue = Number(stats[key]);
  return Number.isFinite(numberValue) ? numberValue : null;
}

function stringField(stats: Record<string, unknown> | undefined, key: string) {
  const value = stats?.[key];
  return typeof value === "string" && value.length > 0 ? value : null;
}

function findPlayerStats(matchStats: MatchStatsResponse, playerId: string) {
  for (const round of matchStats.rounds ?? []) {
    for (const team of round.teams ?? []) {
      const player = team.players?.find(
        (candidate) => candidate.player_id === playerId,
      );

      if (player) {
        return {
          roundStats: round.round_stats,
          playerStats: player.player_stats ?? {},
        };
      }
    }
  }

  return null;
}

async function fetchHistory(playerId: string) {
  const items: HistoryItem[] = [];

  for (let page = 0; page < HISTORY_PAGES; page += 1) {
    const offset = page * HISTORY_PAGE_LIMIT;

    const history = await safeFaceitCall(() =>
      faceitFetch<HistoryResponse>(
        `/players/${encodeURIComponent(
          playerId,
        )}/history?game=${encodeURIComponent(GAME_ID)}&offset=${offset}&limit=${HISTORY_PAGE_LIMIT}`,
      ),
    );

    items.push(...(history.items ?? []).filter(isFinishedHistoryItem));
  }

  return items
    .filter((item) => typeof item.match_id === "string")
    .slice(0, TARGET_MATCHES)
    .reverse();
}

async function collectPlayerRawSeries(nickname: string) {
  const playerId = await resolvePlayerId(nickname);
  const history = await fetchHistory(playerId);

  if (history.length === 0) {
    throw new ApiError("NO_STATS", { nicknames: [nickname] });
  }

  const points: MatchSeriesRawPoint[] = [];

  for (const item of history) {
    const matchId = item.match_id;
    if (typeof matchId !== "string") {
      continue;
    }

    const matchStats = await safeFaceitCall(() =>
      faceitFetch<MatchStatsResponse>(
        `/matches/${encodeURIComponent(matchId)}/stats`,
      ),
    );
    const found = findPlayerStats(matchStats, playerId);

    points.push({
      idx: points.length + 1,
      date: formatDate(item.started_at),
      map: found ? stringField(found.roundStats, "Map") : null,
      result: historyResult(item, playerId),
      kills: found ? numberField(found.playerStats, "Kills") : null,
      deaths: found ? numberField(found.playerStats, "Deaths") : null,
      adr: found ? numberField(found.playerStats, "ADR") : null,
    });
  }

  return {
    nickname,
    points,
  };
}

async function collectRawPair(playerA: string, playerB: string) {
  const seriesA = await collectPlayerRawSeries(playerA);
  const seriesB = await collectPlayerRawSeries(playerB);

  return {
    A: seriesA,
    B: seriesB,
  } satisfies CachedMatchSeriesPair;
}

function rawMetricValue(point: MatchSeriesRawPoint, metric: MatchSeriesMetric) {
  if (metric === "adr") {
    return point.adr;
  }

  if (point.kills === null || point.deaths === null || point.deaths === 0) {
    return null;
  }

  return point.kills / point.deaths;
}

function rollingAverage(values: Array<number | null>, windowSize: number) {
  return values.map((_, index) => {
    const windowValues = values
      .slice(Math.max(0, index - windowSize + 1), index + 1)
      .filter((value): value is number => value !== null);

    if (windowValues.length === 0) {
      return null;
    }

    return (
      windowValues.reduce((total, value) => total + value, 0) /
      windowValues.length
    );
  });
}

function buildMetricPoints(
  points: MatchSeriesRawPoint[],
  metric: MatchSeriesMetric,
) {
  const rawValues = points.map((point) => rawMetricValue(point, metric));
  const smoothValues = rollingAverage(rawValues, ROLLING_WINDOW);

  return points.map((point, index) => ({
    idx: point.idx,
    date: point.date,
    map: point.map,
    result: point.result,
    raw: rawValues[index],
    smooth: smoothValues[index],
  }));
}

function buildResponseBody(
  metric: MatchSeriesMetric,
  pair: CachedMatchSeriesPair,
): MatchSeriesResponseBody {
  return {
    metric,
    players: {
      A: {
        nickname: pair.A.nickname,
        points: buildMetricPoints(pair.A.points, metric),
      },
      B: {
        nickname: pair.B.nickname,
        points: buildMetricPoints(pair.B.points, metric),
      },
    },
  };
}

export async function getMatchSeries(
  playerANickname: string | null,
  playerBNickname: string | null,
  metricParam: string | null,
): Promise<MatchSeriesResult> {
  const { playerA, playerB } = validateCompareParams(
    playerANickname,
    playerBNickname,
  );
  const metric = parseMetric(metricParam);
  const cacheKey = matchSeriesCacheKey(playerA, playerB);
  const cachedPair = getCachedMatchSeriesPair(cacheKey);

  if (cachedPair) {
    return {
      body: buildResponseBody(metric, cachedPair),
      cacheStatus: "hit",
    };
  }

  const pair = await collectRawPair(playerA, playerB);
  setCachedMatchSeriesPair(cacheKey, pair);

  return {
    body: buildResponseBody(metric, pair),
    cacheStatus: "miss",
  };
}
