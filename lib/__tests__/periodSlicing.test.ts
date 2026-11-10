import { beforeEach, describe, expect, it, vi } from "vitest";
import { getPlayerHistory, getPlayerMatchStats } from "@/lib/faceitClient";
import { syncPlayerMatches } from "@/lib/matchArchive";
import { fetchRecentMatches } from "@/lib/matchCollector";
import { memoryMatchStore } from "@/lib/matchStore";
import { comparePeriods, PERIOD_WINDOWS } from "@/lib/periodMetrics";
import { MINA616_ID } from "./fixtures";
import { fixtureItems, pagedFixture } from "./faceitMock";

vi.mock("@/lib/faceitClient", () => ({
  getPlayerMatchStats: vi.fn(),
  getPlayerHistory: vi.fn(),
}));

type RawItem = { stats: Record<string, string | number> };

const raw = fixtureItems("mina616", "games-stats.json") as RawItem[];

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(getPlayerMatchStats).mockImplementation(
    pagedFixture("mina616", "games-stats.json"),
  );
  vi.mocked(getPlayerHistory).mockImplementation(
    pagedFixture("mina616", "history.json"),
  );
});

describe("period slicing on the stored archive", () => {
  for (const window of PERIOD_WINDOWS) {
    it(`splits the newest ${window * 2} matches into two disjoint periods of ${window}`, async () => {
      const { matches } = await syncPlayerMatches(MINA616_ID, memoryMatchStore());
      const result = comparePeriods(matches, window);
      const chart = result.chartMatches; // previous..., recent... (oldest first)
      const previous = chart.slice(0, window);
      const recent = chart.slice(window);
      const ids = chart.map((match) => match.match_id);

      expect(previous).toHaveLength(window);
      expect(recent).toHaveLength(window);
      expect(new Set(ids).size).toBe(window * 2);
      // Exactly the newest 2N matches from FACEIT, none lost, none extra.
      expect(new Set(ids)).toEqual(
        new Set(raw.slice(0, window * 2).map((item) => item.stats["Match Id"])),
      );
      // Every recent match is newer than every previous one.
      const newestPrevious = previous.at(-1)!.finished_at!;
      expect(recent.every((match) => match.finished_at! > newestPrevious)).toBe(
        true,
      );
    });
  }

  it("computes win rate from the same matches FACEIT reports", async () => {
    const { matches } = await syncPlayerMatches(MINA616_ID, memoryMatchStore());
    const result = comparePeriods(matches, 30);
    const winRate = result.metrics.find((metric) => metric.key === "winRate")!;
    const wins = (items: RawItem[]) =>
      items.filter((item) => item.stats.Result === "1").length;

    expect(winRate.valueA).toBeCloseTo((wins(raw.slice(0, 30)) / 30) * 100);
    expect(winRate.valueB).toBeCloseTo((wins(raw.slice(30, 60)) / 30) * 100);
  });

  it("drops a match repeated across pages when FACEIT shifts its paging", async () => {
    // A new match arrives between page requests: page 2 starts one item
    // earlier, so its first item repeats the last item of page 1.
    vi.mocked(getPlayerMatchStats).mockImplementation(
      async (_playerId, _gameId, page) => {
        const start = page.offset === 0 ? 0 : page.offset - 1;
        return { items: raw.slice(start, start + page.limit) };
      },
    );

    const matches = await fetchRecentMatches(MINA616_ID);
    const ids = matches.map((match) => match.match_id);

    expect(new Set(ids).size).toBe(ids.length);
  });

  it("keeps the order by finish time even if storage order is scrambled", async () => {
    const store = memoryMatchStore();
    await syncPlayerMatches(MINA616_ID, store);
    const stored = store.documents.get(MINA616_ID)!;
    stored.document.matches = stored.document.matches.toReversed();
    vi.mocked(getPlayerMatchStats).mockResolvedValue({ items: raw.slice(0, 1) });

    const { matches } = await syncPlayerMatches(MINA616_ID, store);
    const recent = comparePeriods(matches, 30).chartMatches.slice(30);

    expect(recent.at(-1)!.match_id).toBe(raw[0].stats["Match Id"]);
  });
});
