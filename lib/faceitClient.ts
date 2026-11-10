const FACEIT_BASE_URL = "https://open.faceit.com/data/v4";
const FACEIT_TIMEOUT_MS = 8000;

export type FaceitFetchError = Error & {
  status?: number;
  body?: string;
};

export async function faceitFetch<T>(path: string): Promise<T> {
  const apiKey = process.env.FACEIT_API_KEY;

  if (!apiKey) {
    const error = new Error("FACEIT_API_KEY is not configured") as FaceitFetchError;
    error.status = 500;
    throw error;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FACEIT_TIMEOUT_MS);

  try {
    const response = await fetch(`${FACEIT_BASE_URL}${path}`, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
      signal: controller.signal,
    });

    if (!response.ok) {
      const body = await response.text();
      const error = new Error(
        `FACEIT API request failed with HTTP ${response.status}: ${body}`,
      ) as FaceitFetchError;
      error.status = response.status;
      error.body = body;
      throw error;
    }

    return (await response.json()) as T;
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      const timeoutError = new Error(
        `FACEIT API request timed out after ${FACEIT_TIMEOUT_MS}ms`,
      ) as FaceitFetchError;
      timeoutError.status = 504;
      throw timeoutError;
    }

    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Exact nickname lookup. Returns the full player object, or fails with HTTP 404
 * when no account has this nickname. Unlike /search/players there is no list of
 * candidates to pick from.
 */
export function getPlayerByNickname(nickname: string): Promise<unknown> {
  const params = new URLSearchParams({ nickname });
  return faceitFetch(`/players?${params.toString()}`);
}

export function getPlayerById(playerId: string): Promise<unknown> {
  return faceitFetch(`/players/${encodeURIComponent(playerId)}`);
}

export function getPlayerStats(
  playerId: string,
  gameId: string,
): Promise<unknown> {
  return faceitFetch(
    `/players/${encodeURIComponent(playerId)}/stats/${encodeURIComponent(gameId)}`,
  );
}
