# External IRC network matrix

Last owner decision reviewed: 2026-07-14. This is an implementation record, not third-party operator approval. No public-network connection has been made from Arctic infrastructure.

| Network | Owner authorization | Fixed endpoint | Mode | TLS | Public beta | Operator acknowledgement | Directory policy | Logging/persistence |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Controlled test server | Automated and integration testing | Local/controlled only | Test adapter target | Required when the test server supports TLS | Not applicable | Not applicable | Test fixtures only | No production data |
| OFTC | Owner-only compatibility spike and manual smoke test | `webirc.oftc.net:8443` | Evaluate the network-operated WebIRC endpoint | Required | Blocked | Not yet obtained | Small owner-curated set; no crawler or broad `/LIST` | No message bodies, credentials, analytics, or indexing |
| Libera.Chat | Disabled-by-default compatibility profile and runbook only | `irc.libera.chat:6697` | Direct TLS only after operator acknowledgement | Required | Blocked | Required before any multi-user traffic | No crawler; no live directory query until acknowledged | No public logging/scraping; credentials memory-only in a later reviewed phase |
| EFnet, DALnet, QuakeNet, Rizon, Snoonet, arbitrary hosts | Deferred | None | Not implemented | N/A | Blocked | Separate owner decision required | Not permitted | Not permitted |

## Enforced code boundary

`src/lib/chat/external-networks.ts` contains the complete fixed allowlist. Future connector code receives an approved network ID and resolves it through this registry; it must never accept a host, port, URL, redirect, or DNS target from the browser or a database record.

The registry does not establish a connection. `resolveApprovedExternalIrcTarget(...)` resolves only the registry hostname and rejects loopback, private, shared-address-space, documentation, link-local, multicast, and otherwise malformed results before a future dialer can run. The dialer remains blocked until it also performs exact TLS certificate validation, per-network circuit-breaking, flood-aware queuing, and session isolation. The `OFTC` profile is owner-only and the `Libera.Chat` profile has no public-beta authorization.

## Required pre-connection checklist

1. Add and run controlled-server protocol/integration tests; no automated test may contact a public network.
2. Keep `ARCTIC_IRC_EXTERNAL_ENABLED` and the individual network flag disabled until an owner deliberately enables an owner-only environment.
3. Confirm the exact endpoint mode and visible third-party privacy/rules notice in the browser UI.
4. For any Arctic-originated bouncer/gateway architecture, obtain and record network-operator acknowledgement before connecting.
5. Before any multi-user public beta, complete the abuse contact, connection-volume, directory-query, logging, and deletion records.
