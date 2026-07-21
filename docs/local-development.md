# Local development

## Prerequisites

- Node.js `>=20.9.0`
- npm (the lockfile is authoritative)
- Supabase CLI for linking, migration inspection, or optional local services
- Vercel and Google Cloud CLIs only for deployment/operator work

The normal development path uses the existing hosted Supabase project and does not require Docker. `supabase start` is optional and requires a container runtime; it is not part of the application architecture.

## Install and run

```powershell
npm ci
Copy-Item .env.example .env.local
npm run dev
```

Do not copy values into issue comments, command arguments, logs, or committed files. `.env.local`, `.env`, `.vercel/`, Supabase temporary state, and common credential files are ignored.

Local and Vs AI work without Supabase configuration. `/api/health` returns 503 until both public and server Supabase credentials are available.

## Environment variables

| Variable | Scope | Required | Purpose |
| --- | --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Browser + server | Online features | `https://mbqplfqelnljrlvzkmxe.supabase.co` for the existing hosted project. |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Browser + server | Preferred | Current browser-safe Supabase publishable key. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Browser + server | Legacy fallback | Legacy anon JWT, used only when the preferred variable is **unset**. |
| `SUPABASE_SECRET_KEY` | Server only | Preferred for trusted mutations | Current Supabase secret key. Never prefix it with `NEXT_PUBLIC_`. |
| `SUPABASE_SERVICE_ROLE_KEY` | Server only | Legacy fallback | Legacy service-role JWT, used only when the preferred variable is **unset**. |
| `NEXT_PUBLIC_APP_URL` | Browser + server | Yes | Canonical origin: `http://localhost:3000` locally and `https://chess.bustedminds.us.kg` in production. Used by metadata and the origin allowlist. |
| `CRON_SECRET` | Server only | Scheduled cleanup | Strong random value expected in the cleanup route's Bearer authorization. |
| `CLOUDFLARE_ID` | Operator workstation | DNS work only | Cloudflare account identifier used to discover the `bustedminds.us.kg` zone. The web app does not read it. |
| `CLOUDFLARE_API_TOKEN` | Operator workstation | DNS work only | Narrow Cloudflare Zone/DNS token. Do not upload it to Vercel unless deployment automation later requires it. |
| `CLOUDFLARE_TOKEN` | Operator workstation | Legacy alias | Reserved legacy local name; the current application runtime does not read it. |

The configuration uses nullish fallback semantics. If using a legacy key, remove the preferred variable entirely; an explicitly defined but empty preferred variable prevents the legacy value from being selected. Prefer the modern pair and define only one public key and one server key.

Google OAuth client secrets and Resend SMTP credentials are not application environment variables. They belong in Supabase's provider/SMTP configuration. `RESEND_API_KEY` is intentionally unnecessary.

For an optional local Supabase Auth stack, `supabase/config.toml` references these process variables:

- `SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID`
- `SUPABASE_AUTH_EXTERNAL_GOOGLE_SECRET`

Set them only in the local CLI process environment. Do not add them to a committed file. The local provider callback is `http://127.0.0.1:54321/auth/v1/callback`.

## Link to the existing project

Do not create another Supabase project.

```powershell
supabase link --project-ref mbqplfqelnljrlvzkmxe
supabase migration list --linked
supabase db push --linked --dry-run
```

Only run the non-dry push after reviewing the remote migration history and the SQL diff. See [Supabase setup](supabase.md).

## Useful scripts

```powershell
npm run lint
npm run typecheck
npm test
npm run test:coverage
npm run build
npm run verify
```

No Playwright or visual-browser suite is required. Database migrations and cloud-provider settings need separate staging/operator validation because unit tests do not exercise the hosted services.
