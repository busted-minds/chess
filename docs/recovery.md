# Recovery and rollback

## Principles

- Stop new damage before repairing old data.
- Vercel code rollback and Postgres data/schema recovery are separate operations.
- Applied database migrations are forward-only in production. Do not edit history or run a linked reset to simulate a rollback.
- Realtime is not the source of truth. Reload Postgres before diagnosing corruption.
- Preserve request IDs and audit evidence, but never copy secrets into the incident record.

## Before a risky release

1. Run `npm run verify` and migration dry-run.
2. Capture current production deployment ID, environment-variable names, Supabase migration history, Auth URL/provider settings, Vercel domain output, and Cloudflare record ID/target (not tokens).
3. Export schemas and necessary data to an encrypted location outside the repository:

```powershell
supabase db dump --linked --file <secure-path>\schema.sql
supabase db dump --linked --data-only --use-copy --file <secure-path>\data.sql
```

Review whether Auth/Storage require separate export. Supabase Free does not currently include automatic backups; a logical dump is essential before material changes. Test restore procedures in an isolated project.

## Application rollback

Use Vercel's deployment history/Instant Rollback or promote the last known-good immutable deployment. Confirm environment variables and custom-domain alias still point where expected. Vercel cron configuration may remain from the newer deployment after Instant Rollback, so inspect/disable or redeploy the intended `vercel.json` explicitly.

If the bad release introduced a migration, rolling back only the frontend may be unsafe. Choose a compatible app deployment or apply a forward compatibility migration first.

## Database recovery

For a bad additive migration:

1. Enable maintenance/disable the affected feature through a trusted operator path.
2. Determine whether only schema, only data, or both changed.
3. Write a new timestamped forward migration that restores compatibility without discarding unknown production data.
4. Dry-run, peer review, export affected tables, and apply.
5. Validate grants/RLS and application behavior before reopening.

Never casually drop columns/tables, truncate game/rating/audit data, or use `supabase migration repair` to hide a schema mismatch. A history repair is metadata-only and requires proof that remote SQL exactly matches the claimed version.

For accidental data mutation, restore into an isolated environment first, identify exact rows/time bounds, and perform a targeted audited correction. Recompute ratings only through a reviewed once-only correction procedure; do not directly overwrite totals without corresponding history.

## Credential compromise

- Supabase publishable/anon key: normally public, but still investigate abuse and rotate if policy requires.
- Supabase secret/service-role key: rotate immediately, update all Vercel targets, redeploy, revoke the old key, and review privileged database/API activity.
- Google OAuth secret: rotate in the existing client, update Supabase Provider settings, and test login. Do not create a duplicate client as a shortcut.
- Resend SMTP credential: rotate in Resend and Supabase SMTP, verify sender/domain, inspect unexpected sends/suppressions.
- Cloudflare token: revoke/rotate, inspect DNS audit history, restore the exact verified Vercel CNAME, and keep the new token narrowly scoped.
- `CRON_SECRET`: rotate in Vercel and redeploy; verify the scheduled route rejects the old value.

Invalidate sessions when the incident scope warrants it. Communicate expected sign-in interruption and avoid disclosing internal security details that create further risk.

## DNS/domain recovery

If the custom domain fails, do not delete the Vercel project or Supabase project. Keep the generated `vercel.app` deployment available for diagnostics. Compare:

- `vercel domains inspect chess.bustedminds.us.kg` exact target;
- Cloudflare active zone and single DNS-only `chess` CNAME;
- absence of conflicting A/AAAA/CNAME records;
- Vercel domain verification/TLS state;
- Supabase Site URL/redirect allowlist and Google origin.

Restore the previous Cloudflare record by record ID if the new value was wrong. DNS rollback does not roll back Auth configuration; align both.

## Engine/PWA recovery

If a Stockfish binary is broken, restore the last known-good JS/WASM pair and matching attribution/version together, bump the service-worker `CACHE_VERSION`, and redeploy. Otherwise existing clients may keep a mismatched cached pair. The heuristic fallback is a degraded casual path, not permission to keep rated bot games running.

For a bad service worker, ship a new cache version and conservative fetch handler. Test update/unregister in a controlled browser. Do not delete user local storage during routine cache cleanup; it contains the saved Local game/preferences.

## Return-to-service checks

- Health is 200 and migration history matches reviewed files.
- A real server-validated move, reconnect, and duplicate/stale rejection pass.
- Ratings and clocks show no double application or drift.
- Auth callbacks and email recovery use the canonical domain.
- Realtime and PWA clients converge after refresh/update.
- Cleanup/cron is correctly authenticated and bounded.
- Incident actions, data corrections, and credential rotations are recorded with owner and timestamp.
