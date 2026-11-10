import { getPlayerHistory } from "@/lib/faceitClient";
import { BULK_PAGES, GAME_ID } from "@/lib/matchCollector";
import { safeFaceitCall } from "@/lib/playerService";
import type { LobbySnapshot } from "@/types/matches";

/**
 * The bulk /games/cs2/stats endpoint returns only the player's own numbers
 * per match (no teams), so the lobby comes from /players/{id}/history, which
 * lists both teams with each player's skill_level.
 */
export const HISTORY_PAGE_LIMIT = 100;

type ObjectLike = Record<string, unknown>;

function isObjectLike(value: unknown): value is ObjectLike {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function skillLevel(value: unknown) {
  const level = Number(value);
  return value !== null && value !== "" && Number.isFinite(level) ? level : null;
}

/** Turns one /history item into a snapshot, or null if the shape is off. */
export function lobbyFromHistoryItem(
  item: unknown,
  playerId: string,
  collectedAt: string,
): LobbySnapshot | null {
  if (!isObjectLike(item) || !isObjectLike(item.teams)) {
    return null;
  }

  const teams = Object.values(item.teams).map((team) =>
    isObjectLike(team) && Array.isArray(team.players)
      ? team.players.filter(isObjectLike)
      : [],
  );
  const ownIndex = teams.findIndex((players) =>
    players.some((player) => player.player_id === playerId),
  );

  if (ownIndex === -1) {
    return null;
  }

  return {
    collected_at: collectedAt,
    players: teams.flatMap((players, index) =>
      players.map((player) => ({
        team: index === ownIndex ? ("own" as const) : ("enemy" as const),
        self: player.player_id === playerId,
        skill_level: skillLevel(player.skill_level),
      })),
    ),
  };
}

/**
 * Reads lobby snapshots for the given matches from /history, 100 matches per
 * request, stopping as soon as every requested match has been seen.
 */
export async function fetchLobbySnapshots(
  playerId: string,
  matchIds: ReadonlySet<string>,
  now: () => Date = () => new Date(),
): Promise<Map<string, LobbySnapshot>> {
  const snapshots = new Map<string, LobbySnapshot>();

  if (matchIds.size === 0) {
    return snapshots;
  }

  for (let page = 0; page < BULK_PAGES; page += 1) {
    const response = await safeFaceitCall(() =>
      getPlayerHistory(playerId, GAME_ID, {
        offset: page * HISTORY_PAGE_LIMIT,
        limit: HISTORY_PAGE_LIMIT,
      }),
    );
    const items =
      isObjectLike(response) && Array.isArray(response.items)
        ? response.items
        : [];
    const collectedAt = now().toISOString();

    for (const item of items) {
      const matchId = isObjectLike(item) ? item.match_id : undefined;

      if (typeof matchId !== "string" || !matchIds.has(matchId)) {
        continue;
      }

      const snapshot = lobbyFromHistoryItem(item, playerId, collectedAt);
      if (snapshot) {
        snapshots.set(matchId, snapshot);
      }
    }

    if (snapshots.size === matchIds.size || items.length < HISTORY_PAGE_LIMIT) {
      break;
    }
  }

  return snapshots;
}
