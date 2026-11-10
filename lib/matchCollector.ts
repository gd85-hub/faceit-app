import { getPlayerMatchStats } from "@/lib/faceitClient";
import { safeFaceitCall } from "@/lib/playerService";
import type { CollectedMatch } from "@/types/matches";

export const GAME_ID = "cs2";
/** FACEIT caps the bulk endpoint at 100 items per request. */
export const BULK_PAGE_LIMIT = 100;
/** Three requests cover the last 300 matches. */
export const BULK_PAGES = 3;

/**
 * Keys of `items[].stats` in /players/{id}/games/cs2/stats. Kept in one place
 * so a renamed field is a one-line fix.
 */
export const BULK_FIELDS = {
  matchId: "Match Id",
  finishedAt: "Match Finished At",
  createdAt: "Created At",
  map: "Map",
  result: "Result",
  kills: "Kills",
  deaths: "Deaths",
  assists: "Assists",
  adr: "ADR",
  hsPercent: "Headshots %",
  rounds: "Rounds",
} as const;

type ObjectLike = Record<string, unknown>;

function isObjectLike(value: unknown): value is ObjectLike {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function numberOrNull(value: unknown) {
  if (value === "" || value === null || value === undefined) {
    return null;
  }

  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : null;
}

function stringOrNull(value: unknown) {
  return typeof value === "string" && value.length > 0 ? value : null;
}

/** Accepts epoch milliseconds, epoch seconds or an ISO string. */
export function toIsoTime(value: unknown): string | null {
  const numeric = numberOrNull(value);

  if (numeric !== null) {
    const ms = numeric < 10_000_000_000 ? numeric * 1000 : numeric;
    return new Date(ms).toISOString();
  }

  if (typeof value === "string") {
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? new Date(parsed).toISOString() : null;
  }

  return null;
}

function parseResult(value: unknown): CollectedMatch["result"] {
  if (value === "1" || value === 1) {
    return "W";
  }

  if (value === "0" || value === 0) {
    return "L";
  }

  return null;
}

export function normalizeBulkItem(item: unknown): CollectedMatch | null {
  const stats = isObjectLike(item) && isObjectLike(item.stats) ? item.stats : null;
  const matchId = stringOrNull(stats?.[BULK_FIELDS.matchId]);

  if (!stats || !matchId) {
    return null;
  }

  return {
    match_id: matchId,
    finished_at:
      toIsoTime(stats[BULK_FIELDS.finishedAt]) ??
      toIsoTime(stats[BULK_FIELDS.createdAt]),
    map: stringOrNull(stats[BULK_FIELDS.map]),
    result: parseResult(stats[BULK_FIELDS.result]),
    kills: numberOrNull(stats[BULK_FIELDS.kills]),
    deaths: numberOrNull(stats[BULK_FIELDS.deaths]),
    assists: numberOrNull(stats[BULK_FIELDS.assists]),
    adr: numberOrNull(stats[BULK_FIELDS.adr]),
    hs_percent: numberOrNull(stats[BULK_FIELDS.hsPercent]),
    rounds: numberOrNull(stats[BULK_FIELDS.rounds]),
  };
}

type FetchRecentOptions = {
  /**
   * Match ids that are already stored. Paging stops at the first page that
   * reaches one of them, so a refresh usually costs a single request.
   */
  knownMatchIds?: ReadonlySet<string>;
};

/**
 * Collects up to BULK_PAGES × BULK_PAGE_LIMIT recent matches, newest first,
 * with one request per page instead of one request per match.
 */
export async function fetchRecentMatches(
  playerId: string,
  { knownMatchIds }: FetchRecentOptions = {},
): Promise<CollectedMatch[]> {
  const matches: CollectedMatch[] = [];
  const seen = new Set<string>();

  for (let page = 0; page < BULK_PAGES; page += 1) {
    const response = await safeFaceitCall(() =>
      getPlayerMatchStats(playerId, GAME_ID, {
        offset: page * BULK_PAGE_LIMIT,
        limit: BULK_PAGE_LIMIT,
      }),
    );
    const items =
      isObjectLike(response) && Array.isArray(response.items)
        ? response.items
        : [];
    let reachedKnown = false;

    for (const item of items) {
      const match = normalizeBulkItem(item);

      if (!match || seen.has(match.match_id)) {
        continue;
      }

      if (knownMatchIds?.has(match.match_id)) {
        reachedKnown = true;
        continue;
      }

      seen.add(match.match_id);
      matches.push(match);
    }

    if (reachedKnown || items.length < BULK_PAGE_LIMIT) {
      break;
    }
  }

  return matches;
}
