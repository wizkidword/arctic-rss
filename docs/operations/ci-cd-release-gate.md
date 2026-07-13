# CI/CD release gate

GitHub Actions verifies code; it does not hold VPS credentials or deploy to
production. A production release remains a deliberate operator action after a
reviewed commit has passed CI. This keeps the production approval boundary and
prevents SSH keys, tunnel credentials, and production environment values from
entering GitHub Actions.

## Required CI evidence

Every pull request and update to `main` runs the following checks:

- locked dependency installation;
- Prisma formatting, validation, generation, migration deployment, status, and
  drift checks against a disposable PostgreSQL service;
- unit, security, and concurrency regression tests; type checking; linting;
  and the production Next.js build;
- a Chromium smoke test of the public landing page and loopback-only liveness
  route;
- dependency review on pull requests and a production dependency audit;
- full-history secret detection and JavaScript/TypeScript static analysis;
- production web and worker Docker builds, high/critical vulnerability scans,
  and SBOM artifacts retained for 30 days.

The security checks also run weekly. Third-party actions are pinned to reviewed
commit SHAs where available; Dependabot opens controlled update pull requests
for npm packages and workflow actions.

## Manual production approval and release record

1. Review the exact commit and confirm all required CI checks passed.
2. Explicitly approve the release with an operator who has console recovery
   access.
3. Follow [deployment-rollback-runbook.md](deployment-rollback-runbook.md):
   record the commit and archive checksum, run a verified backup, stage and
   build the exact archive, run the one-shot migration, then recreate only the
   web and worker services.
4. Record the deployment time, backup identifier, health/smoke result, and the
   retained rollback release in the private operator inventory.

No release is considered complete until internal and public readiness checks,
the relevant user flow, and the monitor service all report success. Roll back
with the retained prior release when a code-only change is unsafe; use a
reviewed forward repair or the matching backup for incompatible schema changes.
