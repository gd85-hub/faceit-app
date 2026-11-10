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
}
