import { beforeEach, describe, expect, it, vi } from "vitest";
import { getPlayerMatchStats } from "@/lib/faceitClient";
import {
  BULK_PAGE_LIMIT,
  fetchRecentMatches,
  normalizeBulkItem,
} from "@/lib/matchCollector";
import { MINA616_ID } from "./fixtures";
import { fixtureItems, pagedFixture } from "./faceitMock";

vi.mock("@/lib/faceitClient", () => ({
  getPlayerMatchStats: vi.fn(),
}));

const mockedMatchStats = vi.mocked(getPlayerMatchStats);

beforeEach(() => {
  vi.resetAllMocks();
  mockedMatchStats.mockImplementation(pagedFixture("mina616", "games-stats.json"));
});

describe("normalizeBulkItem", () => {
  it("reads one bulk stats item into a stored match", () => {
    const match = normalizeBulkItem(fixtureItems("mina616", "games-stats.json")[0]);

    expect(match).toMatchObject({
      match_id: expect.stringMatching(/^1-/),
      map: "de_inferno",
      result: "W",
      kills: 12,
      deaths: 7,
      adr: 65.9,
      hs_percent: 42,
      rounds: 14,
    });
    expect(match?.finished_at).toBe("2026-11-09T19:13:35.105Z");
  });

  it("skips items without a match id", () => {
    expect(normalizeBulkItem({ stats: { Kills: "10" } })).toBeNull();
    expect(normalizeBulkItem(null)).toBeNull();
  });
});

describe("fetchRecentMatches", () => {
  it("collects 250 matches in three bulk requests", async () => {
    const matches = await fetchRecentMatches(MINA616_ID);

    expect(matches).toHaveLength(250);
    expect(mockedMatchStats).toHaveBeenCalledTimes(3);
    expect(mockedMatchStats.mock.calls.map((call) => call[2])).toEqual([
      { offset: 0, limit: BULK_PAGE_LIMIT },
      { offset: 100, limit: BULK_PAGE_LIMIT },
      { offset: 200, limit: BULK_PAGE_LIMIT },
    ]);
    expect(new Set(matches.map((match) => match.match_id)).size).toBe(250);
  });

  it("stops at the first page that reaches an already stored match", async () => {
    const all = await fetchRecentMatches(MINA616_ID);
    mockedMatchStats.mockClear();
    const known = new Set(all.slice(5).map((match) => match.match_id));

    const fresh = await fetchRecentMatches(MINA616_ID, { knownMatchIds: known });

    expect(fresh.map((match) => match.match_id)).toEqual(
      all.slice(0, 5).map((match) => match.match_id),
    );
    expect(mockedMatchStats).toHaveBeenCalledTimes(1);
  });
});
