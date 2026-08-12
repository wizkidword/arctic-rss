# Seventh-pass capability status

**Implementation revision:** `64aa79eeea95dd57eb3cbe560d050080513bd64e`  
**Baseline revision:** `6672dad21274c25a2d90f0db9aaf007f053515a6`  
**Scope:** isolated source worktree. No deployment, production mutation,
signing operation, Play action, or public endpoint probe occurred.

| ID | Status | Evidence and remaining gate |
| --- | --- | --- |
| MOB-AUTH-001 | SOURCE_VERIFIED | Native authorization is default-off, browser-session bound, same-origin and pre-body-rate-limited, bounded-form parsed, and locally reauthenticated. Authorization/session artifacts now expire through bounded maintenance. Owner enablement and signed-device evidence remain open. |
| MOB-DEVICE-001 | SOURCE_VERIFIED | Stable device ownership is authoritative for receipts/installations while session IDs remain optional audit context. All 60 migrations and 12 real PostgreSQL mobile auth/sync tests passed in a disposable fixture. Production cardinality, lock, and backup evidence remain required. |
| MOB-LOGOUT-001 | SOURCE_VERIFIED | Terminal session failure, logout, and owner changes purge tokens, derived cache, queue, cursor, and offline selections before another account may mount protected routes. |
| MOB-SYNC-001 | SOURCE_VERIFIED | Typed events now invalidate only affected cache keys in the same SQLite transaction as cursor advancement; unknown event types fail conservatively. Pending mutations survive bootstrap recovery. Native physical-device convergence remains unverified. |
| MOB-OFFLINE-001 | SOURCE_VERIFIED | Starred/recent reader caches and up to ten selected collections remain user/device scoped and bounded to existing entry, byte, and retention limits. No automatic metered prefetch was added. Signed-device and metered-network evidence remain open. |
| MOB-CACHE-001 | SOURCE_VERIFIED | SQLite schema v3 indexes expiration and LRU paths; cache writes no longer enumerate every cache row. |
| NET-001 | OWNER_ACTION_REQUIRED | Trusted ingress source boundary was reviewed without Cloudflare, Nginx exposure, or VPS firewall changes. Owner-run redacted proof is still required. |
| OPS-BACKUP-001 | SOURCE_VERIFIED | Off-host acknowledgements bind dump and globals checksums; same-day pruning is an explicit dry-run report only. No production backup acknowledgement, report, or deletion ran. |
| MOB-ROUTES-001 | SOURCE_VERIFIED | Singular mobile routes are canonical; plural compatibility routes are lightweight redirects. Architecture checks enforce the mobile feature gate, HTTPS production callback, idempotent replay, push boundary, ownership markers, and authenticated route placement. |
| PLAY-001 | OWNER_ACTION_REQUIRED | The previous signed AAB is recorded as `SUPERSEDED`; manifest, App-Link static source, source delta, and Android configuration are verified. A replacement signed AAB, App Links live proof, device smoke, Play identity, upload, and track remain owner controlled. |

Status labels describe source and evidence separately. `SOURCE_VERIFIED` is not
a production, signed-build, or Play-publication claim.
