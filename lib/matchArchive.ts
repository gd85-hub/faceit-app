import { fetchLobbySnapshots } from "@/lib/lobbySnapshot";
import { fetchRecentMatches } from "@/lib/matchCollector";
import {
  StoreConflictError,
  emptyDocument,
  getDefaultMatchStore,
  mergeMatches,
  type MatchStore,
  type PlayerMatchDocument,
  type StoredDocument,
} from "@/lib/matchStore";
import type { CollectedMatch, LobbySnapshot } from "@/types/matches";

const WRITE_ATTEMPTS = 2;

/**
 * Attaches a lobby snapshot (skill levels of all ten players + collected_at)
 * to each new match. Only new matches get one: the snapshot is only worth
 * keeping when taken soon after the match, so stored matches are never
 * re-snapshotted later. A failed /history pass keeps the matches, lobby null.
 */
async function withLobbies(playerId: string, matches: CollectedMatch[]) {
  if (matches.length === 0) {
    return matches;
  }

  let snapshots = new Map<string, LobbySnapshot>();

  try {
    snapshots = await fetchLobbySnapshots(
      playerId,
      new Set(matches.map((match) => match.match_id)),
    );
  } catch (error) {
    console.error(`[matchArchive] lobby snapshot failed for ${playerId}`, error);
  }

  return matches.map((match) => ({
    ...match,
    lobby: snapshots.get(match.match_id) ?? null,
  }));
}

async function readOrNull(store: MatchStore, playerId: string) {
  try {
    return { stored: await store.read(playerId), readable: true };
  } catch (error) {
    console.error(`[matchArchive] read failed for ${playerId}`, error);
    return { stored: null, readable: false };
  }
}

/**
 * Reads the player's stored matches, fetches only matches newer than the
 * stored ones, appends them (deduplicated by match_id) and writes the
 * document back. Returns the merged document even if the write fails, so a
 * storage outage never breaks the page.
 */
export async function syncPlayerMatches(
  playerId: string,
  store: MatchStore | null = getDefaultMatchStore(),
): Promise<PlayerMatchDocument> {
  const read = store ? await readOrNull(store, playerId) : null;
  let stored: StoredDocument | null = read?.stored ?? null;
  const knownMatchIds = new Set(
    stored?.document.matches.map((match) => match.match_id) ?? [],
  );
  const fresh = await withLobbies(
    playerId,
    await fetchRecentMatches(playerId, { knownMatchIds }),
  );

  const build = (base: PlayerMatchDocument): PlayerMatchDocument => ({
    ...base,
    player_id: playerId,
    updated_at: new Date().toISOString(),
    matches: mergeMatches(base.matches, fresh),
  });

  if (!store || !read?.readable) {
    return build(stored?.document ?? emptyDocument(playerId));
  }

  if (fresh.length === 0 && stored) {
    return stored.document;
  }

  let document = build(stored?.document ?? emptyDocument(playerId));

  for (let attempt = 1; attempt <= WRITE_ATTEMPTS; attempt += 1) {
    try {
      await store.write(playerId, document, stored?.etag ?? null);
      return document;
    } catch (error) {
      if (!(error instanceof StoreConflictError) || attempt === WRITE_ATTEMPTS) {
        console.error(`[matchArchive] write failed for ${playerId}`, error);
        return document;
      }

      // Someone else wrote first: merge onto their version and try again.
      stored = await store.read(playerId);
      document = build(stored?.document ?? emptyDocument(playerId));
    }
  }

  return document;
}
