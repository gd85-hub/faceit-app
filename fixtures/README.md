# FACEIT fixtures

Anonymized, deterministic FACEIT Data API v4 responses used by tests and the
offline scripts. Regenerate with:

```bash
npx tsx scripts/build-fixtures.ts
```

- `mina616` — real `player_id` (`dbe1f3ef-69d2-4c4c-a435-98f7220b1d28`) and the
  lifetime values FINDINGS.md recorded for it. Avatar, Steam and friends fields
  are removed; elo and skill level are placeholders.
- `opponent-a`, `opponent-b` — invented players. Their numbers are tuned so the
  comparison tests hit every verdict branch.

The shapes are synthetic: nothing here was fetched live while building the set.
Do not add raw dumps of other people's accounts here — `api-samples/` (ignored
by git) is the place for local raw dumps.
