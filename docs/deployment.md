# Vercel deployment and custom domain

Target state:

- Vercel project: `bustedminds-chess`
- Canonical URL: `https://chess.bustedminds.us.kg`
- DNS provider: Cloudflare for `bustedminds.us.kg`
- Vercel region: `hnd1` from `vercel.json`
- Cleanup cron: daily at `03:17 UTC`

Do not put secrets in command arguments, captured transcripts, or documentation.

## 1. Quality and account preflight

```powershell
npm ci
npm run verify
vercel whoami
vercel project inspect bustedminds-chess
```

If inspection succeeds, reuse that project. Only if it returns not found:

```powershell
vercel project add bustedminds-chess
```

Link the workspace; `.vercel/` is local state and must remain uncommitted:

```powershell
vercel link --yes --project bustedminds-chess
vercel project inspect bustedminds-chess
```

Connect the intended GitHub repository under Vercel Project > Settings > Git. Verify it is the correct owner/repository and production branch before enabling automatic deployments. Vercel Hobby cannot connect organization-owned repositories in every account configuration; check current plan limits rather than moving the repository casually.

## 2. Environment variables

Add values interactively so the CLI does not print or preserve them in shell history:

```powershell
vercel env add NEXT_PUBLIC_SUPABASE_URL production,preview,development
vercel env add NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY production,preview,development
vercel env add SUPABASE_SECRET_KEY production,preview,development
vercel env add NEXT_PUBLIC_APP_URL production
vercel env add CRON_SECRET production
vercel env list
```

Use the modern key names. Define legacy `NEXT_PUBLIC_SUPABASE_ANON_KEY` or `SUPABASE_SERVICE_ROLE_KEY` only if the project has not issued modern keys, and leave the preferred names unset in that case.

Production `NEXT_PUBLIC_APP_URL` is `https://chess.bustedminds.us.kg`. For preview, either set the canonical production URL (metadata remains canonical) and do not test OAuth there, or use a controlled stable preview domain and add that exact callback to Supabase/Google. Never add Cloudflare credentials, Google OAuth secret, or Resend key to Vercel: the running application does not need them.

## 3. Preview and first production deploy

```powershell
vercel deploy
vercel deploy --prod
```

Record the generated deployment URL without treating it as the final canonical URL. Verify `/`, `/play/local`, `/play/ai`, `/auth`, `/api/health`, security headers, and the Stockfish worker. A 503 from health means environment variables or migrations are incomplete and blocks domain cutover.

## 4. Add and inspect the domain

```powershell
vercel domains add chess.bustedminds.us.kg bustedminds-chess
vercel domains inspect chess.bustedminds.us.kg
```

Copy the **exact CNAME target returned by `inspect`**. Do not assume a generic Vercel target; project/domain-specific targets can differ.

## 5. Upsert Cloudflare DNS

Use the existing local `CLOUDFLARE_ID` and `CLOUDFLARE_API_TOKEN`. The token should have only Zone Read and DNS Edit for the relevant account/zone.

1. Call Cloudflare `GET /client/v4/zones?name=bustedminds.us.kg&account.id=<CLOUDFLARE_ID>` and require exactly one matching active zone.
2. Query `GET /client/v4/zones/<zone-id>/dns_records?type=CNAME&name=chess.bustedminds.us.kg`.
3. If no record exists, `POST` it. If exactly one exists, `PATCH` that record. Stop on multiple records or a conflicting A/AAAA record; do not delete automatically.
4. Payload:

```json
{
  "type": "CNAME",
  "name": "chess",
  "content": "<exact target from vercel domains inspect>",
  "ttl": 1,
  "proxied": false
}
```

`ttl: 1` means automatic. Keep the record DNS-only during verification and TLS provisioning. Never log the Authorization header or paste API responses containing account metadata into public channels.

Cloudflare is authoritative, so `vercel dns add` is not the correct operation. Re-run:

```powershell
vercel domains inspect chess.bustedminds.us.kg
```

Wait for verification and Vercel-managed TLS, then test `https://chess.bustedminds.us.kg`. Do not remove the generated Vercel URL.

## 6. Canonical URL and Auth cutover

After HTTPS works:

1. Ensure Vercel production `NEXT_PUBLIC_APP_URL=https://chess.bustedminds.us.kg` and redeploy if it changed.
2. In Supabase Auth, set Site URL to the canonical origin and add the exact production `/auth/callback` redirect.
3. In the existing Google Web OAuth client, add the production origin and keep the Supabase hosted callback URI.
4. Confirm Resend-backed Auth templates use the canonical origin.
5. Deploy production once more if any build-time public variable changed.

## 7. Verification

- `vercel domains inspect` reports valid configuration.
- Certificate and browser security checks pass.
- `/api/health` is 200 and contains no credentials.
- Google login returns to the canonical domain.
- Email confirmation/recovery returns to the canonical domain.
- A production local/AI load installs the service worker; a second visit works offline for cached paths.
- A casual online standard game can reconnect and reject a stale/duplicate move.
- Scheduled cleanup authenticates with `CRON_SECRET`; manual admin cleanup remains available.

Current references: [Vercel custom domains](https://vercel.com/docs/domains/set-up-custom-domain) and [Vercel cron management](https://vercel.com/docs/cron-jobs/manage-cron-jobs).
