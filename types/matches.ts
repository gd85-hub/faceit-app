/**
 * Skill levels of the ten lobby players, captured when the match was
 * collected. FACEIT only reports a player's *current* level, so this is only
 * a faithful picture of the lobby when collected_at is close to the match
 * time; it cannot be reconstructed later.
 */
export interface LobbySnapshot {
  /** ISO time the levels were read from FACEIT. */
  collected_at: string;
  players: Array<{
    team: "own" | "enemy";
    /** True for the archive owner. */
    self: boolean;
    skill_level: number | null;
  }>;
}

/** One match from the player's point of view, as kept in storage. */
export interface CollectedMatch {
  match_id: string;
  /** ISO time the match finished; null when FACEIT gave no usable time. */
  finished_at: string | null;
  map: string | null;
  result: "W" | "L" | null;
  kills: number | null;
  deaths: number | null;
  assists: number | null;
  adr: number | null;
  hs_percent: number | null;
  rounds: number | null;
  /** Lobby skill levels; null when the match was not found in /history. */
  lobby?: LobbySnapshot | null;
}
