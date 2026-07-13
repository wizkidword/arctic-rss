# Prisma migration baseline runbook

The repository now contains a baseline migration representing the schema that
already exists in production. Its SQL creates a fresh database; it is not safe
to run that SQL against the existing production database.

## One-time production baseline

Complete the backup/restore gate first. Then, from the reviewed release
directory and without printing `.env` values:

```bash
docker compose run --rm --no-deps migrate \
  ./node_modules/.bin/prisma migrate diff --from-config-datasource \
  --to-schema=prisma/schema.prisma --exit-code

docker compose run --rm --no-deps migrate \
  ./node_modules/.bin/prisma migrate resolve --applied 20260713023000_baseline

docker compose run --rm --no-deps migrate \
  ./node_modules/.bin/prisma migrate status
```

The first command must report no schema drift. If it does not, stop: do not
mark the baseline as applied and do not use `db push` as a workaround.

## Future migrations

1. Create a reviewed migration locally against a disposable PostgreSQL target.
2. Test it against a restored production backup where practical.
3. Deploy it with `docker compose run --rm --no-deps migrate`.
4. Check `prisma migrate status` before recreating web or worker.
5. Retain the matching backup and previous release. Do not roll code backward
   across an incompatible schema; restore the matching backup or forward-fix.
