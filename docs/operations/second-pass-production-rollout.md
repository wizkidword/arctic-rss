# Second-pass production rollout runbook

This runbook prepares an Arctic RSS release; it does **not** authorize one.
Production remains OVH-only and every release requires a fresh exact
`DEPLOY <short-sha>` approval.

## Scope and target selection

Use one topology from [`ops/topologies.json`](../../ops/topologies.json). The
normal production selection is `all-in-one`, which releases `web` and `worker`.
Do not activate all-in-one and split-worker responsibilities together.

Treat the target SHA as `git rev-parse HEAD` only after all of the following
are true: the working tree is clean, it exactly matches `origin/main`, and the
required CI workflow is green for that SHA. The private release configuration
stays outside the repository and must never be printed or committed.

## Read-only release preflight

From a clean Windows checkout with Docker Desktop running, first validate the
same release gate without touching OVH:

```powershell
pwsh -NoProfile -File .\scripts\windows\deploy-approved-release.ps1 `
  -ConfigurationPath "$env:USERPROFILE\.arctic-rss\release-config.json" `
  -Topology all-in-one `
  -DryRun
```

The dry run validates the exact upstream SHA, full local test/build/schema
gate, selected topology, and matching GitHub CI. It must complete without a
warning being waived. It creates no archive, backup, upload, migration, or VPS
change.

## Approved release

Only after a fresh owner authorization, run:

```powershell
pwsh -NoProfile -File .\scripts\windows\deploy-approved-release.ps1 `
  -ConfigurationPath "$env:USERPROFILE\.arctic-rss\release-config.json" `
  -Topology all-in-one `
  -Approve
```

At the console prompt, type exactly the approved `DEPLOY <short-sha>`. The
script then performs the off-host image build and checksum checks, validates
capacity, retains and verifies a backup, runs migrations only through
`migrate`, recreates the complete selected service set, writes a private
release record, and checks service/local/public/login/monitor health.

## Post-release verification

The script's successful result is required but not sufficient for a handoff.
Independently confirm the public surfaces:

```powershell
$health = Invoke-WebRequest -UseBasicParsing https://arcticrss.com/api/health
$login = Invoke-WebRequest -UseBasicParsing https://arcticrss.com/login
$health.StatusCode
$login.StatusCode
```

Expected results are HTTP 200 for both and `status: ok` from the health body.
Then exercise the changed reader path, login, feed refresh, search, and
transcript access. When chat is enabled, also verify gateway connection and a
real-time event. Observe logs, queue freshness, worker heartbeats, and resource
usage for an owner-chosen bounded window before declaring the release live.

## Immediate rollback triggers

Begin rollback review if any of these persist beyond the normal restart window:

- public or internal health is degraded;
- a required worker heartbeat is missing or queue age rises continuously;
- authentication failures materially increase;
- migrations are incompatible or the web/chat gateway crash-loops;
- Redis workloads are misrouted; or
- resource pressure prevents normal SSH or application operation.

## Rollback preflight and execution

Choose the **prior** topology from the private release record, not the failed
release topology. First perform the non-mutating record/manifest check:

```powershell
pwsh -NoProfile -File .\scripts\windows\rollback-approved-release.ps1 `
  -ConfigurationPath "$env:USERPROFILE\.arctic-rss\release-config.json" `
  -ReleaseRecordPath "<private release record path>" `
  -Topology all-in-one `
  -DryRun
```

After a separately approved rollback, rerun with `-Approve` and type exactly
`ROLLBACK <failed-release-short-sha>`. The rollback reuses the recorded images
and prior topology; it neither rebuilds images nor runs migrations nor deletes
data volumes. Recheck public health, login, worker health, and the affected
reader flow before calling the rollback complete.

For detailed command behavior and limitations, see the
[approved release command](approved-release-command.md) and the
[deployment rollback runbook](deployment-rollback-runbook.md).
