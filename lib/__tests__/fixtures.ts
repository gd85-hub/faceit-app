import { readFileSync } from "node:fs";
import path from "node:path";

export const FIXTURE_DIR = path.join(process.cwd(), "fixtures", "faceit");

export const MINA616_ID = "dbe1f3ef-69d2-4c4c-a435-98f7220b1d28";

export type FixturePlayer = "mina616" | "opponent-a" | "opponent-b";

/** Reads a committed, anonymized FACEIT response from fixtures/faceit/. */
export function readFixture<T = unknown>(player: FixturePlayer, fileName: string): T {
  return JSON.parse(
    readFileSync(path.join(FIXTURE_DIR, player, fileName), "utf8"),
  ) as T;
}
