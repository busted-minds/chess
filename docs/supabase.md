# Supabase setup

Use the existing project only:

- Name: **Busted Minds Chess**
- Reference: `mbqplfqelnljrlvzkmxe`
- URL: `https://mbqplfqelnljrlvzkmxe.supabase.co`

Do not create a replacement project and do not use `supabase db reset --linked` against it.

## Hosted configuration versus repository configuration

`supabase/config.toml` configures an optional local Supabase stack. It does **not** automatically change hosted Auth provider, URL, SMTP, or manual-linking settings. SQL migrations configure the hosted database only when pushed. Treat these as two separate operator tasks.

## Safe migration procedure

1. Confirm the active Supabase account and project in the dashboard.
2. Link and compare local/remote history.
3. Take a pre-change logical export when the data matters; keep it encrypted and outside the repository.
4. Review every pending migration. These files contain security-definer functions and grants, so do not approve by filename alone.
5. Dry-run, then push once.
6. Verify RLS, service function grants, Realtime publication membership, Storage policy, and `/api/health`.

The hosted database password is separate from the Supabase account login. Keep
`SUPABASE_DB_PASSWORD` only in the ignored local `.env` (or your secret manager),
never in Vercel or Git. The CLI reads this variable without printing it.

```powershell
supabase link --project-ref mbqplfqelnljrlvzkmxe
supabase migration list --linked
supabase db push --linked --dry-run
# After explicit review:
supabase db push --linked
supabase migration list --linked
```

Do not use `--include-all` to bypass an unexplained history mismatch. Do not mark a migration repaired until the remote schema has been inspected. Prefer a new forward migration over editing an already-applied file.

## Migration inventory

| Migration | Responsibility |
| --- | --- |
| `20260721000100_identity_and_platform.sql` | Profiles/preferences, separate house-player identity/config, protected roles/sanctions/audit/rate limits/idempotency, feature flags, announcements, matchmaking policy, Auth-profile synchronization. |
| `20260721000200_games_and_ratings.sql` | Authoritative games, participants, compact moves, offers/chat/invites, matchmaking tickets, separate user/house ratings, rating events, seasons. |
| `20260721000300_social_competition_training.sql` | Friends/blocks/messages/clubs/feed, archive collections, moderation/feedback, tournaments/events, puzzles/openings/lessons/studies/analysis/progression, operations tables. |
| `20260721000400_rls_and_permissions.sql` | Visibility helpers, explicit grants, and restrictive RLS policies for every exposed table. |
| `20260721000500_game_service_rpcs.sql` | Service-only game create/join/move/actions and atomic rating application. |
| `20260721000600_service_operations.sql` | House-move context, matchmaking, chat/feedback, shared rate limiting, draw claims, admin configuration, and bounded cleanup. |
| `20260721000700_realtime_storage_and_health.sql` | Realtime publication membership, the avatar bucket/policies, and health metadata. |

`supabase/seed.sql` is present and uses stable IDs plus conflict guards. It creates no Auth users or email identities. It supplies eight house profiles/configs and pool ratings, conservative matchmaking policy, feature flags (Chess960 and rated house players disabled), a launch season/events/tournaments, curated feed items, openings, puzzles, lessons, achievements, and missions.

Seed data is not applied by a normal push unless explicitly included. For this existing project, first inspect for ID/slug collisions and preserve any operator-owned rows. Then, only when launch content is approved:

```powershell
supabase db push --linked --include-seed --dry-run
# After reviewing both pending migrations and the complete seed:
supabase db push --linked --include-seed
```

Seed house players only through trusted SQL/admin operations; never create them through public Auth signup. Re-running the seed generally preserves existing rows because it uses `ON CONFLICT ... DO NOTHING`; that also means editing a seed value does not update an already seeded production row. Ship intentional production changes in a reviewed forward migration or admin operation.

## RLS and privilege model

- RLS is enabled on all exposed public tables and on protected private tables.
- `anon` and `authenticated` receive public-schema reads, then policies restrict each row.
- Clients receive only selected update columns for their own profile/preferences.
- There are no general client grants for games, clocks, ratings, results, roles, bans, achievements, tournament results, or bot configuration.
- The `private` schema is revoked from browser roles.
- `service_*` mutation functions revoke execution from `public`, `anon`, and `authenticated` and grant only `service_role`.
- Route Handlers still authenticate the user before calling a service function; possession of the server key is never treated as the end user's identity.

After each migration, inspect grants and test as anon, authenticated owner, unrelated authenticated user, and service role. A successful service-role query is not an RLS test because that role bypasses RLS.

## Hosted Auth settings

In Supabase Dashboard > Authentication:

- Enable email/password signup and email confirmation.
- Enable anonymous sign-ins.
- Enable manual identity linking; it is required by the guest `linkIdentity({ provider: 'google' })` flow.
- Set the Site URL to `https://chess.bustedminds.us.kg` after the domain is live.
- Allow exactly:
  - `http://localhost:3000/auth/callback`
  - `http://127.0.0.1:3000/auth/callback` if that origin is used
  - `https://chess.bustedminds.us.kg/auth/callback`
  - explicitly trusted preview callback URLs only when preview OAuth testing is required
- Configure Google under Auth Providers as described in [Google OAuth](google-oauth.md).
- Preserve the existing custom SMTP integration described below.

Avoid an unrestricted production wildcard in the redirect allowlist. The callback route also normalizes `next` to a local path, but the provider allowlist remains the first redirect boundary.

## Resend through Supabase SMTP

The integration already exists. Verify it; do not create a second Resend project or add a direct mail SDK.

1. In Supabase Auth SMTP settings, verify custom SMTP is enabled, sender identity is correct, and credentials are present without revealing them.
2. In Resend, verify the sending domain remains `verified` and its SPF/DKIM records are healthy; use DMARC as appropriate.
3. Confirm Auth templates point to the application callback/confirmation routes and use the canonical HTTPS origin.
4. Send at most one confirmation and one recovery message to a controlled test account, then inspect Supabase Auth and Resend delivery logs.
5. Never create house players with email addresses; house players are database identities and must not generate Auth mail.

The web app does not require `RESEND_API_KEY`. As of 2026-07-21, Resend's Free transactional tier documents 3,000 messages/month and 100/day; verify the [current Resend pricing](https://resend.com/pricing) before launch. Repeated signup/recovery tests can consume this quota and damage sender reputation.

## Realtime

The migration adds games, moves, offers, game chat, matchmaking, challenges, tournament records/messages, direct messages, and notifications to `supabase_realtime` when the publication exists. RLS still controls Postgres Changes delivery.

The online room uses one channel for relevant game changes and Presence, then reloads durable state. Broadcast/Presence is transient and never authoritative. Clients must unsubscribe on unmount. Avoid adding high-volume tables or sending complete PGNs in Broadcast payloads.

Verify publication membership in Dashboard > Database > Publications or with `pg_publication_tables`. Test that an unrelated user receives neither the row nor its change event.

## Storage

Migration 007 creates a public `avatars` bucket with a 2 MiB object limit and PNG, JPEG, WebP, and GIF MIME allowlist. Reads are public. Upload/update/delete requires a permanent authenticated user, and the first path segment must be that user's UUID:

```text
avatars/<auth-user-uuid>/<generated-file-name>.webp
```

Generate filenames rather than accepting arbitrary paths, validate content in addition to client-reported MIME, and do not put private documents in this public bucket. The local global Storage limit in `config.toml` is 5 MiB; the bucket's stricter hosted 2 MiB limit wins.

## Post-apply checks

- `/api/health` returns 200 with no secret details.
- A new anonymous Auth user gets exactly one profile and preference row.
- Upgrading that user changes `account_kind` without changing the UUID.
- Browser roles cannot update a game's FEN, clocks, result, ratings, roles, or house configuration.
- An owner can use a valid avatar path; another user cannot overwrite it.
- A game channel reconnect reloads the current version before allowing a move.
- Cleanup is bounded and recorded in `private.cleanup_runs`.
