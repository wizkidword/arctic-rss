# Arctic RSS second-pass baseline validation

**Source revision:** `a033de2045bd3890b11c781bb4632589fbe25df1`

**Runtime used:** bundled Node.js `v24.14.0`; the host-default Node.js `v20.19.0`
does not meet the repository's `>=22` engine requirement.

## Commands and results

| Command | Result |
| --- | --- |
| `git status --short --branch` | Pass — clean `codex/second-pass-phase-0` worktree before Phase 0 documentation. |
| `git rev-parse origin/main` | Pass — `a033de2045bd3890b11c781bb4632589fbe25df1`. |
| `git rev-list --left-right --count a033de2...origin/main` | Pass — `0 0`; no post-audit source delta. |
| `npm ci --legacy-peer-deps` | Pass with Node 24 — 881 packages installed and Prisma Client generated. npm reports 11 dependency vulnerabilities (5 high, 6 moderate); no automatic dependency change was made. |
| `prisma format --check` / `prisma validate` | Pass — all files formatted and schema valid. |
| `vitest run` | Pass — 231 files passed, 2 skipped; 1,054 tests passed, 3 skipped. |
| `tsc --noEmit` | Pass. |
| `eslint .` | Pass with two pre-existing unused-parameter warnings in `src/app/app/actions.ts`. |
| `next build` | Pass — optimized production build completed with Next.js 16.2.11. |
| `docker compose --env-file .env.example config --quiet` | Blocked safely — Compose still requires the intentionally absent `.env` from its checked-in `env_file` directives. No `.env` was created or copied. |
| Existing fixed-port Playwright suite | Blocked safely — an unrelated local Node process already listens on port 3000. It was not interrupted. |
| Isolated production-build browser smoke | Pass — the built app ran on localhost:3100 with fake E2E-only values; `/api/live` returned `200 {"status":"ok"}` and a real browser snapshot confirmed the Arctic RSS landing page plus guest, signup, and login entry points. |
| Disposable-database migrations | Pass — all 36 committed migrations applied to an isolated auto-removed PostgreSQL 17.10 container; `migrate status` was up to date and `migrate diff --exit-code` reported no difference. |

## Baseline limitations

- No `.env` was read, copied, or displayed.
- No production host, production database, or production container was
  contacted or changed.
- The fixed-port browser test runner should be rerun once port 3000 is free.
- Compose config validation should be rerun using an owner-approved,
  non-secret local test environment or after Phase 1 removes broad `.env`
  injection.
