import { beforeEach, describe, expect, it, vi } from "vitest";
import { getPlayerHistory, getPlayerMatchStats } from "@/lib/faceitClient";
import { syncPlayerMatches } from "@/lib/matchArchive";
import {
  StoreConflictError,
  memoryMatchStore,
  mergeMatches,
} from "@/lib/matchStore";
import type { CollectedMatch } from "@/types/matches";
import { MINA616_ID } from "./fixtures";
import { pagedFixture } from "./faceitMock";

vi.mock("@/lib/faceitClient", () => ({
  getPlayerMatchStats: vi.fn(),
  getPlayerHistory: vi.fn(),
}));

const mockedMatchStats = vi.mocked(getPlayerMatchStats);

function match(id: string, finishedAt: string, kills = 10): CollectedMatch {
  return {
    match_id: id,
    finished_at: finishedAt,
    map: "de_mirage",
    result: "W",
    kills,
    deaths: 10,
    assists: 2,
    adr: 80,
    hs_percent: 40,
    rounds: 24,
  };
}

beforeEach(() => {
  vi.resetAllMocks();
  mockedMatchStats.mockImplementation(pagedFixture("mina616", "games-stats.json"));
  vi.mocked(getPlayerHistory).mockImplementation(pagedFixture("mina616", "history.json"));
});

describe("mergeMatches", () => {
  it("drops duplicates by match_id, keeps the stored copy, sorts newest first", () => {
    const stored = [match("b", "2026-11-02T00:00:00Z", 10)];
    const incoming = [
      match("b", "2026-11-02T00:00:00Z", 99),
      match("c", "2026-11-03T00:00:00Z"),
      match("a", "2026-11-01T00:00:00Z"),
    ];

    const merged = mergeMatches(stored, incoming);

    expect(merged.map((item) => item.match_id)).toEqual(["c", "b", "a"]);
    expect(merged[1].kills).toBe(10);
  });
});

describe("syncPlayerMatches", () => {
  it("stores all collected matches on the first run", async () => {
    const store = memoryMatchStore();

    const document = await syncPlayerMatches(MINA616_ID, store);

    expect(document.matches).toHaveLength(250);
    expect(store.documents.get(MINA616_ID)?.document.matches).toHaveLength(250);
    expect(mockedMatchStats).toHaveBeenCalledTimes(3);
  });

  it("appends only new matches on later runs with a single request", async () => {
    const store = memoryMatchStore();
    const full = await syncPlayerMatches(MINA616_ID, store);
    // Pretend the three newest matches were not stored yet.
    const stored = store.documents.get(MINA616_ID)!;
    stored.document.matches = stored.document.matches.slice(3);
    mockedMatchStats.mockClear();

    const document = await syncPlayerMatches(MINA616_ID, store);

    expect(mockedMatchStats).toHaveBeenCalledTimes(1);
    expect(document.matches.map((item) => item.match_id)).toEqual(
      full.matches.map((item) => item.match_id),
    );
    expect(store.documents.get(MINA616_ID)?.document.matches).toHaveLength(250);
  });

  it("re-merges onto a concurrent write instead of losing it", async () => {
    const store = memoryMatchStore();
    const concurrent = match("concurrent", "2026-01-01T00:00:00Z");
    const write = store.write.bind(store);
    let first = true;
    store.write = async (playerId, document, etag) => {
      if (first) {
        first = false;
        await write(playerId, { ...document, matches: [concurrent] }, etag);
        throw new StoreConflictError(playerId);
      }
      return write(playerId, document, etag);
    };

    const document = await syncPlayerMatches(MINA616_ID, store);

    expect(document.matches).toHaveLength(251);
    expect(document.matches.at(-1)?.match_id).toBe("concurrent");
  });

  it("still returns matches when storage is not configured", async () => {
    const document = await syncPlayerMatches(MINA616_ID, null);

    expect(document.matches).toHaveLength(250);
  });

  it("still returns matches when the store write fails", async () => {
    const store = memoryMatchStore();
    store.write = async () => {
      throw new Error("blob is down");
    };
    vi.spyOn(console, "error").mockImplementation(() => {});

    const document = await syncPlayerMatches(MINA616_ID, store);

    expect(document.matches).toHaveLength(250);
  });

  it("snapshots the ten-player lobby with collected_at for each new match", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-11-10T12:00:00Z"));

    try {
      const document = await syncPlayerMatches(MINA616_ID, memoryMatchStore());
      const lobby = document.matches[0].lobby;

      expect(lobby?.collected_at).toBe("2026-11-10T12:00:00.000Z");
      expect(lobby?.players).toHaveLength(10);
      expect(lobby?.players.filter((player) => player.team === "own")).toHaveLength(5);
      expect(lobby?.players.filter((player) => player.self)).toEqual([
        { team: "own", self: true, skill_level: 7 },
      ]);
      expect(document.matches.every((item) => item.lobby?.players.length === 10)).toBe(
        true,
      );
      // 250 matches -> 3 history pages of 100.
      expect(vi.mocked(getPlayerHistory)).toHaveBeenCalledTimes(3);
    } finally {
      vi.useRealTimers();
    }
  });

  it("does not re-snapshot stored matches", async () => {
    const store = memoryMatchStore();
    await syncPlayerMatches(MINA616_ID, store);
    const stored = store.documents.get(MINA616_ID)!;
    const keptLobby = stored.document.matches[5].lobby;
    stored.document.matches = stored.document.matches.slice(2);
    vi.mocked(getPlayerHistory).mockClear();

    const document = await syncPlayerMatches(MINA616_ID, store);

    // Two new matches fit in the first history page.
    expect(vi.mocked(getPlayerHistory)).toHaveBeenCalledTimes(1);
    expect(document.matches[5].lobby).toEqual(keptLobby);
  });

  it("keeps new matches with lobby null when /history fails", async () => {
    vi.mocked(getPlayerHistory).mockRejectedValue(
      Object.assign(new Error("boom"), { status: 500 }),
    );
    vi.spyOn(console, "error").mockImplementation(() => {});

    const document = await syncPlayerMatches(MINA616_ID, memoryMatchStore());

    expect(document.matches).toHaveLength(250);
    expect(document.matches.every((item) => item.lobby === null)).toBe(true);
  });
});
