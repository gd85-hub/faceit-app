import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { CompareForm } from "@/components/CompareForm";
import { ContextNotice } from "@/components/ContextNotice";
import { HeadlineVerdict } from "@/components/HeadlineVerdict";
import { MetricComparisonTable } from "@/components/MetricComparisonTable";
import { PlayerCard } from "@/components/PlayerCard";
import { SiteHeader } from "@/components/SiteHeader";
import { comparePlayers } from "@/lib/compareUseCase";
import { ApiError, isApiError } from "@/lib/errors";
import type { Player } from "@/types/stats";

type ComparePageProps = {
  searchParams: Promise<{
    playerA?: string;
    playerB?: string;
  }>;
};

function metadataNickname(value: string | undefined) {
  return value && value.length > 0 ? value : null;
}

export async function generateMetadata({
  searchParams,
}: ComparePageProps): Promise<Metadata> {
  const params = await searchParams;
  const playerA = metadataNickname(params.playerA);
  const playerB = metadataNickname(params.playerB);
  const title = playerA && playerB
    ? `${playerA} vs ${playerB} \u2014 CS2 stats`
    : "Compare CS2 stats";
  const description = playerA && playerB
    ? `Compare lifetime CS2 statistics for ${playerA} and ${playerB}.`
    : "Compare lifetime CS2 statistics for FACEIT players.";

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: "website",
    },
  };
}

const NICKNAME_PATTERN = /^[A-Za-z0-9_.-]{1,30}$/;

function noStatsPlayer(playerA: Player, playerB: Player) {
  return !playerA.stats ? playerA : playerB;
}

function errorFormMessage(error: ApiError) {
  switch (error.code) {
    case "PLAYER_NOT_FOUND":
      return undefined;
    case "SAME_PLAYER":
      return "Choose two different players";
    case "INVALID_NICKNAME":
      return "Only letters, numbers, dash, underscore and dot";
    case "RATE_LIMITED":
      return "Too many requests. Try again in a minute.";
    case "UPSTREAM_ERROR":
      return "FACEIT is not responding. Try again later.";
    case "NO_STATS":
      return undefined;
  }
}

function nicknameMatches(value: string | undefined, nicknames: string[]) {
  return nicknames.some(
    (nickname) => nickname.toLowerCase() === (value ?? "").toLowerCase(),
  );
}

function invalidNickname(value: string | undefined) {
  return !value || !NICKNAME_PATTERN.test(value);
}

function fieldErrors(
  error: ApiError,
  playerA: string | undefined,
  playerB: string | undefined,
) {
  if (error.code === "PLAYER_NOT_FOUND") {
    return {
      playerA: nicknameMatches(playerA, error.nicknames)
        ? "Player not found"
        : undefined,
      playerB: nicknameMatches(playerB, error.nicknames)
        ? "Player not found"
        : undefined,
    };
  }

  if (error.code === "INVALID_NICKNAME") {
    return {
      playerA: invalidNickname(playerA) ? "Invalid nickname" : undefined,
      playerB: invalidNickname(playerB) ? "Invalid nickname" : undefined,
    };
  }

  return {};
}

function ErrorForm({
  error,
  playerA,
  playerB,
}: {
  error: ApiError;
  playerA?: string;
  playerB?: string;
}) {
  return (
    <>
      <SiteHeader showNewComparison />
      <main className="min-h-[calc(100vh-56px)] bg-[var(--bg)] text-[var(--text)]">
        <CompareForm
          playerA={playerA}
          playerB={playerB}
          message={errorFormMessage(error)}
          fieldErrors={fieldErrors(error, playerA, playerB)}
        />
      </main>
    </>
  );
}

export default async function ComparePage({ searchParams }: ComparePageProps) {
  const params = await searchParams;

  if (!params.playerA && !params.playerB) {
    redirect("/");
  }

  let result;

  try {
    result = await comparePlayers(params.playerA ?? null, params.playerB ?? null);
  } catch (error) {
    if (isApiError(error)) {
      return (
        <ErrorForm
          error={error}
          playerA={params.playerA}
          playerB={params.playerB}
        />
      );
    }

    return (
      <ErrorForm
        error={new ApiError("UPSTREAM_ERROR")}
        playerA={params.playerA}
        playerB={params.playerB}
      />
    );
  }

  const nicknameA = result.playerA.profile.nickname;
  const nicknameB = result.playerB.profile.nickname;
  const missingStatsPlayer = result.notice
    ? noStatsPlayer(result.playerA, result.playerB)
    : null;

  return (
    <>
      <SiteHeader showNewComparison />
      <main className="min-h-[calc(100vh-56px)] bg-[var(--bg)] py-8 text-[var(--text)]">
        <div className="mx-auto max-w-5xl space-y-8 px-4">
          <div className="grid gap-4 md:grid-cols-2">
            <PlayerCard
              profile={result.playerA.profile}
              recentResults={result.playerA.stats?.recentResults ?? null}
            />
            <PlayerCard
              profile={result.playerB.profile}
              recentResults={result.playerB.stats?.recentResults ?? null}
            />
          </div>

          {result.comparison ? (
            <>
              <ContextNotice playerA={result.playerA} playerB={result.playerB} />
              <HeadlineVerdict
                comparison={result.comparison}
                nicknameA={nicknameA}
                nicknameB={nicknameB}
              />

              <section className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-5">
                <h2 className="text-sm font-semibold text-[var(--text)]">
                  All metrics
                </h2>
                <p className="mt-1 text-xs text-[var(--text-dim)]">
                  Metrics marked &apos;not compared&apos; describe context, not
                  skill.
                </p>
                <div className="mt-4 overflow-x-auto">
                  <MetricComparisonTable
                    comparison={result.comparison}
                    nicknameA={nicknameA}
                    nicknameB={nicknameB}
                  />
                </div>
              </section>
            </>
          ) : (
            <p className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4 text-[var(--text)]">
              {missingStatsPlayer?.profile.nickname} hasn&apos;t played CS2 on
              FACEIT yet.
            </p>
          )}
        </div>
      </main>
    </>
  );
}
