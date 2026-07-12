import {
  getPlayerById,
  getPlayerStats,
  searchPlayer,
  type FaceitFetchError,
} from "@/lib/faceitClient";
import {
  getCachedPlayerId,
  getCachedProfile,
  getCachedStats,
  setCachedPlayerId,
  setCachedProfile,
  setCachedStats,
} from "@/lib/cache";
import { ApiError } from "@/lib/errors";
import { normalizeProfile } from "@/lib/playerNormalizer";
import { normalizeStats } from "@/lib/statsNormalizer";
import type { Player } from "@/types/stats";

type SearchResponse = {
  items?: Array<{
    player_id?: unknown;
  }>;
};

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
  try {
    return await call();
  } catch (error) {
    mapFaceitError(error);
  }
}

export async function getPlayer(nickname: string): Promise<Player> {
  let playerId = getCachedPlayerId(nickname);

  if (!playerId) {
    const search = await safeFaceitCall(() => searchPlayer(nickname)) as SearchResponse;
    const firstItem = Array.isArray(search.items) ? search.items[0] : undefined;
    playerId = typeof firstItem?.player_id === "string"
      ? firstItem.player_id
      : undefined;

    if (playerId) {
      setCachedPlayerId(nickname, playerId);
    }
  }

  if (!playerId) {
    throw new ApiError("PLAYER_NOT_FOUND", { nicknames: [nickname] });
  }

  let profile = getCachedProfile(playerId);
  if (!profile) {
    const rawProfile = await safeFaceitCall(() => getPlayerById(playerId));
    profile = normalizeProfile(rawProfile);
    setCachedProfile(playerId, profile);
  }

  let stats = getCachedStats(playerId);
  if (stats === undefined) {
    const rawStats = await safeFaceitCall(() => getPlayerStats(playerId, "cs2"));
    stats = normalizeStats(rawStats);
    setCachedStats(playerId, stats);
  }

  return {
    profile,
    stats,
  };
}
