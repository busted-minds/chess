# Architecture

## Runtime shape

Busted Minds Chess has no permanently running application server, Redis instance, or bot fleet.

```text
Browser
  ├─ Local / Vs AI / analysis
  │    ├─ chess.js rules
  │    ├─ Stockfish Web Worker
  │    └─ localStorage + service-worker cache
  └─ Online
       ├─ Supabase Auth cookies
       ├─ Next.js Route Handlers on Vercel
       │    ├─ Zod input validation and same-origin checks
       │    ├─ chess.js authoritative replay
       │    └─ server-only Supabase secret client
       └─ Supabase
            ├─ Postgres durable state and transactional RPCs
            ├─ RLS-filtered reads
            ├─ Realtime invalidation/presence
            └─ avatar Storage
```

### Browser-only paths

`ChessRoom` powers Local, Vs AI, and analysis. It uses the same rules adapter for legal moves and terminal-state detection. Stockfish is loaded only when an AI or analysis search needs it. When Stockfish cannot load or times out, `heuristic-ai.ts` selects a deterministic legal move using captures, checks, promotion, development, king safety, positional proxies, personality weights, and controlled mistakes.

Local mode stores one compact move list and clock pair under `bm-chess-local-v1`. Preferences are stored under `bm-chess-preferences-v1`. Vs AI and analysis do not write to Supabase and are not automatically restored after refresh.

### Online mutation boundary

The online path intentionally does not trust state calculated in React:

1. A Route Handler authenticates the Supabase user and rejects an untrusted cookie-authenticated origin.
2. Zod validates the body and a database-backed bucket rate-limits the operation.
3. The server loads the game, participants, and durable move list using the server-only credential.
4. It checks player identity, status, turn, and expected `version`.
5. `chess.js` replays the durable moves and validates the submitted move.
6. A service-role-only Postgres RPC locks the game, recalculates elapsed clock time from `turn_started_at`, checks the version again, and atomically writes the move and resulting game state.
7. If the game ends rated, the same transaction applies `elo-v1` at most once and records before/after/change rows.
8. Realtime notifies subscribed clients; each client reloads the durable snapshot.

The clock is rendered locally every 100 ms, but Postgres is updated only on a move or terminal action. A refresh or reconnect reloads `serverTime`, stored clocks, `turn_started_at`, and the latest version before another move is accepted.

### Idempotency and concurrency

Important mutations require UUID request keys. Global operations use `private.idempotency_keys`; game mutations use `(game_id, request_id)` in `private.game_mutation_requests`. Reusing a key with different input is rejected. Games use optimistic locking through an integer `version`, plus a row lock inside the RPC. A stale client receives a conflict and must reload.

### Identity classes

- **Anonymous Auth users** have real Supabase user IDs and `profiles.account_kind = 'guest'`. They can use allowed casual online features and later upgrade in place.
- **Permanent users** have `account_kind = 'permanent'` and may use rated, persistent, and social functionality as it is wired.
- **House players** are not Auth users. Their public profile and private engine configuration live in separate tables and participant rows use a mutually exclusive house-player foreign key.
- **Moderators/admins/support** are grants in `private.user_roles`, not editable user metadata.

## Data domains

The migrations group data into identity/platform controls, authoritative games/ratings, social/competition/training, RLS, trusted game RPCs, operations RPCs, and Realtime/Storage. Public tables are broadly read-only to clients under RLS; authoritative writes are intentionally absent from client grants. The `private` schema is not exposed to `anon` or `authenticated`.

See `docs/database.md` for the table-level reference when available and [Supabase setup](supabase.md) for operational details.

## Feature boundaries

Schema presence does not mean a user workflow is complete. Current product pages for leaderboards, watch, clubs, community, puzzles, and portions of tournaments use curated launch data. This keeps low-population screens intentional while the mutation/services layer is expanded, but operators must not interpret the displayed sample counts, games, or ratings as telemetry.

The admin screen explicitly runs in safe preview mode. The role-checked `/api/admin/config` endpoint is real; its UI controls are not connected.

## Chess960 constraint

`CHESS960_CONFORMANCE_COMPLETE` is `false`. Although database enums reserve `chess960`, the rules adapter and online create/matchmaking routes reject it. Supporting the variant requires a conformance-tested adapter for starting positions, X-FEN/Shredder-FEN semantics, rook-origin castling rights, SAN/PGN replay, imported positions, clocks, and fixtures across browser and server. Do not expose it with only a feature flag.

## PWA and offline boundary

The service worker registers only in production. It pre-caches the main shell, Local, Vs AI, the offline page, branding assets, and Stockfish JS/WASM. Navigation is network-first with a cached-page/offline fallback; static Next.js, brand, and engine assets are cache-first after first use.

Offline readiness therefore requires one successful HTTPS production load and completed service-worker installation. Online games, Auth, cloud saves, and Realtime never work offline. There is no background mutation queue. Clearing site data removes preferences and the saved local game.

## Stockfish licensing

The included Stockfish 18 Lite worker is GPLv3 software. The binary assets and full license are under `public/stockfish/`, and attribution is recorded in `THIRD_PARTY_NOTICES.md`. If the engine binaries are modified or redistributed separately, preserve the license and satisfy GPLv3 corresponding-source obligations. Application dependencies retain their respective licenses; this note is operational guidance, not legal advice.
