import { faceitFetch, searchPlayer } from "@/lib/faceitClient";

/**
 * Temporary reconnaissance route.
 *
 * FACEIT does not document the field names returned by
 * `/players/{id}/games/{game}/stats` or by `/matches/{id}/stats`, so this route
 * fetches small live samples and reports the raw payloads together with the key
 * names found in them.
 *
 * Guarded by PROBE_SECRET. Delete this route once FINDINGS.md records the
 * fields.
 */

const GAME_ID = "cs2";

type SearchResponse = {
  items?: Array<{ player_id?: unknown; nickname?: unknown }>;
};

type HistoryResponse = {
  items?: Array<{ match_id?: unknown; started_at?: unknown }>;
};

type GamesStatsResponse = {
  start?: unknown;
  end?: unknown;
  items?: Array<{ stats?: Record<string, unknown> }>;
};

type MatchStatsResponse = {
  rounds?: Array<{
    round_stats?: Record<string, unknown>;
    teams?: Array<{ players?: Array<Record<string, unknown>> }>;
  }>;
};

type ProbeStep<T> = {
  ok: boolean;
  path: string;
  error?: string;
  data?: T;
};

function sortedKeys(value: Record<string, unknown> | undefined): string[] {
  return value ? Object.keys(value).sort() : [];
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

async function step<T>(path: string): Promise<ProbeStep<T>> {
  try {
    return { ok: true, path, data: await faceitFetch<T>(path) };
  } catch (error) {
    return { ok: false, path, error: errorMessage(error) };
  }
}

function playerStatsOf(
  matchStats: MatchStatsResponse | undefined,
  playerId: string,
): Record<string, unknown> | undefined {
  for (const round of matchStats?.rounds ?? []) {
    for (const team of round.teams ?? []) {
      for (const player of team.players ?? []) {
        if (player.player_id === playerId) {
          const stats = player.player_stats;
          return stats && typeof stats === "object"
            ? (stats as Record<string, unknown>)
            : undefined;
        }
      }
    }
  }

  return undefined;
}

export async function GET(request: Request) {
  const secret = process.env.PROBE_SECRET;

  if (!secret) {
    return Response.json(
      { error: "PROBE_SECRET is not configured" },
      { status: 404 },
    );
  }

  const { searchParams } = new URL(request.url);

  if (searchParams.get("secret") !== secret) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  const nickname = searchParams.get("nickname");

  if (!nickname) {
    return Response.json({ error: "nickname is required" }, { status: 400 });
  }

  let search: SearchResponse;

  try {
    search = (await searchPlayer(nickname)) as SearchResponse;
  } catch (error) {
    return Response.json(
      { error: `search failed: ${errorMessage(error)}` },
      { status: 502 },
    );
  }

  const playerId = search.items?.find(
    (item) => typeof item.player_id === "string",
  )?.player_id;

  if (typeof playerId !== "string") {
    return Response.json(
      { error: `player not found: ${nickname}` },
      { status: 404 },
    );
  }

  // Question 1: does the bulk per-match stats endpoint work for cs2, and what
  // does one item look like?
  const gamesStats = await step<GamesStatsResponse>(
    `/players/${encodeURIComponent(playerId)}/games/${GAME_ID}/stats?limit=3`,
  );

  // Question 2: how deep can the bulk endpoint go? offset is documented as
  // 0..200, so this probes the far edge of the window.
  const gamesStatsDeep = await step<GamesStatsResponse>(
    `/players/${encodeURIComponent(playerId)}/games/${GAME_ID}/stats?limit=100&offset=200`,
  );

  const history = await step<HistoryResponse>(
    `/players/${encodeURIComponent(playerId)}/history?game=${GAME_ID}&offset=0&limit=1`,
  );

  const matchId = history.data?.items?.find(
    (item) => typeof item.match_id === "string",
  )?.match_id;

  // Question 3: are entry / clutch / utility fields present per match, or only
  // in lifetime aggregates?
  const matchStats =
    typeof matchId === "string"
      ? await step<MatchStatsResponse>(
          `/matches/${encodeURIComponent(matchId)}/stats`,
        )
      : { ok: false, path: "(skipped)", error: "no match_id in history" };

  const firstGamesStatsItem = gamesStats.data?.items?.[0]?.stats;
  const matchPlayerStats = playerStatsOf(
    (matchStats as ProbeStep<MatchStatsResponse>).data,
    playerId,
  );

  return Response.json({
    nickname,
    playerId,
    summary: {
      gamesStatsWorks: gamesStats.ok,
      gamesStatsItemCount: gamesStats.data?.items?.length ?? 0,
      gamesStatsDeepWorks: gamesStatsDeep.ok,
      gamesStatsDeepItemCount: gamesStatsDeep.data?.items?.length ?? 0,
      gamesStatsKeys: sortedKeys(firstGamesStatsItem),
      matchPlayerStatsKeys: sortedKeys(matchPlayerStats),
      matchRoundStatsKeys: sortedKeys(
        (matchStats as ProbeStep<MatchStatsResponse>).data?.rounds?.[0]
          ?.round_stats,
      ),
    },
    raw: {
      gamesStats,
      gamesStatsDeep: {
        ok: gamesStatsDeep.ok,
        path: gamesStatsDeep.path,
        error: gamesStatsDeep.error,
        firstItem: gamesStatsDeep.data?.items?.[0] ?? null,
      },
      history,
      matchPlayerStats: matchPlayerStats ?? null,
    },
  });
}
