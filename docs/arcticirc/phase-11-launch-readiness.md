# ArcticIRC Phase 11 launch readiness

This is an internal implementation and operator record, not a public policy
page. It records what has been implemented locally and what must be verified
in the authorized production change window. It does not authorize a migration,
service start, reverse-proxy change, or deployment.

## Implemented in the reviewed source tree

- The owner-approved source package is retained at
  `docs/arcticirc/arcticirc-launch-policy-package.md`.
- The Terms, Privacy, Cookie, Security, Community Guidelines, and Retention
  pages derive their wording from that approved package. The legal hub, footer
  links, sitemap, and prior Community Guidelines URL include the new pages.
- ArcticIRC is still disabled by default. Its external-network flags remain
  false in `.env.example`; no code path in this work starts an external IRC
  connection.
- ArcticIRC activation is blocked until a signed-in, verified-email user has a
  current versioned policy record. The activation form requires an 18+ attestation,
  Terms agreement, Privacy acknowledgment, and Community Guidelines agreement.
  The record stores the account ID, policy version, and timestamps, and stores
  no date of birth.
- Guest transcript access remains blocked by authenticated, eligible-user API
  checks and the gateway token check. `/irc/` is disallowed in `robots.txt` and
  all IRC routes emit noindex metadata.
- Optional Google Analytics is not rendered until the browser has stored an
  affirmative consent choice. Necessary-only is equally available, consent
  expires after 180 days, revocation disables subsequent GA calls, and the GA
  bootstrap disables Google Signals and ad-personalization signals. The code
  does not set a GA user ID or send chat, report, handle, credential, or raw
  subscription data in its defined events.
- Personalized chat discovery now has an explicit per-profile switch. When it
  is off, the chat directory does not fetch or rank from feed subscriptions.
- The chat retention worker has bounded, idempotent batches for 90-day native
  messages, 24-hour deleted messages, 365-day ordinary closed reports,
  730-day serious closed reports, 730-day chat audit records, and 730-day
  minimal deletion-completion records. It also removes left-room membership
  metadata after 30 days unless an active moderation case needs it. Active
  scoped legal holds exclude chat messages, reports, and audit records from
  deletion and have a review date.
- The general worker removes durable security-event records in bounded batches
  after 90 days. The normal release still requires verified infrastructure log
  retention; this database maintenance does not claim to retain container or
  proxy logs by itself.
- New report evidence is written to a separate one-to-one `ChatReportEvidence`
  record and is not returned by ordinary user-facing APIs or copied into the
  report-created audit record. It is visible only to authenticated admins on
  the restricted moderation page, where reports can be dismissed or actioned
  with the required retention class. Its bounded snapshot deliberately excludes
  the reported message body.
- Administrators have a same-origin, authenticated legal-hold page and API for
  creating a hold, reviewing it for a new period of at most 90 days, and
  releasing it. The audit record identifies the held record and review date
  without copying the legal-hold reason into the audit log.
- Account deletion requires an authenticated, same-origin request, an explicit
  `DELETE` confirmation, and current-password reauthentication. It removes the
  account immediately from primary systems, relies on existing foreign-key behavior to remove account
  records and sever native-message authorship, and retains only a one-way
  deletion-completion reference for the configured period. Existing room
  rendering labels severed native message authorship as `Deleted user`.
- Account settings include a self-service deletion control that requires the
  exact typed confirmation `DELETE` and the current local password. Accounts
  that only use Google sign-in use the existing support-email deletion path
  until a provider-specific reauthentication flow is implemented.
- The Windows off-host backup synchronization script now defaults to 30 days,
  matching the existing server-side backup script default.

## Required before any policy publication or ArcticIRC enablement

The source change alone cannot complete these items. The following Analytics
baseline was verified against the selected live property on July 14, 2026:

- event-data retention is 14 months;
- Google Signals is off;
- granular location and device collection is off;
- ads personalization is disallowed in every available region; and
- user-provided data collection is off.

The application config also sets `allow_google_signals` and
`allow_ad_personalization_signals` to `false`, and does not configure
`user_id` transmission. Vendor data-sharing controls still require a separate
in-account review before any public claim that unnecessary sharing is disabled.

The remaining items must not be represented as complete on a public policy
page until checked against the actual deployment.

1. Set `ARCTICIRC_POLICY_PUBLICATION_DATE` to the real publication date only
   when publication is authorized. It is intentionally blank in `.env.example`.
2. Apply the ordered Prisma migrations through the existing reviewed migration
   process. Do not run `prisma migrate deploy` directly from this work item.
3. Confirm the production deployment's actual cookie and browser-storage
   inventory, including Auth.js cookie names, persistence durations, Cloudflare
   or Turnstile tokens, reverse-proxy cookies, and the two application keys:
   `arcticrss.analytics-consent.v1` and `arctic-rss:irc:hide-arctic-bot`.
   Do not publish an inventory table until this inspection is complete.
4. Configure and verify VPS/reverse-proxy/application log rotation at 30 days,
   security-event retention at 90 days, and the actual backup rotation at no
   more than 30 days. Verify a restore reruns the retention worker before the
   restored system serves chat traffic.
5. Verify the backup job, off-host sync configuration, and existing backup
   directories. The changed script default does not retroactively remove older
   backups or alter any private production configuration.
6. Assign the authorized decision-maker process for using the operator legal
   hold UI and API. The application enforces scoped, 90-day review dates, but
   no production hold is created by this work.
7. Exercise the account-deletion route in a non-production restored-data test,
   including failed and successful local-password reauthentication, session
   invalidation, existing gateway connection behavior, report evidence,
   authorship display, and retention-job rerun. Google-only deletion requests
   must follow the monitored support-email process until provider-specific
   reauthentication is implemented.
8. Do not enable any external IRC flag until a real approved network connector
   implements the required first-connection network notice and is separately
   operator-approved. The current external transport is not launched here.

## Explicitly not performed

- No migration was applied.
- No database records, rooms, beta grants, legal holds, or deletion requests
  were created.
- No Docker service was started or rebuilt against the VPS.
- No reverse-proxy, tunnel, DNS, Cloudflare, analytics-property, or production
  configuration was changed.
- No external IRC connection was attempted.
- No policy page was deployed or publicly published.
