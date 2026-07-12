# FACEIT Data API Findings

Sources used:

- `api-samples/minaa_/search.json`, `api-samples/minaa_/player.json`, `api-samples/minaa_/stats.json`
- `api-samples/I-Perfect-I/search.json`, `api-samples/I-Perfect-I/player.json`, `api-samples/I-Perfect-I/stats.json`
- `api-samples/Eyes_team/search.json`, `api-samples/Eyes_team/player.json`, `api-samples/Eyes_team/stats.json`
- `api-samples/zzz_does_not_exist_9182/search-error.json`

## CS2 Game ID

`cs2` worked for all three real players. Each saved `stats.json` has top-level `"game_id": "cs2"`:

- `api-samples/minaa_/stats.json`
- `api-samples/I-Perfect-I/stats.json`
- `api-samples/Eyes_team/stats.json`

The `csgo` fallback was not used for these samples.

## Stats Field Paths

Top-level paths from `api-samples/minaa_/stats.json`:

- `player_id` — string — `"dbe1f3ef-69d2-4c4c-a435-98f7220b1d28"`
- `game_id` — string — `"cs2"`
- `lifetime` — object — 41 keys
- `segments` — array — 10 items in `minaa_`

Lifetime paths. Examples below are from `api-samples/minaa_/stats.json`:

- `lifetime["1v1 Win Rate"]` — string — `"0.36"`
- `lifetime["1v2 Win Rate"]` — string — `"0.22"`
- `lifetime["ADR"]` — string — `"81.03"`
- `lifetime["Average Headshots %"]` — string — `"43"`
- `lifetime["Average K/D Ratio"]` — string — `"1.13"`
- `lifetime["Current Win Streak"]` — string — `"0"`
- `lifetime["Enemies Flashed per Round"]` — string — `"0.27"`
- `lifetime["Entry Rate"]` — string — `"0.18"`
- `lifetime["Entry Success Rate"]` — string — `"0.53"`
- `lifetime["Flash Success Rate"]` — string — `"0.53"`
- `lifetime["Flashes per Round"]` — string — `"0.35"`
- `lifetime["K/D Ratio"]` — string — `"1423.58"`
- `lifetime["Longest Win Streak"]` — string — `"7"`
- `lifetime["Matches"]` — string — `"1259"`
- `lifetime["Recent Results"]` — array — `["1", "0", "1", "0", "0"]`
- `lifetime["Sniper Kill Rate"]` — string — `"0.12"`
- `lifetime["Sniper Kill Rate per Round"]` — string — `"0.17"`
- `lifetime["Total 1v1 Count"]` — string — `"1064"`
- `lifetime["Total 1v1 Wins"]` — string — `"384"`
- `lifetime["Total 1v2 Count"]` — string — `"1221"`
- `lifetime["Total 1v2 Wins"]` — string — `"268"`
- `lifetime["Total Damage"]` — string — `"2246331"`
- `lifetime["Total Enemies Flashed"]` — string — `"7615"`
- `lifetime["Total Entry Count"]` — string — `"4983"`
- `lifetime["Total Entry Wins"]` — string — `"2633"`
- `lifetime["Total Flash Count"]` — string — `"9620"`
- `lifetime["Total Flash Successes"]` — string — `"5071"`
- `lifetime["Total Headshots %"]` — string — `"54465"`
- `lifetime["Total Kills with extended stats"]` — string — `"20307"`
- `lifetime["Total Matches"]` — string — `"1259"`
- `lifetime["Total Rounds with extended stats"]` — string — `"27723"`
- `lifetime["Total Sniper Kills"]` — string — `"3393"`
- `lifetime["Total Utility Count"]` — string — `"9178"`
- `lifetime["Total Utility Damage"]` — string — `"100925"`
- `lifetime["Total Utility Successes"]` — string — `"3477"`
- `lifetime["Utility Damage Success Rate"]` — string — `"11"`
- `lifetime["Utility Damage per Round"]` — string — `"3.64"`
- `lifetime["Utility Success Rate"]` — string — `"0.38"`
- `lifetime["Utility Usage per Round"]` — string — `"0.33"`
- `lifetime["Win Rate %"]` — string — `"49"`
- `lifetime["Wins"]` — string — `"618"`

Segment metadata paths. Examples below are from the first segment in `api-samples/minaa_/stats.json`:

- `segments[].img_regular` — string — `"https://distribution.faceit-cdn.net/images/d71cae42-b38c-470d-a548-0c59d6c71fbe.jpeg"`
- `segments[].img_small` — string — `"https://assets.faceit-cdn.net/third_party/games/ce652bd4-0abb-4c90-9936-1133965ca38b/assets/votables/a2cb95be-1a3f-49f3-a5fa-a02503d02086_1695819214782.jpeg"`
- `segments[].label` — string — `"Inferno"`
- `segments[].mode` — string — `"5v5"`
- `segments[].stats` — object — 57 keys
- `segments[].type` — string — `"Map"`

Segment stats paths. Examples below are from the first segment in `api-samples/minaa_/stats.json`:

- `segments[].stats["1v1 Win Rate"]` — string — `"0.38"`
- `segments[].stats["1v2 Win Rate"]` — string — `"0.19"`
- `segments[].stats["ADR"]` — string — `"78.99"`
- `segments[].stats["Assists"]` — string — `"325"`
- `segments[].stats["Average Assists"]` — string — `"5.08"`
- `segments[].stats["Average Deaths"]` — string — `"15.8"`
- `segments[].stats["Average Headshots %"]` — string — `"46"`
- `segments[].stats["Average K/D Ratio"]` — string — `"1.02"`
- `segments[].stats["Average K/R Ratio"]` — string — `"0.69"`
- `segments[].stats["Average Kills"]` — string — `"15.42"`
- `segments[].stats["Average MVPs"]` — string — `"1.8"`
- `segments[].stats["Average Penta Kills"]` — string — `"0.03"`
- `segments[].stats["Average Quadro Kills"]` — string — `"0.19"`
- `segments[].stats["Average Triple Kills"]` — string — `"0.8"`
- `segments[].stats["Deaths"]` — string — `"1011"`
- `segments[].stats["Enemies Flashed per Round"]` — string — `"0.16"`
- `segments[].stats["Entry Rate"]` — string — `"0.19"`
- `segments[].stats["Entry Success Rate"]` — string — `"0.5"`
- `segments[].stats["Flash Success Rate"]` — string — `"0.46"`
- `segments[].stats["Flashes per Round"]` — string — `"0.24"`
- `segments[].stats["Headshots"]` — string — `"453"`
- `segments[].stats["Headshots per Match"]` — string — `"7.08"`
- `segments[].stats["K/D Ratio"]` — string — `"65.23"`
- `segments[].stats["K/R Ratio"]` — string — `"44.17"`
- `segments[].stats["Kills"]` — string — `"987"`
- `segments[].stats["MVPs"]` — string — `"115"`
- `segments[].stats["Matches"]` — string — `"64"`
- `segments[].stats["Penta Kills"]` — string — `"2"`
- `segments[].stats["Quadro Kills"]` — string — `"12"`
- `segments[].stats["Rounds"]` — string — `"1428"`
- `segments[].stats["Sniper Kill Rate"]` — string — `"0.1"`
- `segments[].stats["Sniper Kill Rate per Round"]` — string — `"0.15"`
- `segments[].stats["Total 1v1 Count"]` — string — `"42"`
- `segments[].stats["Total 1v1 Wins"]` — string — `"16"`
- `segments[].stats["Total 1v2 Count"]` — string — `"58"`
- `segments[].stats["Total 1v2 Wins"]` — string — `"11"`
- `segments[].stats["Total Damage"]` — string — `"112800"`
- `segments[].stats["Total Enemies Flashed"]` — string — `"229"`
- `segments[].stats["Total Entry Count"]` — string — `"270"`
- `segments[].stats["Total Entry Wins"]` — string — `"135"`
- `segments[].stats["Total Flash Count"]` — string — `"342"`
- `segments[].stats["Total Flash Successes"]` — string — `"158"`
- `segments[].stats["Total Headshots %"]` — string — `"2919"`
- `segments[].stats["Total Kills with extended stats"]` — string — `"987"`
- `segments[].stats["Total Matches"]` — string — `"64"`
- `segments[].stats["Total Rounds with extended stats"]` — string — `"1428"`
- `segments[].stats["Total Sniper Kills"]` — string — `"144"`
- `segments[].stats["Total Utility Count"]` — string — `"698"`
- `segments[].stats["Total Utility Damage"]` — string — `"10320"`
- `segments[].stats["Total Utility Successes"]` — string — `"354"`
- `segments[].stats["Triple Kills"]` — string — `"51"`
- `segments[].stats["Utility Damage Success Rate"]` — string — `"14.79"`
- `segments[].stats["Utility Damage per Round"]` — string — `"7.23"`
- `segments[].stats["Utility Success Rate"]` — string — `"0.51"`
- `segments[].stats["Utility Usage per Round"]` — string — `"0.49"`
- `segments[].stats["Win Rate %"]` — string — `"42"`
- `segments[].stats["Wins"]` — string — `"27"`

## String Values That Are Numeric In Meaning

In `api-samples/minaa_/stats.json`, all `lifetime[...]` fields listed above are JSON strings with numeric meaning except `lifetime["Recent Results"]`, which is an array of numeric strings. The same lifetime key set is present in `api-samples/I-Perfect-I/stats.json` and `api-samples/Eyes_team/stats.json`.

In segments, all `segments[].stats[...]` fields listed above are JSON strings with numeric meaning. Segment metadata fields `label`, `img_small`, `img_regular`, `type`, and `mode` are non-numeric strings.

Percentage/rate formats observed:

- Whole-percent strings: `lifetime["Win Rate %"]` is `"49"`, `lifetime["Average Headshots %"]` is `"43"`, and `segments[].stats["Win Rate %"]` is `"42"` in `api-samples/minaa_/stats.json`.
- Decimal rate strings: `lifetime["Flash Success Rate"]` is `"0.53"`, `lifetime["Entry Success Rate"]` is `"0.53"`, `lifetime["Utility Success Rate"]` is `"0.38"`, `lifetime["1v1 Win Rate"]` is `"0.36"`, and `lifetime["1v2 Win Rate"]` is `"0.22"` in `api-samples/minaa_/stats.json`.
- Mixed-looking success-rate strings: `lifetime["Utility Damage Success Rate"]` is `"11"` in `api-samples/minaa_/stats.json`, `"14.97"` in `api-samples/I-Perfect-I/stats.json`, and `"17.44"` in `api-samples/Eyes_team/stats.json`.
- `Total Headshots %` is also a string, but values look total-like rather than percent-like: `"54465"` in `api-samples/minaa_/stats.json`, `"47805"` in `api-samples/I-Perfect-I/stats.json`, and `"41165"` in `api-samples/Eyes_team/stats.json`.

## Fields Missing For At Least One Player

No lifetime fields are missing among the three real players. The lifetime key set has 41 keys in each of:

- `api-samples/minaa_/stats.json`
- `api-samples/I-Perfect-I/stats.json`
- `api-samples/Eyes_team/stats.json`

## Segment Statistics

Yes, segment statistics are present in `segments`, and segments are map-like objects with this structure:

- `label` — map or mode label, for example `"Inferno"`
- `img_small` — image URL
- `img_regular` — image URL
- `stats` — object with 57 string-valued stat fields
- `type` — `"Map"` in these samples
- `mode` — mode string, for example `"5v5"`, `"1v1"`, or `"Wingman"`

Segment counts:

- `api-samples/minaa_/stats.json`: 10 segments
- `api-samples/I-Perfect-I/stats.json`: 13 segments
- `api-samples/Eyes_team/stats.json`: 12 segments

Segment labels and modes:

- `minaa_`: Inferno 5v5, Train 5v5, Dust2 5v5, Nuke 5v5, Iris 5v5, Overpass 5v5, Anubis 5v5, Mirage 5v5, Ancient 5v5, Cache 5v5.
- `I-Perfect-I`: Inferno 5v5, Vertigo 5v5, Nuke 5v5, Overpass 5v5, Train 5v5, Cache 5v5, Mirage 5v5, Anubis 5v5, Dust2 5v5, Ancient 5v5, 1v1 Aim Map 1v1, Overpass Wingman, Nuke Wingman.
- `Eyes_team`: Vertigo 5v5, Overpass 5v5, Inferno 5v5, Anubis 5v5, Train 5v5, Cache 5v5, Nuke 5v5, Mirage 5v5, Ancient 5v5, Dust2 5v5, Iris 5v5, 1v1 Aim Map 1v1.

## Nonexistent Nickname Error Format

For `zzz_does_not_exist_9182`, the FACEIT search request did not return an error object. It returned HTTP `200` with an empty result set. The exact body saved in `api-samples/zzz_does_not_exist_9182/search-error.json` is:

```json
{
  "items": [],
  "start": 0,
  "end": 20
}
```

## Open Questions

- Nonexistent player search returns HTTP `200` and an empty `items` array, not a 404-style error body.
- `Matches` and `Total Matches` can differ: in `api-samples/I-Perfect-I/stats.json`, `Matches` is `"988"` while `Total Matches` is `"552"`; in `api-samples/Eyes_team/stats.json`, `Matches` is `"839"` while `Total Matches` is `"799"`.
- `K/D Ratio` at lifetime level looks like an accumulated or differently derived value (`"1423.58"` for `minaa_`), while `Average K/D Ratio` is the intuitive ratio-like value (`"1.13"` for `minaa_`).
- `Total Headshots %` contains large string values such as `"54465"`, so the field name suggests percent but the value does not look like a direct percent.
- `segments` is not limited to ordinary 5v5 maps in these samples; it can include `1v1 Aim Map` and `Wingman` map segments.

## Segment Aggregate Validation

Calculated by `scripts/validate-segments.ts` from the three real `api-samples/<nick>/stats.json` files.

- `minaa_`: sum of `segments[].stats["Matches"]` for `mode === "5v5" && type === "Map"` is `1259`; `lifetime["Matches"]` is `"1259"`; difference is `0.00%`.
- `I-Perfect-I`: sum of `segments[].stats["Matches"]` for `mode === "5v5" && type === "Map"` is `586`; `lifetime["Matches"]` is `"988"`; difference is `40.69%`.
- `Eyes_team`: sum of `segments[].stats["Matches"]` for `mode === "5v5" && type === "Map"` is `815`; `lifetime["Matches"]` is `"839"`; difference is `2.86%`.

Validation failed because `I-Perfect-I` differs by more than `10%`. Derived metrics from 5v5 segments are not included in `metricDefinitions`; only lifetime metrics from section 3a are included.

## Lifetime K/R Check

Calculated by `scripts/check-kr.ts` from the three real `api-samples/<nick>/stats.json` files:

- `api-samples/minaa_/stats.json`: kills `20307`, rounds `27723`, K/R `0.732`, `lifetime["Average K/D Ratio"]` `"1.13"`.
- `api-samples/I-Perfect-I/stats.json`: kills `10265`, rounds `12102`, K/R `0.848`, `lifetime["Average K/D Ratio"]` `"1.26"`.
- `api-samples/Eyes_team/stats.json`: kills `13622`, rounds `17689`, K/R `0.770`, `lifetime["Average K/D Ratio"]` `"1.19"`.
