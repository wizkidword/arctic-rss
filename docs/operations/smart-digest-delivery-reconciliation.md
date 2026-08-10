# Smart Digest delivery reconciliation

Use this command only after an operator has inspected the retained provider
message ID and established whether the prior SMTP submission was delivered.
It intentionally does not resend an uncertain delivery on its own.

## Inspect an uncertain delivery

```powershell
npm run smart-digest:reconcile-delivery -- --run <digest-run-id>
```

The result includes the delivery state and provider message ID. Confirm the
provider outcome before choosing either mutation below.

## Record confirmed delivery

```powershell
npm run smart-digest:reconcile-delivery -- --run <digest-run-id> --confirm-delivered
```

This marks the Digest Run and Smart Digest as sent. It does not enqueue email.

## Record confirmed non-delivery and allow one retry workflow

```powershell
npm run smart-digest:reconcile-delivery -- --run <digest-run-id> --confirm-not-delivered
```

This is the only reconciliation action that resets the delivery state and
queues the existing fixed-ID email job. The explicit confirmation is the
authorization to retry; do not use it merely because the provider outcome is
unknown.

## Safety boundary

`DELIVERY_UNKNOWN` and legacy `PROCESSING` rows remain no-resend states until
an operator records one of the confirmations above. If the database is down
immediately after SMTP acceptance, the worker still completes without retrying
the send; inspect the retained `PROCESSING` row after database recovery.
