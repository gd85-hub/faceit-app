/**
 * FACEIT Season 10 starts on this date and resets Elo. Anything plotted
 * across it must say that the change is a reset, not a drop in form.
 */
export const SEASON_10_START = "2026-12-09";

export const SEASON_10_START_MS = Date.parse(`${SEASON_10_START}T00:00:00Z`);

export const SEASON_RESET_LABEL = "Season 10: Elo reset, not a drop";

export const SEASON_RESET_NOTE =
  "Season 10 started on 9 December and FACEIT reset Elo for everyone. A lower Elo after that date is the reset, not a drop in form.";

function timeOf(date: string | null | undefined) {
  const ms = date ? Date.parse(date) : Number.NaN;
  return Number.isFinite(ms) ? ms : null;
}

/**
 * For dates ordered oldest to newest, returns the index of the first date on
 * or after the season start, but only when an earlier date falls before it
 * (the series actually crosses the reset). Otherwise null.
 */
export function seasonStartIndex(
  dates: ReadonlyArray<string | null | undefined>,
) {
  let sawBefore = false;

  for (const [index, date] of dates.entries()) {
    const ms = timeOf(date);

    if (ms === null) {
      continue;
    }

    if (ms < SEASON_10_START_MS) {
      sawBefore = true;
    } else {
      return sawBefore ? index : null;
    }
  }

  return null;
}

export function crossesSeasonStart(
  dates: ReadonlyArray<string | null | undefined>,
) {
  return seasonStartIndex(dates) !== null;
}
