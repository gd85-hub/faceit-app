import { readFile, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { loadEnvConfig } from "@next/env";
import { faceitFetch } from "../lib/faceitClient";

loadEnvConfig(process.cwd());

const REQUEST_DELAY_MS = 300;
const SAMPLE_DIR = path.join(process.cwd(), "api-samples", "minaa_");

type PlayerSample = {
  player_id?: unknown;
};

type HistoryResponse = {
  items?: Array<{
    match_id?: unknown;
  }>;
};

async function delay() {
  await new Promise((resolve) => setTimeout(resolve, REQUEST_DELAY_MS));
}

async function saveJson(filePath: string, value: unknown) {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

async function readPlayerId() {
  const raw = await readFile(path.join(SAMPLE_DIR, "player.json"), "utf8");
  const player = JSON.parse(raw) as PlayerSample;

  if (typeof player.player_id !== "string") {
    throw new Error("api-samples/minaa_/player.json has no player_id");
  }

  return player.player_id;
}

async function main() {
  const playerId = await readPlayerId();
  const history = await faceitFetch<HistoryResponse>(
    `/players/${encodeURIComponent(playerId)}/history?game=cs2&offset=0&limit=5`,
  );
  await saveJson(path.join(SAMPLE_DIR, "history.json"), history);

  await delay();

  const matchId = history.items?.[0]?.match_id;
  if (typeof matchId !== "string") {
    throw new Error("history response has no first match_id");
  }

  const matchStats = await faceitFetch(
    `/matches/${encodeURIComponent(matchId)}/stats`,
  );
  await saveJson(path.join(SAMPLE_DIR, "match-stats.json"), matchStats);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
