# Security and operations

## Trust boundaries

- Publishable/anon Supabase keys are browser-safe identifiers; RLS is still mandatory.
- Secret/service-role keys bypass RLS and exist only in server modules and Vercel's encrypted environment.
- Authenticated user identity comes from `supabase.auth.getUser()`, never a body field.
- Cookie-authenticated mutations must have an allowed Origin. Bearer clients are treated separately.
- Zod rejects unknown or malformed input and request bodies over 32 KiB.
- Authoritative online moves are replayed in `chess.js`, version checked twice, clocked in Postgres, and committed through service-only functions.
- Database rate-limit buckets are shared across Vercel instances. The implementation fails open if the optional RPC/server key is unavailable, emits a structured warning, and should therefore be monitored.

Security headers are defined in `next.config.ts`: CSP, HSTS, frame denial, MIME sniffing denial, referrer policy, permissions policy, and opener policy. Re-test CSP whenever analytics, fonts, images, or another origin is added; do not loosen it globally to solve one integration.

## Administrator bootstrap and access

Roles live in `private.user_roles`. They are not Supabase `user_metadata`, profile fields, or client-editable app metadata. Bootstrap the first admin only after verifying a permanent user's UUID directly in `auth.users`, then insert the minimum role through the Supabase SQL editor with an operator-reviewed transaction. Never use an email copied from an untrusted request and never publish the UUID.

The `/admin` page currently requires authentication through `proxy.ts` but is a demo/read-only preview; it is not server-rendered role-gated. Real admin APIs independently check `private.user_roles`, which is the security boundary. Do not put sensitive data into the preview page until the page itself is role gated.

`GET/PATCH /api/admin/config` supports feature flags, matchmaking rules, house enable/list/pause/strength gates, maintenance mode, and announcements. Mutations are idempotent, rate-limited, and written to `private.audit_log`. The current UI does not call this API; use a reviewed operator client and retain request IDs until a live console exists.

## Moderation and social state

RLS controls report/message visibility, while protected sanctions support warning, chat mute, matchmaking ban, and account ban. Much of the moderator UI/workflow is not yet wired. Until it is, launch only with a documented manual response process, monitored contact address, evidence retention policy, and at least two trusted operators for high-risk action review.

House players cannot report users or accept friendships because they have no Auth user. Their messages must come only from the safe chess-specific set.

## Health, logs, and alerts

`GET /api/health` checks public/server configuration and a database query. It returns a request ID and coarse status, not secrets or detailed SQL errors. Do not use it as the sole monitor: also watch Vercel function errors/latency, Supabase database/Auth/Realtime/Storage usage, Resend delivery/bounce data, and provider status pages.

Server events are newline JSON on stdout/stderr with event, level, timestamp, and selected fields. Do not add access tokens, cookies, invite tokens, email addresses, FEN/PGN chat content, or full request bodies. Preserve `X-Request-Id` when correlating a user report.

The Hobby log window is short, so copy only necessary incident evidence to an access-controlled system. This repository has no external log drain.

## Cleanup and retention

`vercel.json` schedules `/api/cron/cleanup` daily at `03:17 UTC`. The route requires `Authorization: Bearer <CRON_SECRET>` and caps the RPC batch at 500. `/api/cleanup` is an admin-only, rate-limited manual trigger.

Current SQL cleanup expires/deletes bounded batches of idempotency records, old game mutation requests, stale matchmaking/invites/rate buckets, expired/read notifications, non-curated feed entries, game chat after 90 days, selected abandoned anonymous games, and audit records after 180 days. Every run is recorded. Review retention against legal/support needs before launch and never turn cleanup into an unbounded Vercel request.

Vercel Hobby cron runs at most daily and may execute anywhere in the scheduled hour. Instant rollback does not automatically roll back active cron configuration; inspect it after a rollback.

## Free-tier capacity and warnings

Limits change; these values were verified against vendor pages on 2026-07-21 and must be rechecked before launch.

Supabase Free currently documents 500 MiB database size (read-only risk above quota), 1 GiB file storage, 5 GiB uncached plus 5 GiB cached egress, 50,000 MAU, 200 peak Realtime connections, 2 million Realtime messages/month, one-day logs, no automatic backups, and project pausing after one week of inactivity. See [Supabase pricing](https://supabase.com/pricing), [database size](https://supabase.com/docs/guides/platform/database-size), and [Realtime usage](https://supabase.com/docs/guides/platform/manage-your-usage/realtime-messages).

Vercel Hobby currently documents 4 active CPU-hours, 360 GB-hours provisioned memory, 1,000,000 function invocations, 100 GB-hours function duration, 100 GB fast data transfer, one-hour runtime logs, and daily-only cron scheduling. See [Vercel Hobby](https://vercel.com/docs/plans/hobby) and [Vercel limits](https://vercel.com/docs/limits).

Operational implications:

- Store compact UCI/SAN moves and bounded PGN; do not persist full engine analysis by default.
- Local/AI calculation stays in the browser and inactive house profiles create no connections.
- One active game channel reloads compact durable state; avoid one channel per widget and unsubscribe promptly.
- Cap spectator/tournament/chat volumes before promotion; each change is billed per listening client.
- Keep avatars small and delete replaced objects.
- Watch database/index/WAL growth before 70%, not after read-only mode.
- Free projects have no automatic backup guarantee. Export before material schema/data changes.
- If a quota blocks a feature, show an operator-visible warning and disable that feature explicitly. Never silently drop moves, ratings, reports, or messages.

## Incident priorities

1. Protect integrity: pause affected feature/profile or enable maintenance policy through a trusted path.
2. Rotate exposed credentials at the issuing provider; update Vercel/Supabase and redeploy.
3. Preserve request IDs, audit rows, provider logs, and exact time range without collecting unrelated personal data.
4. Determine whether authoritative state changed; Realtime/UI anomalies alone are not database corruption.
5. Recover forward using [Recovery and rollback](recovery.md), notify affected users when appropriate, and record the postmortem/action items.
