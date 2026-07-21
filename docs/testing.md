# Tests and CI

## Local gates

```powershell
npm ci
npm run verify
```

`verify` runs, in order:

1. ESLint with zero warnings
2. TypeScript without emit
3. Vitest unit tests
4. Next.js production build

Focused scripts are `npm run lint`, `npm run typecheck`, `npm test`, `npm run test:watch`, `npm run test:coverage`, and `npm run build`.

Current tests cover standard/FEN rules and replay, clocks, Elo helpers, openings, heuristic move selection, and server schema validation. They do not prove hosted RLS, transactional RPC behavior, OAuth/SMTP settings, Realtime delivery, Storage policy, Cloudflare DNS, or Vercel environment configuration.

## CI policy

No committed GitHub Actions workflow is currently present. Until one is added, Vercel's build is a deployment gate but is not a substitute for lint/test/typecheck. Configure the connected Git repository to require a CI job running `npm ci` and `npm run verify` before merge, and require the Vercel preview check. Use Node 20 or newer and never inject production server keys into forked/untrusted CI jobs.

For database changes, add a separate protected job or operator checklist that:

- detects edits to `supabase/migrations/**`;
- runs SQL lint/static review where available;
- applies migrations to an isolated disposable/staging project, not production;
- tests RLS as anon, owner, unrelated authenticated user, and service role;
- tests duplicate request IDs, stale versions, two concurrent moves, timeout, and once-only rating application;
- never runs `db reset --linked` on the existing project.

## Release smoke tests

- Fresh local production build loads with Supabase absent and keeps Local/Vs AI available.
- Email/password, Google, anonymous sign-in, guest upgrade, refresh, and signout work.
- Standard online create/join/move/reconnect/chat/resign/draw paths work on two separate accounts.
- An unrelated account cannot read a private game or mutate another user's data.
- A duplicate move returns the original/conflict behavior; a stale version is rejected.
- Casual house move metadata matches the assigned profile and illegal/stale submissions fail.
- Rated human game updates each rating once; rated bot matchmaking remains disabled.
- Chess960 create and matchmaking return the intentional unavailable error.
- Production PWA cache works only after a successful initial load; online actions fail clearly offline.
- `/api/health`, manual cleanup authorization, and daily cron behavior are observed without secret leakage.

Do not send bulk Auth email, create arbitrary cloud projects, or use production users/data for automated tests. There is no Playwright/visual test requirement in this project.
