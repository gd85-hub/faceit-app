import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";
import { clearCacheForTests } from "@/lib/cache";
import {
  getPlayerById,
  getPlayerByNickname,
  getPlayerMatchStats,
} from "@/lib/faceitClient";
import { clearMatchSeriesCacheForTests } from "@/lib/matchSeriesCache";
import { clearRateLimitForTests } from "@/lib/rateLimit";
import { readFixture } from "@/lib/__tests__/fixtures";
import { pagedFixture } from "@/lib/__tests__/faceitMock";

vi.mock("@/lib/faceitClient", () => ({
  getPlayerByNickname: vi.fn(),
  getPlayerById: vi.fn(),
  getPlayerMatchStats: vi.fn(),
}));

const mockedLookup = vi.mocked(getPlayerByNickname);
const mockedMatchStats = vi.mocked(getPlayerMatchStats);

beforeEach(() => {
  vi.resetAllMocks();
  clearCacheForTests();
  clearMatchSeriesCacheForTests();
  clearRateLimitForTests();
  mockedLookup.mockImplementation(async (nickname: string) => ({
    ...readFixture<Record<string, unknown>>("mina616", "player.json"),
    nickname,
    player_id: nickname === "mina616"
      ? readFixture<{ player_id: string }>("mina616", "player.json").player_id
      : `id-${nickname}`,
  }));
  mockedMatchStats.mockImplementation(pagedFixture("mina616", "games-stats.json"));
});

describe("GET /api/match-series", () => {
  it("builds both series from bulk stats with a fixed request budget", async () => {
    const response = await GET(
      new Request(
        "http://localhost/api/match-series?playerA=mina616&playerB=opponent-a&metric=kd",
      ),
    );
    const body = await response.json() as {
      players: { A: { points: Array<{ raw: number | null; date: string }> } };
    };

    expect(response.status).toBe(200);
    expect(body.players.A.points).toHaveLength(20);
    expect(body.players.A.points.every((point) => point.raw !== null)).toBe(true);
    // Oldest first.
    expect(body.players.A.points[0].date < body.players.A.points[19].date).toBe(true);
    // 1 lookup + 3 bulk pages per player, no per-match requests.
    expect(mockedLookup).toHaveBeenCalledTimes(2);
    expect(mockedMatchStats).toHaveBeenCalledTimes(6);
    expect(vi.mocked(getPlayerById)).not.toHaveBeenCalled();
  });
});
