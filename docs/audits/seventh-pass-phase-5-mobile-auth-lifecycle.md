# Seventh-pass Phase 5: mobile authorization lifecycle

The lease-held maintenance worker now removes bounded, oldest-first pages of
expired device authorization codes, expired pending approvals, expired or
revoked historical device-session rows, and mutation receipts older than 30
days. It rechecks the eligibility predicate in each delete, reports aggregate
counts only, and runs on the existing 15-minute auth-token maintenance
schedule. Foreign keys retain stable device ownership while session audit
references become null when a historical row is pruned.

Request writes no longer delete mutation receipts. Healthy codes, pending
approvals, active sessions, and recent receipts are outside every candidate
predicate. The durable maintenance lease remains the only scheduler owner;
there is no production run or observation in this worktree.
