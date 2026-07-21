# Busted Minds Chess

Busted Minds Chess is a Next.js 16 chess platform built around three deliberately different play paths:

- **Local** — same-device hotseat chess with no account or network dependency after the production shell has been cached.
- **Vs AI** — Stockfish 18 Lite in a browser Web Worker, with a deterministic heuristic fallback.
- **Online** — authenticated, server-validated games backed by Supabase Postgres and Realtime, including private invites and low-population house-player matchmaking.

The application uses Vercel for the web application and request handlers, and the existing Supabase project **Busted Minds Chess** (`mbqplfqelnljrlvzkmxe`) for Postgres, Auth, Realtime, and Storage. Google OAuth must reuse the existing Google Cloud project **Busted Minds Chess** (`busted-minds-chess`). Resend is configured as Supabase Auth's SMTP provider; the web application does not send through Resend directly.

## Current implementation status

This repository is a production-minded beta, not a claim that every visible product surface is fully operational.

| Area | Current status |
| --- | --- |
| Standard chess and FEN positions | Implemented with `chess.js`; legal moves, promotion, castling, en passant, terminal positions, and replay validation are covered by unit tests. |
| Local hotseat | Implemented in the browser. One local game is restored from `localStorage`; no Supabase write occurs. |
| Vs AI and analysis | Implemented in the browser with lazily loaded Stockfish, MultiPV analysis, hints, and a heuristic fallback. AI games are not automatically persisted. |
| Auth | Google OAuth, email/password, reset, anonymous sign-in, and guest-to-permanent upgrade flows are wired to Supabase Auth. Hosted Auth settings still require operator configuration. |
| Online standard games | Route handlers authenticate players, replay and validate moves, use version checks and idempotency keys, calculate clocks on the server, and commit through service-only RPCs. Realtime is an invalidation signal; Postgres remains authoritative. |
| Casual house-player games | Database architecture and online move validation are implemented. Browser-computed house moves are legal-move checked and recorded with engine metadata. The UI also offers a clearly labeled local AI fallback when online services are unavailable. |
| Ratings | Separate bullet, blitz, rapid, and classical records plus atomic `elo-v1` updates exist in SQL. Only completed rated games are eligible and application is once-only. |
| Private games, chat, offers | APIs/schema exist for hashed invite tokens, joining, game chat, resign/draw/takeback/abort actions. An accepted takeback currently awaits an authoritative rewind and returns HTTP 202. |
| Tournaments | Schema and tournament creation are implemented. Automatic pairing, round progression, standings mutation, and full event operations are not yet wired end to end. |
| Social, learning, progression | Broad RLS-protected schema and polished product pages exist; many pages currently use curated launch/demo content and do not yet expose complete mutation workflows. |
| Admin | Role-verified configuration and cleanup APIs exist. `/admin` is intentionally a read-only preview UI with demo records; it is not a live operations console. |
| Chess960 | **Unavailable.** The schema reserves the variant, but application APIs reject it because Chess960 castling/FEN/replay conformance is not complete. |
| Rated house players | **Unavailable for production.** Database guardrails reserve a deterministic-server policy, but no trusted server engine runner is implemented. Defaults disable rated bots and browser-computed bot moves are casual-only. |

Do not enable Chess960 or rated house games by changing a database flag alone. See [House players and matchmaking](docs/house-players.md).

## Quick start

Requirements: Node.js 20.9 or newer and npm. Docker is not required when developing against the existing hosted Supabase project.

```powershell
npm ci
Copy-Item .env.example .env.local
# Fill .env.local without committing or printing its secret values.
npm run dev
```

Open `http://localhost:3000`. Local and Vs AI can render without Supabase credentials; online features require the environment described in [Local development](docs/local-development.md).

Before handing off a change:

```powershell
npm run verify
```

`verify` runs lint, TypeScript, unit tests, and a production build.

## Documentation

- [Architecture and capability boundaries](docs/architecture.md)
- [Local development and environment variables](docs/local-development.md)
- [Supabase setup, migrations, RLS, Realtime, and Storage](docs/supabase.md)
- [Google OAuth and guest identity linking](docs/google-oauth.md)
- [House players, bot calibration, and matchmaking fallback](docs/house-players.md)
- [Vercel deployment, custom domain, and Cloudflare DNS](docs/deployment.md)
- [Security, administration, operations, and free-tier limits](docs/security-operations.md)
- [Tests and CI](docs/testing.md)
- [Recovery and rollback](docs/recovery.md)
- [Launch checklist](docs/launch-checklist.md)
- [Database reference](docs/database.md), when present
- [Third-party notices](THIRD_PARTY_NOTICES.md)

## Repository map

```text
src/app/                 App Router pages, Auth callbacks, and trusted HTTP routes
src/components/chess/    Local/AI board, online room, invites, and matchmaking UI
src/lib/chess/           Rules, clocks, ratings, openings, and heuristic AI
src/lib/engine/          Browser Stockfish worker client
src/lib/server/          Authentication, validation, rate limits, and service RPC facade
src/lib/supabase/        Browser, request-scoped server, and server-only admin clients
supabase/migrations/     Versioned schema, RLS, trusted RPCs, Realtime, and Storage
public/stockfish/        Stockfish worker assets and GPLv3 license
public/sw.js             Production service worker and offline shell cache
```

## Security baseline

The browser may read only data allowed by RLS. It cannot directly write authoritative game state, ratings, roles, bot configuration, or moderation state. Trusted mutations run through same-origin, cookie-authenticated Route Handlers, Zod validation, database-backed rate limiting, and service-role-only SQL functions. Never expose `SUPABASE_SECRET_KEY` or `SUPABASE_SERVICE_ROLE_KEY` to the browser.

Report a suspected credential leak by rotating the affected credential first, then follow [Recovery and rollback](docs/recovery.md).
