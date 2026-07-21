# House players and matchmaking

House players keep low-population queues useful without pretending to be human accounts. Product surfaces label them **House Player** or **Computer**. Public bios, country cues, and chess styles are fictional; they must never be used to imply a personal relationship.

## Data separation

House players are not rows in `auth.users` and have no email, OAuth identity, password, friend inbox, report action, or ordinary user session.

| Concern | Human | House player |
| --- | --- | --- |
| Identity | `auth.users` + `public.profiles` | `public.house_players` |
| Private policy | protected roles/sanctions | `private.house_player_configs` |
| Game seat | `participant_kind='user'`, `user_id` | `participant_kind='house'`, `house_player_id` |
| Move audit | `actor_user_id`; no engine metadata | `actor_house_player_id` plus engine profile/version/level/seed |
| Rating owner | `owner_kind='user'` | `owner_kind='house'` |
| Social behavior | may use wired social features | no Auth-backed friendship or personal messaging identity |

Database constraints enforce mutually exclusive owner/actor columns. Historical game, rating, feed, and tournament rows store snapshots so later profile edits do not rewrite history. Public and private bot data are intentionally separate: engine policy, deterministic seeds, availability, allowed surfaces, and pause state must not be exposed as writable browser data.

The TypeScript `src/lib/data/content.ts` profiles and sample leaderboard/feed items are curated presentation data. They are not proof of live database records or calibrated ratings. Keep identifiers and ratings synchronized deliberately when trusted seed data changes.

## Casual online move path

Current online fallback uses `bot_move_policy='browser_legal'` only for casual games:

1. Matchmaking selects an enabled/listed house player whose protected config allows matchmaking and is within the widening rating range.
2. The human participant requests a non-secret house-move context for the active house turn.
3. Stockfish runs in that participant's browser; the clock continues while it thinks.
4. The client submits the proposed legal move with the approved engine profile/version/level/seed.
5. The server verifies the participant, assigned house seat, turn, game version, engine attestation, and legality by replaying the authoritative move list.
6. The service RPC checks the protected config again, recalculates elapsed time, and records who computed the move.

This prevents illegal or cross-game moves but does not make client-side engine computation suitable for rated competition. A malicious participant could influence which legal move is submitted.

## Matchmaking fallback

`service_matchmake` first searches an exact variant/rated/clock/pool match between unblocked human tickets within the current rating window. If none exists, the ticket remains queued. On a later matchmaking request after the configured delay, it may choose a compatible house player when all of these are true:

- the request and ticket allow house players;
- pool fallback and casual bots are enabled;
- the profile is enabled/listed, allowed for matchmaking, and not paused;
- the profile is inside the growing rating range;
- rated eligibility gates pass (currently they must not be enabled; see below).

Schema defaults are an 8-second fallback delay, 150-point initial range, 20 points/second growth, 600-point maximum, and rated bots off. The launch seed specializes delay/range/growth/max by pool (bullet `6/125/25/500`, blitz `7/150/22/550`, rapid `8/175/18/650`, classical `10/200/15/750`) and keeps rated bots off everywhere. Treat those as starting values, not universal product promises. Operators can change policy through the role-verified admin configuration API, although the current admin UI is read-only preview.

The current matchmaking UI also offers a local Nova AI game if online matchmaking is unavailable or after a UI wait. That path is `ChessRoom mode="ai"`: it is not an online game, does not create a durable match, and cannot be rated. Sample pool counts shown in the UI are curated, not telemetry.

## Rated bots: explicit limitation

**Rated house-player games are not production-ready and must remain disabled.**

The database reserves `deterministic_server`, `rated_bots_enabled`, `allow_rated`, and dynamic bot-rating checks, but the repository has no trusted server-side engine runner for that policy. The browser context endpoint rejects rated games. Enabling the flags could create a game for which no valid bot move producer exists; it would not turn client Stockfish into a trusted rated engine.

Production enablement requires, at minimum:

- deterministic, reproducible move generation in a trusted execution boundary;
- hard execution/time limits compatible with Vercel;
- engine artifact/version pinning and a reproducibility suite;
- no client choice among legal bot moves;
- clock accounting during engine work;
- load/failure fallback that cannot alter competitive strength;
- empirical calibration per time control;
- abuse review, clear labeling, leaderboard policy, and rating-pool monitoring.

Until that exists: keep every `rated_bots_enabled` false and every house `allow_rated` false. Rated matchmaking should pair permanent human accounts only.

## Calibration procedure

Displayed/estimated Elo is a hypothesis, not a guarantee. Stockfish's `UCI_Elo` range and Skill Level are engine controls, not direct equivalence to the site's player pool. Device speed, WebAssembly support, move-time budget, opening book, personality noise, heuristic fallback, and time control all change playing strength.

Calibrate each `(engine version, profile, difficulty, time control, device class)` combination:

1. Pin the Stockfish files, engine version string, options, seed behavior, think-time range, and opening weights.
2. Run a large, color-balanced standard-chess test set against fixed reference opponents. Include openings and tactical/endgame suites; exclude Chess960.
3. Separate games where Stockfish ran from games that used heuristic fallback.
4. Measure score and confidence interval, illegal/timeout/crash rate, average think time, and performance under clock pressure.
5. Assign an estimated rating only after the interval is narrow enough for matchmaking; otherwise widen the UI label or mark it provisional.
6. Shadow-test in casual games and compare expected versus observed results by pool.
7. Recalibrate after any engine binary, difficulty mapping, think-time, mistake, opening, or fallback change.

Do not tune ratings from a handful of games or silently change a fixed-strength profile. Version every material calibration change.

## Safe content rules

House chat is limited to the protected chess-specific safe-message set such as “Good game,” “Well played,” and “Thanks for the game.” Do not generate free-form personal conversation. Exclude house profiles from human-only rankings and filters, expose a house/human field in archives, and report bot game volume separately from human liquidity.
