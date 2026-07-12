import type { Player } from "@/types/stats";

type ContextNoticeProps = {
  playerA: Player;
  playerB: Player;
};

function matches(player: Player) {
  return player.stats?.metrics.matches ?? null;
}

export function ContextNotice({ playerA, playerB }: ContextNoticeProps) {
  return (
    <div className="text-[var(--text-dim)]">
      <p className="text-sm">
        Lifetime stats {"\u00B7"} {playerA.profile.nickname}{" "}
        <span className="tabular-nums">{matches(playerA) ?? "\u2014"}</span>{" "}
        matches {"\u00B7"} {playerB.profile.nickname}{" "}
        <span className="tabular-nums">{matches(playerB) ?? "\u2014"}</span>{" "}
        matches
      </p>
      <p className="mt-1 text-xs">All numbers are career totals, not recent form.</p>
    </div>
  );
}
