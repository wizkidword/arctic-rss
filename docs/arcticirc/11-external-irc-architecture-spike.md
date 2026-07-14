# External IRC architecture spike

## Decision for the current phase

Do not connect to OFTC or Libera.Chat yet. Build only isolated models, feature flags, a fixed registry, controlled-server tests, and operator-ready documentation. Native Arctic chat remains the only live chat path.

## Candidates

| Concern | Soju sidecar | Custom TypeScript connector |
| --- | --- | --- |
| IRCv3/CAP/SASL/parser maturity | Mature bouncer behavior, but requires operational and account-model evaluation | Must implement and test protocol behavior; high correctness burden |
| Per-user isolation | Natural bouncer concept, but provisioning and auth mapping need design | Explicitly owned by the application; easier to couple to fresh Arctic session checks |
| Retention/deletion | Buffer persistence must be configured and deletion semantics proven | Session-only buffers can be the initial default; no remote message database required |
| Scaling/operations | Extra image, upgrade, health, TLS, and config lifecycle | Fits the existing Node services but needs a robust reconnect/flood-control worker |
| Credentials | Requires a reviewed secure handoff/storage model | Current decision deliberately keeps credentials memory-only and out of persistence |
| Licensing | Must be reviewed before distribution or service adoption | Uses the existing application license/dependency process |
| Network policy compatibility | Still requires per-network operator approval for bouncer behavior | Still requires approval if Arctic infrastructure originates connections |

## Current choice

Use a **custom TypeScript compatibility adapter against a controlled server** for the first spike. It has the smallest enabled surface because it can be limited to session-only owner connections, a fixed registry, no credential persistence, no remote transcript persistence, and no bridge to native chat. This is not approval to build a full bouncer or contact public networks.

A Soju proof-of-concept remains an explicit comparison gate before any multi-user beta. It must document license implications, account provisioning, protocol capability coverage, buffer/deletion behavior, scaling, observability, and how it would satisfy each approved network's connection policy.

## Non-negotiable boundaries

- External identities and favorites use the `ExternalIrc*` model family, not `ChatProfile` or `ChatMessage`.
- No browser, URL, storage, log, trace, analytics payload, or transcript contains a credential.
- No arbitrary target, `/raw`, `/quote`, DCC, peer-to-peer address exposure, bot, bridge, feed post, or public-network automated test is allowed.
- Network outage is isolated from the reader and native gateway.
- Account deletion must disconnect all external sessions and remove Arctic-held identity/favorite/credential/buffer records before the feature can leave owner-only status.
