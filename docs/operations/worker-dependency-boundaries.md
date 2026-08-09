# Worker dependency boundaries

Docker Compose now assigns worker startup dependencies by responsibility rather
than using one shared dependency set.

| Service role | Waits for migration | Waits for durable Redis | Waits for ephemeral Redis |
| --- | --- | --- | --- |
| `worker-all` | Yes | Yes | Yes |
| `worker-ingestion` | Yes | Yes | No |
| `worker-ai-mail` | Yes | Yes | No |
| `worker-imports` | Yes | Yes | No |
| `worker-maintenance` | Yes | Yes | No |
| `worker-chat-events` | Yes | Yes | Yes |
| `worker-health` | Yes | Yes | Yes |
| `chat-gateway` | Yes | No | Yes |

This is a startup dependency boundary. Compose does not restart a service just
because an unrelated container stops, and durable-only workers do not receive
an ephemeral Redis URL. The separate health worker is the deliberate exception:
it needs both Redis workloads and the edge network to inspect the chat gateway
and publish the shared readiness snapshot. An ephemeral Redis outage therefore
cannot block or restart durable-only worker roles through Compose dependency
handling.

Verify the rendered model without starting containers:

```bash
npm run compose:verify-dependencies
```

This check does not authorize a production restart or deployment.
