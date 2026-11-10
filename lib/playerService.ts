import {
  getPlayerById,
  getPlayerByNickname,
  getPlayerStats,
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
import type { Player, PlayerProfile } from "@/types/stats";

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

export async function safeFaceitCall<T>(call: () => Promise<T>): Promise<T> {
  try {
    return await call();
  } catch (error) {
    mapFaceitError(error);
  }
}

function isNotFound(error: unknown) {
  return (error as FaceitFetchError | undefined)?.status === 404;
}

async function lookupProfileByNickname(nickname: string): Promise<PlayerProfile> {
  let rawProfile: unknown;

  try {
    rawProfile = await getPlayerByNickname(nickname);
  } catch (error) {
    if (isNotFound(error)) {
      throw new ApiError("PLAYER_NOT_FOUND", { nicknames: [nickname] });
    }

    mapFaceitError(error);
  }

  const profile = normalizeProfile(rawProfile);

  if (!profile.playerId) {
    throw new ApiError("PLAYER_NOT_FOUND", { nicknames: [nickname] });
  }

  return profile;
}

/**
 * Resolves a nickname to exactly that account via /players?nickname=X.
 * There is no fuzzy search step, so a similar-looking nickname can never be
 * picked up by mistake.
 */
export async function resolveProfile(nickname: string): Promise<PlayerProfile> {
  const cachedPlayerId = getCachedPlayerId(nickname);
  const cachedProfile = cachedPlayerId
    ? getCachedProfile(cachedPlayerId)
    : undefined;

  if (cachedProfile) {
    return cachedProfile;
  }

  const profile = cachedPlayerId
    ? normalizeProfile(await safeFaceitCall(() => getPlayerById(cachedPlayerId)))
    : await lookupProfileByNickname(nickname);

  setCachedPlayerId(nickname, profile.playerId);
  setCachedProfile(profile.playerId, profile);

  return profile;
}

export async function getPlayer(nickname: string): Promise<Player> {
  const profile = await resolveProfile(nickname);
  const playerId = profile.playerId;

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
