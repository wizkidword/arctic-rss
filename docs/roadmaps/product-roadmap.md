# Arctic RSS product roadmap

**Purpose:** preserve the agreed optional product direction after the
production-remediation work. This is a decision aid and resumption guide, not
a commitment to build every item or a schedule.

**Last reviewed:** 2026-07-13

## Current baseline

The initial production-remediation work is complete: security, reliability,
database controls, performance, operational backups and alerts, supply-chain
checks, feedback search, narrower cache invalidation, and OAuth-token
minimization are in place.

The next product initiative should be selected deliberately and delivered as a
small vertical slice. Do not begin several roadmap items at once.

## Recommended sequence

| Order | Initiative | Why it belongs here | Status |
| --- | --- | --- | --- |
| 1 | Search and saved searches | Makes an existing reader useful again as subscriptions grow. | Not started |
| 2 | Reader automation | Builds on saved-search/query semantics to reduce routine triage. | Not started |
| 3 | Story comparison | Helps readers understand coverage across sources instead of only consuming a chronological feed. | Not started |
| 4 | Better briefings | Improves the value of the existing AI and digest foundations. | Not started |
| 5 | Podcast transcripts | Extends the podcast experience from playback to research and recall. | Not started |
| 6 | Capture tools | Gives users a low-friction way to bring outside reading into Arctic RSS. | Not started |
| 7 | Shared workspaces | Adds collaboration only after individual-reader workflows are strong. | Not started |
| 8 | API and webhooks | Exposes stable, proven concepts to other tools after their data model settles. | Not started |
| 9 | Privacy and source health | Makes collection, retention, and feed reliability more visible and controllable. | Not started |
| 10 | Offline/PWA support | Adds device resilience once the core interactions and cache policy are stable. | Not started |

This is the suggested order, not a rigid dependency chain. A clear user need
can justify moving an item forward, but the thin first release below should
remain the starting point.

## Initiative cards

### 1. Search and saved searches

**User outcome:** find a past article or a live topic quickly, then return to
the same focused view later.

**Thin first release:**

- Search a signed-in user's readable articles by title, source, author, and
  text excerpt.
- Filter by read/starred state, feed, folder, and date range.
- Save a named search and reopen it from the reader navigation.
- Keep results scoped to the current user and paginate them.

**Design decisions to make first:** PostgreSQL full-text search versus a
dedicated search service; how long article text is retained; and whether saved
searches are a full filter language or a constrained form builder.

**Done when:** a user can save a query, new matching articles appear in it, and
the results remain private, fast, and share no raw cross-user data.

### 2. Reader automation and rules

**User outcome:** routine reading decisions happen consistently without manual
sorting every new article.

**Thin first release:**

- Allow a rule based on feeds/folders and simple include or exclude terms.
- Perform one action: apply a label/collection, star an item, or mark it read.
- Show a per-rule run history with the affected item count.
- Provide a dry-run preview before enabling a rule.

**Dependencies:** stable saved-search/filter semantics and the existing worker
queue. Rules must be idempotent and must not silently delete articles.

**Done when:** a user can preview, enable, pause, and audit a rule without
affecting another user's reader state.

### 3. Story comparison

**User outcome:** see how several sources cover the same event or topic.

**Thin first release:**

- Group articles by canonical URL and strongly matching titles published within
  a bounded time window.
- Show a comparison view with source, publication time, headline, excerpt,
  and original link.
- Let a user open the group from an article; do not try to auto-cluster the
  entire historical archive initially.

**Dependencies:** careful canonical-URL normalization, explainable grouping,
and a way to correct or dismiss false matches.

**Done when:** groups are understandable, reversible, and do not hide the
original article ordering or source attribution.

### 4. Better briefings and digests

**User outcome:** get a useful briefing from chosen sources and topics without
losing the ability to inspect the underlying articles.

**Thin first release:**

- Let a user create a briefing from selected feeds, folders, or a saved search.
- Produce linked sections such as must-read, skim-later, and differing views.
- Include source links and article counts beside every generated claim.
- Respect existing plan limits, quotas, and AI failure handling.

**Dependencies:** the current AI usage ledger, digest worker path, and clear
cost/retention rules. Start with on-demand generation before adding new email
cadences.

**Done when:** a user can understand why each article is in a briefing and can
return to the original source with one click.

### 5. Podcast transcripts

**User outcome:** search, skim, and quote a podcast episode rather than only
listen linearly.

**Thin first release:**

- Attach a transcript supplied directly by a podcast feed or publisher.
- Display it beside an episode with time-linked segments when timestamps exist.
- Make transcript text searchable within that episode.
- Clearly label publisher-supplied versus generated transcripts.

**Dependencies:** content rights policy, storage limits, language detection,
and a deliberate transcription-provider/cost decision before generating any
audio transcript.

**Done when:** publisher-provided transcript support works end to end without
downloading or transcribing arbitrary audio by default.

### 6. Capture and read-later tools

**User outcome:** save a useful page from outside the reader and return to it
inside Arctic RSS.

**Thin first release:**

- Provide a bookmarklet or browser extension action that saves a URL.
- Fetch metadata and a clean excerpt through the existing URL-safety controls.
- Place captured items in a private inbox with archive/delete controls.
- Keep the original URL visible and never bypass publisher access controls.

**Dependencies:** URL-fetch security, a small capture-item data model, and
clear retention/deletion behavior.

**Done when:** capture is private, resilient to duplicate submissions, and
does not make Arctic RSS a general-purpose scraping service.

### 7. Shared workspaces

**User outcome:** a small group can share selected sources and reading context
without exposing personal subscriptions by default.

**Thin first release:**

- Create an owner-managed workspace.
- Invite members and assign owner/member roles.
- Share workspace feeds and one shared collection or briefing view.
- Preserve personal reader state separately from workspace state.

**Dependencies:** explicit authorization boundaries, invitations, audit events,
and a workspace-aware data model. Avoid broad real-time collaboration in the
first release.

**Done when:** membership changes take effect immediately, private feeds stay
private, and every shared resource has a clear owner.

### 8. API and webhooks

**User outcome:** connect Arctic RSS to trusted personal workflows and tools.

**Thin first release:**

- Read-only API for a user's feeds, unread items, and saved searches.
- Personal API tokens with clear names, scoped permissions, revocation, and
  last-used metadata.
- One webhook event: new article matching a saved search.
- Signed webhook deliveries, retries, and a delivery log with no secrets.

**Dependencies:** stable search and reader resource models, rate limits,
auditing, and token lifecycle controls. Do not expose admin data or provider
credentials.

**Done when:** a user can revoke a token or webhook immediately and inspect
what was delivered without seeing secrets.

### 9. Privacy controls and source health

**User outcome:** understand what Arctic RSS keeps, which sources are healthy,
and how to control personal data.

**Thin first release:**

- Per-feed health: last successful fetch, recent error category, freshness, and
  pause/retry controls.
- A data page explaining article, reader-state, and account-data retention.
- Self-service export and account-deletion request flow improvements.
- Source-level controls for images, JavaScript-free reader rendering, and
  retention where technically feasible.

**Dependencies:** existing feed status data, support process for deletion, and
privacy-policy review before making new promises.

**Done when:** source errors are understandable to a normal reader and privacy
choices are actionable rather than only documented.

### 10. Offline/PWA support

**User outcome:** continue reading a chosen set of articles during unreliable
connectivity, then recover cleanly online.

**Thin first release:**

- Installable app shell and offline reader for recently opened articles.
- A user-controlled download limit for a recent unread or starred set.
- Clear offline indicator and retry behavior for actions made while offline.
- No background feed fetching or full-library sync in the first release.

**Dependencies:** cache-versioning strategy, storage quota handling, conflict
rules for article state, and browser support decisions.

**Done when:** an offline reader never presents stale content as fresh and
read/starred state reconciles predictably after reconnection.

## Choosing the next item

When returning to this roadmap, choose one primary outcome:

- **Immediate individual-reader value:** start with Search and saved searches.
- **Less manual triage:** start with Reader automation.
- **More insight from existing subscriptions:** start with Story comparison or
  Better briefings.
- **A stronger personal knowledge workflow:** start with Capture tools.
- **A platform for others:** start with Shared workspaces, then API/webhooks.
- **Trust and resilience before feature depth:** start with Privacy and source
  health, then Offline/PWA support.

## Resume checklist

1. Read this file and select exactly one initiative.
2. Run `git status --branch --short`; preserve unrelated work if the tree is
   not clean.
3. Refresh the production inventory and health status before making a feature
   claim.
4. Write a focused spec in `docs/superpowers/specs/` that fixes the thin first
   release, non-goals, data model, authorization rules, and acceptance checks.
5. Build and test one vertical slice before designing later phases.
6. Use the normal local verification stack and the approval-gated release
   command for any production deployment.
7. Update this roadmap's status and the selected initiative's notes when the
   release is complete.

## Guardrails for every initiative

- Preserve per-user authorization at every read and write boundary.
- Keep provider credentials out of application data, logs, sessions, and client
  components.
- Prefer bounded storage, pagination, rate limits, queues, and idempotent jobs
  as features add volume.
- Make AI output traceable to source articles and respect quotas.
- Treat imports, external URLs, webhooks, and browser capture as untrusted
  input.
- Do not add a feature merely because the roadmap names it; write the focused
  spec and confirm the user-facing outcome first.
