# Legal policy versioning

The authoritative legal-document registry is `src/lib/legal-document-manifest.ts`.
It assigns an identifier, version, publication date, effective date, SHA-256
document hash, and—when applicable—the audit record type to each policy.

## Before publishing a policy change

1. Update the approved source text in `docs/arcticirc/arcticirc-launch-policy-package.md`.
2. Increment only the corresponding constant in `src/lib/legal-policy-versions.ts`.
3. Set `ARCTICIRC_POLICY_PUBLICATION_DATE` to the approved ISO publication date
   for the release. The displayed effective date equals that approved date.
4. Run `npm run typecheck` and the legal-manifest tests. The manifest hashes the
   rendered source text, providing a reproducible reference without duplicating
   legal text in application code.

## Audit interpretation

`AccountDeletionRecord` entries created by this release use
`ACCOUNT_DELETION_POLICY_VERSION`, independently of chat acceptance. Existing
records retain their stored `launch-policy-v1` value; the manifest resolver
marks that value as a legacy deletion reference rather than rewriting historical
evidence to imply a policy it did not record.

OAuth-only deletion confirmation tokens are separately stored as SHA-256
digests, expire after 15 minutes, are bound to the account and its auth version,
and are consumed atomically with deletion. The email keeps its raw token in a
URL fragment only; the browser exchanges it through a same-origin POST for a
short-lived signed `HttpOnly`, `SameSite=Lax` handoff cookie scoped to the final
confirmation route. The raw token is never held by the confirmation page or
sent in the final deletion request. A user-row lock serializes new confirmation
requests, so a replacement invalidates the earlier token. Expired tokens are
included in the normal auth-token maintenance job.
