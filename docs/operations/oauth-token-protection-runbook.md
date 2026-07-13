# OAuth account data protection

Arctic RSS uses Google OAuth only to verify a person at sign-in. It does not
call Google APIs on a user's behalf, request offline access, or need a Google
access token after the sign-in flow completes.

The `Account` table therefore stores only the permanent identity link needed
to recognize a returning user: provider, provider account ID, account type,
and user ID. The application adapter writes only those fields, and migration
`20260713240000_minimize_oauth_account_storage` removes the historical OAuth
credential columns and their contents.

## Deployment checks

1. Complete the normal verified production backup before applying the
   migration.
2. Apply the committed migration before recreating the web service.
3. Verify migration status, web and worker health, and public health.
4. Sign in with an existing Google-linked account. Its provider and provider
   account ID are unchanged, so no relink is required.
5. Sign in with a new Google account in a controlled test session. Confirm the
   new account can return to the app after sign-out and sign-in.
6. Query only counts, never token values, to confirm that the `Account` table
   has no OAuth credential columns after the migration.

## Backups and future integrations

Backups created before this migration can contain the removed values. Treat
them as sensitive, keep their existing encrypted off-host handling and VPS
permissions, and allow them to expire under the configured retention policy.
Do not copy their contents into task logs or restore an old backup to
production without applying the committed migrations afterward.

If Arctic RSS later needs to call a provider API on a user's behalf, do not
reintroduce plaintext token columns. First design a separate, versioned
AEAD-encrypted credential store with a key outside the database, an explicit
key identifier on each encrypted record, rotation and revocation procedures,
and tests proving that plaintext credentials never reach logs, sessions, or
client components.
