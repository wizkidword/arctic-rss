# Approved release command

`scripts/windows/deploy-approved-release.ps1` makes the reviewed VPS deployment
repeatable without moving SSH access, production environment values, or approval
decisions into GitHub Actions. It builds the application images on the release
operator's Windows Docker Desktop host, then transfers the finished images to
OVH; it does not build application images on the VPS.

The command releases only a clean local checkout whose `HEAD` exactly matches
`origin/main`. It runs the full local gate, requires the complete CI workflow
to have passed for that exact commit, and then requires a typed console
confirmation before it starts a production backup.

## Private configuration

Copy `scripts/windows/release-config.example.json` to a private location outside
the repository, fill in the local SSH key path and the reviewed non-secret VPS
settings, and keep the file private. Do not put environment values, passwords,
tokens, or backup contents in this file.

`LocalBuildRoot` is a private, non-secret local path for exact source
workspaces and retained image archives. It defaults to `D:\Arctic RSS Docker`
when omitted. Docker Desktop must be running before an approved release; the
release command will use its per-user command-line client if a terminal has not
yet picked up Docker's PATH update.

## Run a safe preflight

```powershell
pwsh -File .\scripts\windows\deploy-approved-release.ps1 `
  -ConfigurationPath "$HOME\.arctic-rss\release-config.json"
```

The preflight fetches `origin/main`, refuses uncommitted work or a stale local
head, runs the local verification stack, and waits for all required GitHub CI
jobs. It stops before any VPS action and tells the operator to rerun with
`-Approve`.

On a Windows checkout that normalizes `prisma/schema.prisma` to CRLF, Prisma's
format checker can report a line-ending-only false positive. The command
detects that case, still validates the local schema, and requires the exact
commit's CI check of the canonical LF schema to succeed before release.

Use `-DryRun` to prove the same local and CI gates without creating an archive
or contacting the VPS.

## Run an approved release

```powershell
pwsh -File .\scripts\windows\deploy-approved-release.ps1 `
  -ConfigurationPath "$HOME\.arctic-rss\release-config.json" `
  -Approve
```

The command then requires the operator to type `DEPLOY <short-sha>`. It creates
an exact local source workspace, builds the migration, web, worker, and
chat-gateway images for `linux/amd64`, and retains one transfer archive under
`LocalBuildRoot`. Before it begins a backup, it confirms OVH has enough free
space for the transferred archive and loaded layers. It then verifies the
source and image SHA-256 values locally and on the VPS, loads the finished
images without running a VPS build, applies and verifies committed Prisma
migrations, retains the previous source directory, recreates only web and
worker, and verifies local/public health, login, and the monitor service.

The image archive is intentionally retained on the local build drive for a
short-lived recovery/retry path. Review it before removing it; the release
command never deletes prior local image archives automatically.

Before that backup, archive, staging, or image build, the approved path performs
a read-only ownership preflight for unapplied migrations. It obtains the
migration-role name inside a short-lived migration container without printing
the connection URL, then confirms the role can alter the existing quoted
PostgreSQL types/relations referenced by committed migration SQL, create the
needed public-schema objects, and create requested extensions. It exits before
any release mutation when that check fails.

The guard intentionally recognizes Prisma-style `ALTER TYPE`, `ALTER TABLE`,
`ALTER SEQUENCE`, `ALTER DOMAIN`, `ALTER MATERIALIZED VIEW`, `ALTER INDEX`,
`CREATE INDEX`, object-creation, and extension statements. Custom raw SQL
outside that scope still requires a manual migration ownership review.

It writes a non-secret JSON release record to the configured private local
directory. Schema-changing releases still require a reviewed migration and a
forward-fix plan; do not use the retained source directory alone to roll code
back across an incompatible database change.
