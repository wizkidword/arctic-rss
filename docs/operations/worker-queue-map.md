# Worker and queue map

This is the secret-safe current OVH map for the worker runtime. It documents
code and Compose ownership; it does not authorize changing the worker topology.

## Current OVH mode

- Production runs exactly one healthy `worker` service with `WORKER_MODE=all`.
- Every BullMQ queue uses durable Redis. Ephemeral Redis is not a queue store.
- The `split-workers` Compose profile is present but inactive. Do not activate
  it alongside the all-in-one worker without an approved capacity review and
  release.
- Every mode writes its own heartbeat under `/tmp`; Compose marks it unhealthy
  after 90 seconds without one. SIGINT and SIGTERM pause intake, wait for
  active work up to the configured grace period, then close workers, queues,
  event publishers, the maintenance lock, and Prisma.

## Queue ownership

| Queue | Consumer responsibility | Worker mode | Work |
| --- | --- | --- | --- |
| `feed-refresh` | Ingestion | `ingestion` | Refresh feeds and enqueue eligible chat article integration. |
| `podcast-refresh` | Ingestion | `ingestion` | Refresh podcast metadata and episodes. |
| `ai-digest` | AI and mail | `ai-mail` | Generate an on-demand AI digest through the leased AI-operation path. |
| `smart-digest` | AI and mail | `ai-mail` | Process scheduled smart-digest rules. |
| `smart-digest-email` | AI and mail | `ai-mail` | Deliver pending smart-digest email. |
| `opml-import` | Imports | `imports` | Process resumable OPML imports. |
| `bulk-read` | Imports | `imports` | Process resumable bulk read/unread work. |
| `chat-article-integration` | Chat events | `chat-events` | Deliver eligible feed articles to chat integration. |

`all` owns every responsibility above. A dedicated mode owns only its listed
responsibility, so a split deployment must include all five modes:
`ingestion`, `ai-mail`, `imports`, `maintenance`, and `chat-events`.

## Maintenance ownership

`maintenance` has no BullMQ consumer. It runs the bounded scheduler and owns a
durable-Redis lease, so concurrent maintenance workers skip rather than run
the same schedule twice. Its work includes due feed/podcast refresh enqueueing,
auth-token and security-event cleanup, AI-operation lease reconciliation,
saved-monitor processing, bounded chat retention, and pending smart-digest
email enqueueing.

`chat-events` also runs the transactional chat-event outbox publisher. The
publisher leases and retries rows from PostgreSQL before publishing versioned,
non-evidence events through ephemeral Redis; it is safe to retry after a
worker interruption.

## Operating boundary

Before changing modes, record the active images and worker state, verify
durable Redis health and queue backlog, measure OVH CPU and memory headroom,
and use the approval-gated off-host release process. Keep the prior image
archive and do not start both the all-in-one worker and any duplicate queue
owner. Verify each enabled mode's heartbeat and a controlled queue completion
after the change.
