/**
 * Builds the anonymized FACEIT fixture set in fixtures/faceit/.
 *
 * The fixtures are deterministic and synthetic: they follow the response
 * shapes of the FACEIT Data API v4, but contain no real third-party accounts.
 *
 * - mina616 keeps its real player_id and the lifetime values recorded for that
 *   player_id in FINDINGS.md. Avatar, Steam and friends fields are dropped.
 * - opponent-a / opponent-b are invented players. Their numbers are chosen so
 *   the comparison tests exercise every verdict branch (B_stronger fragging,
 *   A_stronger utility, an "even" utility metric, clutch1v2 as biggest gap).
 *
 * Run with: npx tsx scripts/build-fixtures.ts
 */
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const OUT_DIR = path.join(process.cwd(), "fixtures", "faceit");

type Lifetime = Record<string, string | string[]>;

// Lifetime values recorded in FINDINGS.md for player_id
// dbe1f3ef-69d2-4c4c-a435-98f7220b1d28.
const MINA616_LIFETIME: Lifetime = {
  "1v1 Win Rate": "0.36",
  "1v2 Win Rate": "0.22",
  ADR: "81.03",
  "Average Headshots %": "43",
  "Average K/D Ratio": "1.13",
  "Current Win Streak": "0",
  "Enemies Flashed per Round": "0.27",
  "Entry Rate": "0.18",
  "Entry Success Rate": "0.53",
  "Flash Success Rate": "0.53",
  "Flashes per Round": "0.35",
  "K/D Ratio": "1423.58",
  "Longest Win Streak": "7",
  Matches: "1259",
  "Recent Results": ["1", "0", "1", "0", "0"],
  "Sniper Kill Rate": "0.12",
  "Sniper Kill Rate per Round": "0.17",
  "Total 1v1 Count": "1064",
  "Total 1v1 Wins": "384",
  "Total 1v2 Count": "1221",
  "Total 1v2 Wins": "268",
  "Total Damage": "2246331",
  "Total Enemies Flashed": "7615",
  "Total Entry Count": "4983",
  "Total Entry Wins": "2633",
  "Total Flash Count": "9620",
  "Total Flash Successes": "5071",
  "Total Headshots %": "54465",
  "Total Kills with extended stats": "20307",
  "Total Matches": "1259",
  "Total Rounds with extended stats": "27723",
  "Total Sniper Kills": "3393",
  "Total Utility Count": "9178",
  "Total Utility Damage": "100925",
  "Total Utility Successes": "3477",
  "Utility Damage Success Rate": "11",
  "Utility Damage per Round": "3.64",
  "Utility Success Rate": "0.38",
  "Utility Usage per Round": "0.33",
  "Win Rate %": "49",
  Wins: "618",
};

const OPPONENT_A_LIFETIME: Lifetime = {
  ...MINA616_LIFETIME,
  "1v1 Win Rate": "0.38",
  "1v2 Win Rate": "0.3",
  ADR: "88",
  "Average Headshots %": "47",
  "Average K/D Ratio": "1.26",
  "Current Win Streak": "2",
  "Enemies Flashed per Round": "0.25",
  "Entry Rate": "0.21",
  "Entry Success Rate": "0.56",
  "Flash Success Rate": "0.5",
  "Longest Win Streak": "9",
  Matches: "988",
  "Recent Results": ["0", "1", "1", "0", "1"],
  "Total Headshots %": "47805",
  "Total Kills with extended stats": "10265",
  "Total Matches": "552",
  "Total Rounds with extended stats": "12102",
  "Utility Damage Success Rate": "14.97",
  "Utility Damage per Round": "3.65",
  "Win Rate %": "52",
  Wins: "514",
};

const OPPONENT_B_LIFETIME: Lifetime = {
  ...MINA616_LIFETIME,
  "1v1 Win Rate": "0.41",
  "1v2 Win Rate": "0.2",
  ADR: "84.5",
  "Average Headshots %": "45",
  "Average K/D Ratio": "1.19",
  "Current Win Streak": "1",
  "Enemies Flashed per Round": "0.31",
  "Entry Rate": "0.2",
  "Entry Success Rate": "0.51",
  "Flash Success Rate": "0.49",
  "Longest Win Streak": "6",
  Matches: "839",
  "Recent Results": ["1", "1", "0", "1", "0"],
  "Total Headshots %": "41165",
  "Total Kills with extended stats": "13622",
  "Total Matches": "799",
  "Total Rounds with extended stats": "17689",
  "Utility Damage Success Rate": "17.44",
  "Utility Damage per Round": "4.1",
  "Win Rate %": "51",
  Wins: "428",
};

const MAPS = [
  "Inferno",
  "Dust2",
  "Mirage",
  "Nuke",
  "Ancient",
  "Anubis",
  "Train",
] as const;

/** Small deterministic PRNG so regenerated fixtures are byte-identical. */
function rng(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

function round(value: number, digits = 2) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function segments(lifetime: Lifetime, seed: number) {
  const random = rng(seed);
  const totalMatches = Number(lifetime.Matches);
  const weights = MAPS.map(() => 0.5 + random());
  const weightSum = weights.reduce((sum, weight) => sum + weight, 0);
  let assigned = 0;

  return MAPS.map((map, index) => {
    const matches =
      index === MAPS.length - 1
        ? totalMatches - assigned
        : Math.round((weights[index] / weightSum) * totalMatches);
    assigned += matches;

    const rounds = matches * 22;
    const kd = round(Number(lifetime["Average K/D Ratio"]) * (0.9 + random() * 0.2));
    const kills = Math.round(rounds * 0.72);
    const deaths = Math.round(kills / kd);
    const winRate = Math.round(Number(lifetime["Win Rate %"]) + (random() - 0.5) * 12);

    return {
      type: "Map",
      mode: "5v5",
      label: map,
      img_small: "",
      img_regular: "",
      stats: {
        Matches: String(matches),
        Wins: String(Math.round((matches * winRate) / 100)),
        "Win Rate %": String(winRate),
        Rounds: String(rounds),
        Kills: String(kills),
        Deaths: String(deaths),
        "Average K/D Ratio": String(kd),
        ADR: String(round(Number(lifetime.ADR) * (0.92 + random() * 0.16))),
        "Average Headshots %": String(
          Math.round(Number(lifetime["Average Headshots %"]) + (random() - 0.5) * 6),
        ),
      },
    };
  });
}

type FixturePlayer = {
  dir: string;
  playerId: string;
  nickname: string;
  country: string;
  skillLevel: number;
  elo: number;
  lifetime: Lifetime;
  seed: number;
};

const PLAYERS: FixturePlayer[] = [
  {
    dir: "mina616",
    playerId: "dbe1f3ef-69d2-4c4c-a435-98f7220b1d28",
    nickname: "mina616",
    country: "ru",
    skillLevel: 7,
    elo: 1532,
    lifetime: MINA616_LIFETIME,
    seed: 616,
  },
  {
    dir: "opponent-a",
    playerId: "00000000-0000-4000-8000-00000000000a",
    nickname: "opponent-a",
    country: "de",
    skillLevel: 8,
    elo: 1784,
    lifetime: OPPONENT_A_LIFETIME,
    seed: 101,
  },
  {
    dir: "opponent-b",
    playerId: "00000000-0000-4000-8000-00000000000b",
    nickname: "opponent-b",
    country: "pl",
    skillLevel: 7,
    elo: 1611,
    lifetime: OPPONENT_B_LIFETIME,
    seed: 202,
  },
];

function playerJson(player: FixturePlayer) {
  return {
    player_id: player.playerId,
    nickname: player.nickname,
    avatar: "",
    country: player.country,
    cover_image: "",
    games: {
      cs2: {
        region: "EU",
        game_player_id: "",
        skill_level: player.skillLevel,
        faceit_elo: player.elo,
        game_player_name: player.nickname,
        skill_level_label: String(player.skillLevel),
        game_profile_id: "",
      },
    },
    faceit_url: `https://www.faceit.com/{lang}/players/${player.nickname}`,
    membership_type: "",
    memberships: ["free"],
    verified: false,
  };
}

function statsJson(player: FixturePlayer) {
  return {
    player_id: player.playerId,
    game_id: "cs2",
    lifetime: player.lifetime,
    segments: segments(player.lifetime, player.seed),
  };
}

async function writeJson(file: string, value: unknown) {
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

async function main() {
  for (const player of PLAYERS) {
    const dir = path.join(OUT_DIR, player.dir);
    await writeJson(path.join(dir, "player.json"), playerJson(player));
    await writeJson(path.join(dir, "stats.json"), statsJson(player));
  }

  console.log(`Fixtures written to ${path.relative(process.cwd(), OUT_DIR)}`);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
