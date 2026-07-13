# Current production inventory

**Captured:** 2026-07-12  
**Scope:** read-only inventory of the currently deployed Arctic RSS VPS and
the local `main` checkout. This document intentionally excludes host addresses,
account names, environment values, tokens, and credentials.

## Current topology

```text
Internet
  -> Cloudflare Tunnel (standalone cloudflared container)
  -> web container on host loopback :3000
  -> PostgreSQL on host loopback :5432
  -> Redis on host loopback :6379

web + worker + postgres + redis + one-shot migrate
  -> Docker Compose project
```

The production connector is a separately managed `cloudflared` container, not
a member of the core Compose service set. Host Nginx, Caddy, and Apache services
are inactive. The application health endpoint returned `{"status":"ok"}` from
the host loopback address and publicly through the configured domain.

External TCP probes from the inventory workstation could not reach ports 3000,
5432, 6379, or the cloudflared metrics listener on 20241. The application,
PostgreSQL, and Redis therefore appear to be correctly non-public at this time.

## Host and operating-system baseline

| Area | Observed state | Follow-up |
| --- | --- | --- |
| Operating system | Ubuntu 24.04 LTS, time synchronized, unattended upgrades enabled | Record an OS patch/reboot policy. |
| Capacity | 3.7 GiB RAM, no swap, root disk 83% used with about 6 GiB free; inode use is healthy | P1: investigate Docker images, logs, and retained release folders before disk pressure causes an outage. |
| Reboot state | The host reports a reboot required | Schedule a maintenance window after a backup and console-access check. |
| Host firewall | UFW active; default deny inbound/forwarding; SSH is allowed publicly | P1: restrict SSH by a safe provider/firewall or trusted-network policy after a recovery path is verified. |
| SSH | Key authentication enabled; root key login permitted; password authentication enabled; Fail2ban inactive | P1: create/verify a non-root sudo account, then disable password authentication and evaluate disabling direct root login. Do not change SSH and firewall together. |

## Containers, data services, and runtime state

| Component | Observed state | Follow-up |
| --- | --- | --- |
| Web | Healthy, loopback-bound, runs as the `nextjs` user | Add resource limits, read-only filesystem compatibility testing, and structured log rotation. |
| Worker | Running but has no explicit container user, resource limits, or read-only filesystem | P1: run as non-root and add bounded resources/logging after compatibility validation. |
| PostgreSQL | Healthy, loopback-bound, persistent named volume, database is about 154 MB | Add verified logical backup, retention, restore drill, and migration separation. |
| Redis | Healthy, loopback-bound, persistent named volume, AOF enabled and last background operations report success | Define memory limit, eviction policy, queue retention, and monitoring. |
| Cloudflared | Running separately as a non-root user | Document its lifecycle and verify the tunnel configuration is backed up outside the application repository. |
| Logging | Containers use the Docker `json-file` driver; rotation settings were not established in this inventory | P1: define bounded rotation before disk pressure becomes critical. |

The core services use `restart: unless-stopped`. No explicit CPU or memory
limits, read-only root filesystems, or dropped Linux capabilities were observed
for the running containers.

## Deployment and recovery baseline

- The deployed source directory has no `.git` metadata, so production cannot
  currently identify a source commit from the checkout itself.
- Seventeen prior application directories exist beside the active release.
  They are potential rollback material but also a likely contributor to disk
  pressure; do not remove them until their contents, age, and rollback value
  have been catalogued.
- No Prisma migrations directory exists locally or on the deployed source.
  The current Compose `migrate` service still uses `prisma db push`.
- No host-level database-backup timer or root crontab entry was found. The only
  backup-like file discovered was an environment-file copy in a prior release;
  that is not a database backup or a verified recovery mechanism.
- A provider snapshot, an off-host encrypted backup, and a restore drill have
  **not** been verified. They are hard gates before any production mutation.

See [backup-restore-checklist.md](backup-restore-checklist.md) and
[deployment-rollback-runbook.md](deployment-rollback-runbook.md).

## Repository-to-VPS configuration comparison

- The checked-in `Dockerfile` and `docker-compose.yml` match the deployed files
  after normalizing line endings.
- The deployed security-sensitive files (`signup` action, Auth.js setup, admin
  email helper, email-verification policy, and Prisma schema) match this
  checkout after normalizing line endings.
- Local `package.json` and lockfile intentionally differ from the deployed
  source because the local setup records supported Node engines. This is not a
  deployed application change.
- The repository has no CI workflow. The current VPS deployment uses source
  archives/folder swaps rather than a commit-addressable deployment artifact.
- The repository is temporarily public for testing. It contains no production
  `.env` file, but `PROJECT.md` and historical deployment documentation include
  operational topology details. Restore private visibility before treating this
  repository as a long-term operations record, or remove those details first.

## Confirmed security finding: SEC-001

**Status: P0 / release blocker — confirmed in the deployed source.**

1. Credentials signup chooses `ADMIN` when a submitted email matches
   `ADMIN_EMAILS`.
2. The Auth.js Google account-creation path applies the same email-derived role
   and plan assignment.
3. Production email verification is currently disabled, while an administrator
   allowlist is present.
4. The production database contains one verified administrator, sixteen regular
   accounts (twelve verified), and existing administrative audit rows. No email
   addresses or account identifiers were recorded in this inventory.

An unauthenticated credentials signup can therefore claim the configured
administrator address without proving mailbox ownership and receive the
administrator role. No test account was created to demonstrate this; the live
code path and production policy establish the finding.

## Risk-ranked next actions

| Priority | Finding | Required gate or next action |
| --- | --- | --- |
| P0 | Email-derived administrator promotion plus disabled email verification | Implement and test SEC-001 locally. Before deployment, create a provider snapshot and a verified PostgreSQL backup; retain a recovery path to the current administrator. |
| P1 | No verified database backup, off-host retention, or restore drill | Complete the backup checklist before any live code, schema, container, SSH, or firewall mutation. |
| P1 | Production schema uses `db push` and has no committed migration history | Do not introduce schema changes in SEC-001. Address migration discipline as DB-001 before the next schema change. |
| P1 | SSH password login remains enabled; root key login is allowed; no Fail2ban | Harden only in a separate, console-backed infrastructure change. |
| P1 | Disk at 83% with retained releases and unbounded JSON logs | Inventory disk consumers and create a safe retention policy; do not prune blindly. |
| P2 | Worker/root containers lack hardened runtime controls and resources are unbounded | Address as a compatibility-tested INFRA-001 change. |
| P2 | No CI workflow or commit-addressable production release | Add CI and a repeatable artifact/deployment procedure after the recovery gate is complete. |

## Phase 0 exit criteria

Before a production change, record all of the following in the deployment
ticket or task completion report:

1. Provider snapshot identifier and creation time.
2. PostgreSQL logical backup path, nonzero size, checksum, and successful
   `pg_restore -l` verification.
3. Encrypted/off-host retention location and responsible operator.
4. Current container image identifiers and Compose-file checksum.
5. A tested rollback command/path and a live recovery-console session.
6. The exact target commit and whether it requires a migration.

No production change has been made while producing this inventory.
