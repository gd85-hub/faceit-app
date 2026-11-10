import type { Metadata } from "next";
import { PeriodComparisonView } from "@/components/PeriodComparisonView";
import { SiteHeader } from "@/components/SiteHeader";
import { isApiError, messageForCode } from "@/lib/errors";
import { syncPlayerMatches } from "@/lib/matchArchive";
import { comparePeriods, parsePeriodWindow } from "@/lib/periodMetrics";
import { resolveProfile } from "@/lib/playerService";

const NICKNAME_PATTERN = /^[A-Za-z0-9_.-]{1,30}$/;

type ProgressPageProps = {
  searchParams: Promise<{
    player?: string;
    window?: string;
  }>;
};

export async function generateMetadata({
  searchParams,
}: ProgressPageProps): Promise<Metadata> {
  const { player } = await searchParams;
  const title = player ? `${player} — progress` : "CS2 progress";

  return { title, description: "Last matches compared with the ones before." };
}

function PlayerForm({ value }: { value?: string }) {
  return (
    <form action="/progress" className="flex flex-wrap gap-2">
      <label className="sr-only" htmlFor="progress-player">
        FACEIT nickname
      </label>
      <input
        id="progress-player"
        name="player"
        defaultValue={value}
        required
        pattern="[A-Za-z0-9_.\-]{1,30}"
        placeholder="FACEIT nickname"
        className="h-10 min-w-0 flex-1 rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 text-sm text-[var(--text)]"
      />
      <button
        type="submit"
        className="h-10 rounded-md border border-[var(--text)] px-4 text-sm font-medium text-[var(--text)]"
      >
        Show progress
      </button>
    </form>
  );
}

async function ProgressContent({
  player,
  windowParam,
}: {
  player: string;
  windowParam: string | undefined;
}) {
  if (!NICKNAME_PATTERN.test(player)) {
    return <Notice>{messageForCode("INVALID_NICKNAME")}</Notice>;
  }

  const loaded = await loadMatches(player);

  if ("error" in loaded) {
    return <Notice>{loaded.error}</Notice>;
  }

  if (loaded.matches.length === 0) {
    return <Notice>{messageForCode("NO_STATS", [loaded.nickname])}</Notice>;
  }

  return (
    <PeriodComparisonView
      nickname={loaded.nickname}
      data={comparePeriods(loaded.matches, parsePeriodWindow(windowParam))}
    />
  );
}

async function loadMatches(player: string) {
  try {
    const profile = await resolveProfile(player);
    const { matches } = await syncPlayerMatches(profile.playerId);
    return { nickname: profile.nickname, matches };
  } catch (error) {
    if (isApiError(error)) {
      return { error: messageForCode(error.code, error.nicknames) };
    }

    throw error;
  }
}

function Notice({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-5xl px-4">
      <p className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-5 text-sm">
        {children}
      </p>
    </div>
  );
}

export default async function ProgressPage({
  searchParams,
}: ProgressPageProps) {
  const { player, window } = await searchParams;

  return (
    <>
      <SiteHeader />
      <main className="min-h-[calc(100vh-56px)] space-y-6 bg-[var(--bg)] py-8 text-[var(--text)]">
        <div className="mx-auto max-w-5xl px-4">
          <PlayerForm value={player} />
        </div>
        {player ? (
          <ProgressContent player={player} windowParam={window} />
        ) : null}
      </main>
    </>
  );
}
