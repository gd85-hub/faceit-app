import { RecentForm } from "@/components/RecentForm";
import type { PlayerProfile } from "@/types/stats";

type PlayerCardProps = {
  profile: PlayerProfile;
  recentResults: ("W" | "L")[] | null;
};

function valueOrDash(value: number | string | null) {
  return value === null ? "\u2014" : value;
}

function initial(nickname: string) {
  return nickname.trim().charAt(0).toUpperCase() || "?";
}

export function PlayerCard({ profile, recentResults }: PlayerCardProps) {
  return (
    <section className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3">
      <div className="flex min-h-[72px] items-center gap-3">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[var(--surface-2)] text-lg font-semibold text-[var(--text)] ring-1 ring-[var(--border)]">
          {profile.avatar === null ? (
            <span aria-hidden="true">{initial(profile.nickname)}</span>
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={profile.avatar}
              alt=""
              width={48}
              height={48}
              className="h-full w-full object-cover"
            />
          )}
        </div>

        <div className="min-w-0 flex-1">
          <h2 className="truncate text-lg font-semibold text-[var(--text)]">
            {profile.nickname}
          </h2>
          <p className="mt-1 text-sm text-[var(--text-dim)]">
            LVL <span className="tabular-nums">{valueOrDash(profile.skillLevel)}</span>{" "}
            {"\u00b7"}{" "}
            <span className="tabular-nums">{valueOrDash(profile.elo)}</span> ELO
          </p>
        </div>

        <div className="shrink-0 text-right">
          <RecentForm recentResults={recentResults} />
        </div>
      </div>
    </section>
  );
}
