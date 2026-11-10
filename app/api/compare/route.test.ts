import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  MINA616_ID,
  readFixture,
  type FixturePlayer,
} from "@/lib/__tests__/fixtures";
import { GET } from "./route";
import { clearCacheForTests } from "@/lib/cache";
import {
  getPlayerById,
  getPlayerByNickname,
  getPlayerStats,
} from "@/lib/faceitClient";
import { clearRateLimitForTests } from "@/lib/rateLimit";

vi.mock("@/lib/faceitClient", () => ({
  getPlayerByNickname: vi.fn(),
  getPlayerById: vi.fn(),
  getPlayerStats: vi.fn(),
}));

const mockedGetPlayerByNickname = vi.mocked(getPlayerByNickname);
const mockedGetPlayerById = vi.mocked(getPlayerById);
const mockedGetPlayerStats = vi.mocked(getPlayerStats);

function sample<T>(player: FixturePlayer, fileName: string): T {
  return readFixture<T>(player, fileName);
}

function request(pathname: string) {
  return new Request(`http://localhost${pathname}`);
}

async function readJson(response: Response) {
  return await response.json() as unknown;
}

function faceitError(status: number, body = "FACEIT private details") {
  return Object.assign(new Error(`FACEIT ${status}: ${body}`), {
    status,
    body,
  });
}

function mockExistingPlayer(nickname: FixturePlayer) {
  const profile = sample<Record<string, unknown>>(nickname, "player.json");
  const stats = sample<Record<string, unknown>>(nickname, "stats.json");
  const playerId = profile.player_id as string;

  mockedGetPlayerByNickname.mockResolvedValueOnce(profile);
  mockedGetPlayerStats.mockResolvedValueOnce(stats);
  return playerId;
}

beforeEach(() => {
  vi.clearAllMocks();
  clearCacheForTests();
  clearRateLimitForTests();
});

describe("GET /api/compare", () => {
  it("returns 404 PLAYER_NOT_FOUND when the exact nickname lookup returns 404", async () => {
    mockedGetPlayerByNickname
      .mockRejectedValueOnce(faceitError(404, ""))
      .mockResolvedValueOnce(sample("mina616", "player.json"));
    mockedGetPlayerStats.mockResolvedValueOnce(sample("mina616", "stats.json"));

    const response = await GET(
      request("/api/compare?playerA=missing&playerB=mina616"),
    );
    const body = await readJson(response);

    expect(response.status).toBe(404);
    expect(body).toEqual({
      error: {
        code: "PLAYER_NOT_FOUND",
        message: "Player not found: missing",
        nicknames: ["missing"],
      },
    });
  });

  it("returns both nicknames when both players are not found", async () => {
    mockedGetPlayerByNickname
      .mockRejectedValueOnce(faceitError(404, ""))
      .mockRejectedValueOnce(faceitError(404, ""));

    const response = await GET(
      request("/api/compare?playerA=missingA&playerB=missingB"),
    );
    const body = await readJson(response);

    expect(response.status).toBe(404);
    expect(body).toEqual({
      error: {
        code: "PLAYER_NOT_FOUND",
        message: "Players not found: missingA, missingB",
        nicknames: ["missingA", "missingB"],
      },
    });
  });

  it("returns profiles with comparison null and NO_STATS when a stats response has no lifetime", async () => {
    mockExistingPlayer("mina616");
    const profile = sample<Record<string, unknown>>("opponent-a", "player.json");
    mockedGetPlayerByNickname.mockResolvedValueOnce(profile);
    mockedGetPlayerStats.mockResolvedValueOnce({});

    const response = await GET(
      request("/api/compare?playerA=mina616&playerB=opponent-a"),
    );
    const body = await response.json() as {
      comparison: unknown;
      notice?: string;
      playerA: unknown;
      playerB: unknown;
    };

    expect(response.status).toBe(200);
    expect(body.comparison).toBeNull();
    expect(body.notice).toBe("NO_STATS");
    expect(body.playerA).toBeTruthy();
    expect(body.playerB).toBeTruthy();
  });

  it("rejects the same player with different case before requests", async () => {
    const response = await GET(
      request("/api/compare?playerA=mina616&playerB=MINA616"),
    );
    const body = await readJson(response);

    expect(response.status).toBe(400);
    expect(body).toEqual({
      error: {
        code: "SAME_PLAYER",
        message: "Choose two different players.",
        nicknames: [],
      },
    });
    expect(mockedGetPlayerByNickname).not.toHaveBeenCalled();
  });

  it("rejects nicknames with spaces or cyrillic characters before requests", async () => {
    const withSpace = await GET(
      request("/api/compare?playerA=mina616%20x&playerB=opponent-a"),
    );
    const withCyrillic = await GET(
      request("/api/compare?playerA=%D0%BC%D0%B8%D0%BD%D0%B0&playerB=opponent-a"),
    );

    expect(withSpace.status).toBe(400);
    expect(await readJson(withSpace)).toEqual({
      error: {
        code: "INVALID_NICKNAME",
        message:
          "Invalid nickname. Use 1-30 characters: letters, digits, dash, underscore, or dot.",
        nicknames: [],
      },
    });
    expect(withCyrillic.status).toBe(400);
    expect(mockedGetPlayerByNickname).not.toHaveBeenCalled();
  });

  it("maps FACEIT 429 to RATE_LIMITED", async () => {
    mockedGetPlayerByNickname.mockRejectedValueOnce(faceitError(429));
    mockExistingPlayer("opponent-a");

    const response = await GET(
      request("/api/compare?playerA=mina616&playerB=opponent-a"),
    );
    const body = await readJson(response);

    expect(response.status).toBe(429);
    expect(body).toEqual({
      error: {
        code: "RATE_LIMITED",
        message: "FACEIT API rate limit reached. Please try again later.",
        nicknames: [],
      },
    });
  });

  it("rate limits /api/compare to 20 requests per minute per IP", async () => {
    for (let index = 0; index < 20; index += 1) {
      const response = await GET(
        new Request("http://localhost/api/compare?playerA=mina616&playerB=MINA616", {
          headers: {
            "x-forwarded-for": "203.0.113.10",
          },
        }),
      );

      expect(response.status).toBe(400);
    }

    const response = await GET(
      new Request("http://localhost/api/compare?playerA=mina616&playerB=MINA616", {
        headers: {
          "x-forwarded-for": "203.0.113.10",
        },
      }),
    );
    const body = await readJson(response);

    expect(response.status).toBe(429);
    expect(body).toEqual({
      error: {
        code: "RATE_LIMITED",
        message: "FACEIT API rate limit reached. Please try again later.",
        nicknames: [],
      },
    });
  });

  it("maps FACEIT 500 to UPSTREAM_ERROR without proxying the FACEIT body", async () => {
    mockedGetPlayerByNickname.mockRejectedValueOnce(
      faceitError(500, "FACEIT exploded with secret details"),
    );
    mockExistingPlayer("opponent-a");

    const response = await GET(
      request("/api/compare?playerA=mina616&playerB=opponent-a"),
    );
    const bodyText = await response.text();

    expect(response.status).toBe(502);
    expect(bodyText).toContain("UPSTREAM_ERROR");
    expect(bodyText).not.toContain("FACEIT exploded");
    expect(bodyText).not.toContain("secret details");
  });

  it("maps FACEIT timeout to UPSTREAM_ERROR with HTTP 504", async () => {
    mockedGetPlayerByNickname.mockRejectedValueOnce(faceitError(504, "timeout body"));
    mockExistingPlayer("opponent-a");

    const response = await GET(
      request("/api/compare?playerA=mina616&playerB=opponent-a"),
    );
    const body = await readJson(response);

    expect(response.status).toBe(504);
    expect(body).toEqual({
      error: {
        code: "UPSTREAM_ERROR",
        message: "FACEIT API is unavailable. Please try again later.",
        nicknames: [],
      },
    });
  });

  it("returns a comparison for mocked mina616 and opponent-a data", async () => {
    mockExistingPlayer("mina616");
    mockExistingPlayer("opponent-a");

    const response = await GET(
      request("/api/compare?playerA=mina616&playerB=opponent-a"),
    );
    const body = await response.json() as {
      comparison: {
        biggestGap: {
          metricKey: string;
        };
      };
    };

    expect(response.status).toBe(200);
    expect(body.comparison.biggestGap.metricKey).toBe("clutch1v2");
  });

  it("looks players up by exact nickname and uses the returned profile", async () => {
    const playerId = mockExistingPlayer("mina616");
    mockExistingPlayer("opponent-a");

    const response = await GET(
      request("/api/compare?playerA=mina616&playerB=opponent-a"),
    );
    const body = await response.json() as {
      playerA: { profile: { playerId: string; nickname: string } };
    };

    expect(response.status).toBe(200);
    expect(mockedGetPlayerByNickname).toHaveBeenCalledWith("mina616");
    expect(mockedGetPlayerById).not.toHaveBeenCalled();
    expect(body.playerA.profile.playerId).toBe(playerId);
    expect(playerId).toBe(MINA616_ID);
    expect(body.playerA.profile.nickname).toBe("mina616");
  });

  it("uses cached player IDs, profiles, and stats on the second identical request", async () => {
    mockExistingPlayer("mina616");
    mockExistingPlayer("opponent-a");

    const first = await GET(
      request("/api/compare?playerA=mina616&playerB=opponent-a"),
    );
    const faceitCallsAfterFirst =
      mockedGetPlayerByNickname.mock.calls.length +
      mockedGetPlayerById.mock.calls.length +
      mockedGetPlayerStats.mock.calls.length;

    const second = await GET(
      request("/api/compare?playerA=mina616&playerB=opponent-a"),
    );
    const faceitCallsAfterSecond =
      mockedGetPlayerByNickname.mock.calls.length +
      mockedGetPlayerById.mock.calls.length +
      mockedGetPlayerStats.mock.calls.length;
    const secondRequestFaceitCalls =
      faceitCallsAfterSecond - faceitCallsAfterFirst;

    console.log(
      `Cache check: FACEIT calls after first request=${faceitCallsAfterFirst}; after second request=${faceitCallsAfterSecond}; second request FACEIT calls=${secondRequestFaceitCalls}`,
    );

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(faceitCallsAfterFirst).toBe(4);
    expect(faceitCallsAfterSecond).toBe(faceitCallsAfterFirst);
  });
});
