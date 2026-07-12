import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { loadEnvConfig } from "@next/env";
import {
  getPlayerById,
  getPlayerStats,
  searchPlayer,
  type FaceitFetchError,
} from "../lib/faceitClient";

loadEnvConfig(process.cwd());

const NICKNAMES = [
  "minaa_",
  "I-Perfect-I",
  "Eyes_team",
  "zzz_does_not_exist_9182", // Intentionally nonexistent; captures error format.
];

const REQUEST_DELAY_MS = 300;

type SearchResponse = {
  items?: Array<{
    player_id?: string;
  }>;
};

async function saveJson(filePath: string, value: unknown) {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function parseBody(body: string | undefined) {
  if (!body) {
    return undefined;
  }

  try {
    return JSON.parse(body) as unknown;
  } catch {
    return body;
  }
}

function errorToJson(error: unknown) {
  if (error instanceof Error) {
    const faceitError = error as FaceitFetchError;

    return {
      error: error.message,
      name: error.name,
      status: faceitError.status,
      body: parseBody(faceitError.body),
    };
  }

  return { error: String(error) };
}

function responseBodyFromError(error: unknown) {
  if (error instanceof Error) {
    const faceitError = error as FaceitFetchError;
    const body = parseBody(faceitError.body);

    if (body !== undefined) {
      return body;
    }
  }

  return errorToJson(error);
}

function logError(prefix: string, error: unknown) {
  if (error instanceof Error) {
    const faceitError = error as FaceitFetchError;

    console.error(`${prefix}: ${error.message}`);

    if (faceitError.status) {
      console.error(`${prefix}: HTTP ${faceitError.status}`);
    }

    if (faceitError.body) {
      console.error(`${prefix}: body ${faceitError.body}`);
    }

    return;
  }

  console.error(`${prefix}: ${String(error)}`);
}

function delay() {
  return new Promise((resolve) => setTimeout(resolve, REQUEST_DELAY_MS));
}

async function dumpNickname(nickname: string) {
  const sampleDir = path.join(process.cwd(), "api-samples", nickname);
  await mkdir(sampleDir, { recursive: true });

  let search: SearchResponse;

  try {
    console.log(`\n${nickname}: search`);
    search = (await searchPlayer(nickname)) as SearchResponse;
  } catch (error) {
    await saveJson(path.join(sampleDir, "search-error.json"), responseBodyFromError(error));
    logError(`${nickname}: search failed`, error);
    return;
  }

  await saveJson(path.join(sampleDir, "search.json"), search);
  await delay();

  const playerId = search.items?.[0]?.player_id;
  if (!playerId) {
    await saveJson(path.join(sampleDir, "search-error.json"), search);
    console.error(`${nickname}: search returned no player_id`);
    return;
  }

  try {
    console.log(`${nickname}: player ${playerId}`);
    const player = await getPlayerById(playerId);
    await saveJson(path.join(sampleDir, "player.json"), player);
  } catch (error) {
    await saveJson(path.join(sampleDir, "player-error.json"), errorToJson(error));
    logError(`${nickname}: player failed`, error);
    return;
  }

  await delay();

  const statsAttempts = ["cs2", "csgo"] as const;
  let lastError: unknown;

  for (const gameId of statsAttempts) {
    try {
      console.log(`${nickname}: stats ${gameId}`);
      const stats = await getPlayerStats(playerId, gameId);
      await saveJson(path.join(sampleDir, "stats.json"), stats);
      console.log(`${nickname}: stats game_id worked: ${gameId}`);
      return;
    } catch (error) {
      lastError = error;
      logError(`${nickname}: stats ${gameId} failed`, error);
      await delay();
    }
  }

  await saveJson(path.join(sampleDir, "stats.error.json"), errorToJson(lastError));
}

async function main() {
  for (const nickname of NICKNAMES) {
    try {
      await dumpNickname(nickname);
    } catch (error) {
      const sampleDir = path.join(process.cwd(), "api-samples", nickname);
      await mkdir(sampleDir, { recursive: true });
      await saveJson(path.join(sampleDir, "dump.error.json"), errorToJson(error));
      logError(`${nickname}: dump failed`, error);
    }

    await delay();
  }
}

main().catch((error) => {
  console.error("Unexpected dump failure", error);
  process.exitCode = 1;
});
