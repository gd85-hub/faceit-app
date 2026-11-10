import { vi } from "vitest";
import type { PageParams } from "@/lib/faceitClient";
import { readFixture, type FixturePlayer } from "./fixtures";

type ItemsResponse = { items: unknown[] };

/** Serves a slice of a committed list fixture, like FACEIT paging does. */
export function pagedFixture(player: FixturePlayer, fileName: string) {
  const all = readFixture<ItemsResponse>(player, fileName).items;

  return vi.fn(async (_playerId: string, _gameId: string, page: PageParams) => ({
    items: all.slice(page.offset, page.offset + page.limit),
    start: page.offset,
    end: page.offset + page.limit,
  }));
}

export function fixtureItems(player: FixturePlayer, fileName: string) {
  return readFixture<ItemsResponse>(player, fileName).items;
}
