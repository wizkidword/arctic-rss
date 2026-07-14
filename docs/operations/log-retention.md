# Production log retention

Arctic RSS uses Docker's `journald` logging driver for every Compose-managed
service, including the dormant chat gateway. The release tool installs
`ops/systemd/60-arctic-rss-log-retention.conf`, restarts `systemd-journald`,
and vacuums entries older than 30 days before recreating the service
containers.

This implements the 30-day standard-log period for application and gateway
logs. The worker separately removes database-backed security events after 90
days; that does not extend the retention of ordinary container logs.

The current production Cloudflare tunnel is not Compose-managed: its local
ingress configuration forwards the public hosts to host-loopback port 3000.
Routine releases deliberately do not replace or reconfigure it. Before the
ArcticIRC beta can be enabled, migrate that connector through a separately
tested plan that preserves the reader route, adds the canonical `/socket.io`
route to `chat-gateway:3001`, and uses the 30-day journal driver. Until then,
delivery-log retention and the WebSocket route are unverified launch blockers.

After a release, verify the effective retention configuration and drivers
without printing log contents or environment values:

```bash
sudo systemd-analyze cat-config systemd/journald.conf | grep '^MaxRetentionSec=30day$'
sudo docker inspect -f '{{.HostConfig.LogConfig.Type}}' app-web-1
sudo docker inspect -f '{{.HostConfig.LogConfig.Type}}' app-worker-1
sudo docker inspect -f '{{.HostConfig.LogConfig.Type}}' app-postgres-1
sudo docker inspect -f '{{.HostConfig.LogConfig.Type}}' app-redis-1
```

Each Docker command must return `journald`. Do not publish the 30-day policy
claim for delivery logs, or enable ArcticIRC, until the tunnel-specific
migration has been completed and verified.
