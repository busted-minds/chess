# Google OAuth

Reuse the existing Google Cloud project:

- Project name: **Busted Minds Chess**
- Project ID: `busted-minds-chess`

Do not create another Google Cloud project. Reuse an existing Busted Minds Chess Web OAuth client where possible; preserve unrelated existing origins and redirect URIs.

## Verify the operator context

```powershell
gcloud auth list
gcloud config get-value project
gcloud config set project busted-minds-chess
gcloud config get-value project
```

The `set` command changes only the local CLI context. OAuth consent/client settings are most safely reviewed in Google Auth Platform in the browser.

## Consent screen

Configure the existing project's branding/consent screen with the Busted Minds Chess name, a monitored support email, approved homepage/privacy/terms URLs, and verified authorized domain. Choose the audience appropriate to the intended users. If the app remains in Testing, add only controlled test users; public users cannot sign in until the consent configuration permits them.

Request only `openid`, `email`, and `profile`. The application explicitly asks for `openid email profile` and does not use Google Drive, Calendar, Gmail, or offline Google access.

## Web client values

Authorized JavaScript origins contain origins only—no path or trailing slash:

```text
http://localhost:3000
https://chess.bustedminds.us.kg
```

Add an explicit trusted Vercel preview origin only when testing OAuth on that preview. Do not add a broad third-party origin.

The hosted authorized redirect URI is Supabase's provider callback, not the Next.js callback:

```text
https://mbqplfqelnljrlvzkmxe.supabase.co/auth/v1/callback
```

For an optional local Supabase stack, the separate local redirect is:

```text
http://127.0.0.1:54321/auth/v1/callback
```

The application callback, `https://chess.bustedminds.us.kg/auth/callback`, belongs in Supabase's redirect allowlist. Flow order is Google -> Supabase `/auth/v1/callback` -> application `/auth/callback` -> server-side PKCE code exchange.

## Configure Supabase

In the existing Supabase project, open Authentication > Providers > Google:

1. Enable Google.
2. Enter the existing Web client's ID and secret. Never put the secret in a `NEXT_PUBLIC_` variable or repository file.
3. Confirm Supabase displays the exact hosted callback URI shown above.
4. Enable manual identity linking in Auth settings.
5. Save and test from localhost before production.

For optional local Supabase, `config.toml` reads `SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID` and `SUPABASE_AUTH_EXTERNAL_GOOGLE_SECRET` from the CLI process environment. Those are local provider settings, not Vercel variables.

## Guest upgrade and linking

An online guest is already a Supabase anonymous Auth user with a stable UUID. On "Link Google," the client calls `linkIdentity`, not a separate sign-in, so the existing profile and games remain attached to that UUID. Email/password upgrade similarly uses `updateUser` on the guest session.

Manual linking is security-sensitive and remains marked beta by Supabase. Before launch, test:

- anonymous guest -> new Google identity preserves the user UUID;
- anonymous guest -> email/password confirmation preserves the UUID;
- an already-linked Google identity cannot be stolen or merged into a different guest;
- duplicate/verified email behavior is understood;
- cancellation or callback failure leaves the guest session usable;
- unlinking the final sign-in identity is not exposed without a recovery path.

Do not manipulate `auth.users` to merge accounts manually. If a collision occurs, stop and resolve it through a reviewed support procedure with an audit record.

## Verification

- Test login and logout in a fresh browser profile.
- Confirm the consent screen lists only basic identity scopes.
- Confirm `/auth/callback` exchanges the code and rejects unsafe `next` paths.
- Refresh a protected page to verify session-cookie rotation through `proxy.ts`.
- Test password recovery separately from OAuth.
- Remove temporary test origins/users after launch.

Reference: [Supabase Google login guide](https://supabase.com/docs/guides/auth/social-login/auth-google) and [Supabase identity linking](https://supabase.com/docs/guides/auth/auth-identity-linking).
