# Launch checklist

Treat any unchecked **blocker** as a no-go. Record evidence/owner/date in the private release ticket; never paste secret values.

## Product and integrity

- [ ] **Blocker:** `npm run verify` passes on the release commit.
- [ ] **Blocker:** Local standard chess works without login and restores one saved game.
- [ ] **Blocker:** Vs AI and analysis load Stockfish in a worker and fall back legally when the worker is unavailable.
- [ ] **Blocker:** Online standard games validate identity, turn, legality, version, clock, and idempotency on the server.
- [ ] **Blocker:** Reconnect reloads durable state before enabling a move.
- [ ] **Blocker:** Rated human games update both sides atomically and only once.
- [ ] **Blocker:** Chess960 is hidden/rejected and described as unavailable until conformance is complete.
- [ ] **Blocker:** `rated_bots_enabled=false` for every pool and `allow_rated=false` for every house profile.
- [ ] House games are visibly labeled, filterable from humans, and use only safe chess messages.
- [ ] Curated/demo counts and records cannot be mistaken for live telemetry.
- [ ] Accepted takeback's pending-rewind limitation is either resolved or clearly disabled/explained.
- [ ] Tournament/social/training surfaces do not promise mutation flows that remain presentation/schema scaffolds.

## Supabase

- [ ] **Blocker:** Workspace is linked to `mbqplfqelnljrlvzkmxe`; no duplicate project exists.
- [ ] **Blocker:** Remote migration history matches reviewed repository migrations.
- [ ] **Blocker:** RLS is enabled and tested as anon, owner, unrelated user, and service role.
- [ ] **Blocker:** Browser roles cannot update authoritative state, ratings, roles, sanctions, or bot configuration.
- [ ] Anonymous, email/password, confirmation, recovery, and manual identity linking settings are verified.
- [ ] Site URL and exact redirect allowlist use the canonical domain; temporary previews are minimized.
- [ ] Realtime publication and RLS delivery tests pass; clients unsubscribe.
- [ ] Avatar bucket enforces UUID path, permanent account, MIME, and 2 MiB limit.
- [ ] Pre-launch encrypted logical export and isolated restore test exist.

## Google and email

- [ ] **Blocker:** Google project is `busted-minds-chess`; no duplicate project/client was created unnecessarily.
- [ ] Consent branding, audience/test status, support email, and authorized domain are correct.
- [ ] Scopes are exactly OpenID, email, and basic profile.
- [ ] JavaScript origins include localhost and `https://chess.bustedminds.us.kg`.
- [ ] Redirect URI is exactly `https://mbqplfqelnljrlvzkmxe.supabase.co/auth/v1/callback`.
- [ ] Guest -> Google and guest -> email upgrades preserve the Supabase user UUID.
- [ ] Existing Supabase custom SMTP through Resend is active; no direct app Resend key exists.
- [ ] SPF/DKIM (and chosen DMARC policy), sender identity, confirmation, and recovery delivery pass with controlled tests.
- [ ] Email quotas and bounce/suppression monitoring have an owner.

## Vercel, domain, and DNS

- [ ] **Blocker:** Existing-or-new project name is exactly `bustedminds-chess`, linked to the intended GitHub repository/production branch.
- [ ] **Blocker:** Required modern environment variables exist in correct targets; secret values were never printed/committed.
- [ ] Preview and production builds pass; `/api/health` is 200.
- [ ] `vercel domains inspect` supplied the exact CNAME target.
- [ ] Cloudflare contains one DNS-only, automatic-TTL `chess` CNAME with that exact target and no conflict.
- [ ] Vercel verifies the domain and provisions TLS.
- [ ] `NEXT_PUBLIC_APP_URL`, Supabase Site URL/redirects, Google origin, metadata, sitemap, and robots agree on `https://chess.bustedminds.us.kg`.
- [ ] Security headers and CSP pass on the canonical origin.

## Security and operations

- [ ] **Blocker:** Supabase secret/service-role credential is server-only and no privileged key appears in client bundles/logs.
- [ ] **Blocker:** Initial admin role is in `private.user_roles`; real admin APIs reject non-admins.
- [ ] Admin preview is not populated with sensitive data until page-level role gating exists.
- [ ] Rate-limit fail-open warnings, function errors, health, quota, Auth, Realtime, Storage, and Resend have monitoring owners.
- [ ] Manual moderation/report response procedure and escalation contacts exist.
- [ ] `CRON_SECRET` is configured; daily cleanup succeeds, records a bounded run, and manual admin fallback works.
- [ ] Retention windows (chat 90d, audit 180d, guest cleanup) are approved.
- [ ] Credential-rotation and rollback runbooks have been rehearsed.

## PWA, accessibility, and licensing

- [ ] Production HTTPS load registers the service worker; second-load offline Local/Vs AI shell works.
- [ ] Offline UI does not imply Auth/online saves are queued.
- [ ] Clearing/cache-updating behavior and one-game local storage limitation are documented.
- [ ] Keyboard/screen-reader announcement, contrast, reduced motion, color theme, mobile confirmation, and responsive board checks pass manually.
- [ ] Stockfish JS/WASM pair, GPLv3 copy, source attribution, and `THIRD_PARTY_NOTICES.md` ship together.
- [ ] Branding assets preserve aspect ratios and accessible alt text.

## Capacity and go-live

- [ ] Current Supabase/Vercel/Resend plan limits have been rechecked, not assumed from an old document.
- [ ] Database, Storage, egress, Realtime messages/connections, functions, logs, and email are below alert thresholds.
- [ ] Spectator/chat/tournament limits and house-game ratio have conservative launch settings.
- [ ] Generated Vercel URL remains available as a diagnostic path.
- [ ] Final smoke test covers login, guest upgrade, Local, AI, online human game, casual house game, invite, reconnect, rating, feedback, and logout.
- [ ] Release owner makes the go/no-go decision and records the known limitations.
