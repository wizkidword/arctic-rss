# Arctic IRC Phase 1 runbook

## Safe default

All Arctic IRC flags in `.env.example` default to `false`. Phase 1 adds no chat route, navigation entry, WebSocket listener, or automatic bootstrap. Existing reader traffic remains unchanged.

## Apply the schema

Review the committed additive migration, then use the normal release migration account:

```powershell
npm run prisma:generate
npm run prisma:deploy
```

Run the explicit official-room bootstrap only after the migration has applied and the Discover directory is available:

```powershell
npm run chat:bootstrap
```

The bootstrap is idempotent. It only upserts the ten defined official rooms and their canonical Discover-interest links; it does not create users, messages, or enable chat.

## Rollback and recovery

The migration is additive. The operational rollback is to leave every `ARCTIC_IRC_*` flag false and roll application code back; existing reader tables and queries are untouched.

Do not automatically drop chat tables in production. A physical schema rollback is only appropriate before chat data exists and after a reviewed backup. It requires a dedicated, reviewed SQL migration that removes foreign keys, indexes, tables, and enum types in dependency order. Once chat data exists, use a forward repair or an approved retention/deletion process instead.

## Phase 1 verification

```powershell
npm run prisma:generate
npx prisma validate
npm test
npm run lint
npm run typecheck
npm run build
```

For a database-backed environment, also run `npm run chat:bootstrap` twice and confirm that both executions succeed without duplicate rooms or room-interest rows.
