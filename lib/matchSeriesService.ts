import {
  getCachedMatchSeriesPair,
  matchSeriesCacheKey,
  setCachedMatchSeriesPair,
  type CachedMatchSeriesPair,
  type MatchSeriesRawPoint,
} from "@/lib/matchSeriesCache";
import { validateCompareParams } from "@/lib/compareUseCase";
import { ApiError } from "@/lib/errors";
import { syncPlayerMatches } from "@/lib/matchArchive";
import { resolveProfile } from "@/lib/playerService";

const TARGET_MATCHES = 20;
const ROLLING_WINDOW = 5;

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

function parseMetric(metric: string | null): MatchSeriesMetric {
  if (metric === "kd" || metric === "adr") {
    return metric;
  }

  throw new ApiError("INVALID_NICKNAME");
}

async function collectPlayerRawSeries(nickname: string) {
  const { playerId } = await resolveProfile(nickname);
  const { matches } = await syncPlayerMatches(playerId);
  const recent = matches.slice(0, TARGET_MATCHES).reverse();

  if (recent.length === 0) {
    throw new ApiError("NO_STATS", { nicknames: [nickname] });
  }

  return {
    nickname,
    points: recent.map((match, index): MatchSeriesRawPoint => ({
      idx: index + 1,
      date: match.finished_at ?? "",
      map: match.map,
      result: match.result,
      kills: match.kills,
      deaths: match.deaths,
      adr: match.adr,
    })),
  };
}

async function collectRawPair(playerA: string, playerB: string) {
  const [seriesA, seriesB] = await Promise.all([
    collectPlayerRawSeries(playerA),
    collectPlayerRawSeries(playerB),
  ]);

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
