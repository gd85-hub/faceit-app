import { compare } from "@/lib/comparisonEngine";
import { ApiError } from "@/lib/errors";
import { getPlayer } from "@/lib/playerService";
import type { ComparisonResult } from "@/types/comparison";
import type { Player } from "@/types/stats";

const NICKNAME_PATTERN = /^[A-Za-z0-9_.-]{1,30}$/;

export type CompareSuccess = {
  playerA: Player;
  playerB: Player;
  comparison: ComparisonResult | null;
  notice?: "NO_STATS";
};

export type CompareResponsePlayer = {
  profile: Player["profile"];
  stats: Player["stats"];
  recentResults: Player["stats"] extends null ? null : ("W" | "L")[] | null;
};

export type CompareResponseBody = {
  playerA: CompareResponsePlayer;
  playerB: CompareResponsePlayer;
  comparison: ComparisonResult | null;
  notice?: "NO_STATS";
};

export function validateCompareParams(playerA: string | null, playerB: string | null) {
  if (!playerA || !NICKNAME_PATTERN.test(playerA)) {
    throw new ApiError("INVALID_NICKNAME");
  }

  if (!playerB || !NICKNAME_PATTERN.test(playerB)) {
    throw new ApiError("INVALID_NICKNAME");
  }

  if (playerA.toLowerCase() === playerB.toLowerCase()) {
    throw new ApiError("SAME_PLAYER");
  }

  return { playerA, playerB };
}

function playerNotFoundErrors(results: PromiseSettledResult<Player>[]) {
  return results
    .filter(
      (result): result is PromiseRejectedResult =>
        result.status === "rejected" &&
        result.reason instanceof ApiError &&
        result.reason.code === "PLAYER_NOT_FOUND",
    )
    .map((result) => result.reason as ApiError);
}

export function buildPlayerPayload(player: Player): CompareResponsePlayer {
  return {
    profile: player.profile,
    stats: player.stats,
    recentResults: player.stats?.recentResults ?? null,
  };
}

export function buildCompareResponse(result: CompareSuccess): CompareResponseBody {
  return {
    playerA: buildPlayerPayload(result.playerA),
    playerB: buildPlayerPayload(result.playerB),
    comparison: result.comparison,
    ...(result.notice ? { notice: result.notice } : {}),
  };
}

export async function comparePlayers(
  playerANickname: string | null,
  playerBNickname: string | null,
): Promise<CompareSuccess> {
  const { playerA, playerB } = validateCompareParams(
    playerANickname,
    playerBNickname,
  );
  const results = await Promise.allSettled([getPlayer(playerA), getPlayer(playerB)]);
  const notFound = playerNotFoundErrors(results);

  if (notFound.length > 0) {
    throw new ApiError("PLAYER_NOT_FOUND", {
      httpStatus: 404,
      nicknames: notFound.flatMap((error) => error.nicknames),
    });
  }

  for (const result of results) {
    if (result.status === "rejected") {
      throw result.reason;
    }
  }

  const [resolvedPlayerA, resolvedPlayerB] = results.map((result) => {
    if (result.status === "fulfilled") {
      return result.value;
    }

    throw result.reason;
  }) as [Player, Player];

  if (!resolvedPlayerA.stats || !resolvedPlayerB.stats) {
    return {
      playerA: resolvedPlayerA,
      playerB: resolvedPlayerB,
      comparison: null,
      notice: "NO_STATS",
    };
  }

  return {
    playerA: resolvedPlayerA,
    playerB: resolvedPlayerB,
    comparison: compare(resolvedPlayerA.stats, resolvedPlayerB.stats, {
      nicknameA: resolvedPlayerA.profile.nickname,
      nicknameB: resolvedPlayerB.profile.nickname,
    }),
  };
}
