# AI operation lease recovery

AI summaries and digests reserve one monthly allowance unit before a provider
request. Each provider call now owns a short database lease with a fencing
attempt number. Only that lease owner can record completion or release quota.

The worker scheduler runs a PostgreSQL-advisory-lock-protected reconciliation
pass. It processes at most the scheduler batch size per pass, releases expired
reservations, and marks them retryable. The next idempotent queue attempt can
reserve the same logical operation again without double-charging the user.

## Monitor

Search worker logs for the structured `ai_operation_reconciliation` event.
Alert when either value is nonzero for consecutive runs:

- `released`: expired operations reclaimed from a stopped or wedged worker.
- `ledgerDivergences`: a period's reserved count differs from its active
  operation reservations.

Useful read-only database checks:

```sql
SELECT "id", "action", "status", "leaseExpiresAt", "attempt", "updatedAt"
FROM "AiOperation"
WHERE "status" IN ('RESERVED', 'PROCESSING')
ORDER BY "updatedAt" ASC;

SELECT "periodId", SUM("reservedUnits") AS operation_reserved_units
FROM "AiOperation"
WHERE "periodId" IS NOT NULL AND "status" IN ('RESERVED', 'PROCESSING')
GROUP BY "periodId";
```

Do not manually mark an operation completed. If reconciliation is repeatedly
releasing work, inspect provider latency and worker restarts before retrying.
