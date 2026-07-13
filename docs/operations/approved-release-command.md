# Approved release command

`scripts/windows/deploy-approved-release.ps1` makes the existing reviewed VPS
deployment repeatable without moving SSH access, production environment values,
or approval decisions into GitHub Actions.

The command releases only a clean local checkout whose `HEAD` exactly matches
`origin/main`. It runs the full local gate, requires the complete CI workflow
to have passed for that exact commit, and then requires a typed console
confirmation before it starts a production backup.

## Private configuration

Copy `scripts/windows/release-config.example.json` to a private location outside
the repository, fill in the local SSH key path and the reviewed non-secret VPS
settings, and keep the file private. Do not put environment values, passwords,
tokens, or backup contents in this file.

## Run a safe preflight

```powershell
pwsh -File .\scripts\windows\deploy-approved-release.ps1 `
  -ConfigurationPath "$HOME\.arctic-rss\release-config.json"
```

The preflight fetches `origin/main`, refuses uncommitted work or a stale local
head, runs the local verification stack, and waits for all required GitHub CI
jobs. It stops before any VPS action and tells the operator to rerun with
`-Approve`.

Use `-DryRun` to prove the same local and CI gates without creating an archive
or contacting the VPS.

## Run an approved release

```powershell
pwsh -File .\scripts\windows\deploy-approved-release.ps1 `
  -ConfigurationPath "$HOME\.arctic-rss\release-config.json" `
  -Approve
```

The command then requires the operator to type `DEPLOY <short-sha>`. It creates
an exact `git archive`, verifies its SHA-256 locally and on the VPS, runs and
verifies the backup, stages the archive while copying the live `.env` without
printing it, builds the staged images, applies and verifies committed Prisma
migrations, retains the previous source directory, recreates only web and
worker, and verifies local/public health, login, and the monitor service.

It writes a non-secret JSON release record to the configured private local
directory. Schema-changing releases still require a reviewed migration and a
forward-fix plan; do not use the retained source directory alone to roll code
back across an incompatible database change.
