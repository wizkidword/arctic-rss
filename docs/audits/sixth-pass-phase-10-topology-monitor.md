# Sixth-pass Phase 10: topology-derived production monitor

**Status:** source slice verified locally; operational installation and
production verification remain owner-gated.

The monitor no longer assumes the `app` Compose project or an all-in-one
worker. The approved release now writes its selected topology and Compose
project to the active release marker. A root-only resolver reads that marker
and the matching checked-in topology manifest, validates both schema versions
and all monitor values, then supplies the monitor with the required health
services and worker modes.

The monitor constructs container names from the recorded Compose project. It
checks only services required by the selected topology: all-in-one and split
worker models are mutually exclusive, while chat gateway readiness and edge
proxy health are required only by chat topologies. A pre-existing
`COMPOSE_PROJECT` environment value must agree with the reviewed release
marker, so a stale operational file cannot silently direct the monitor to a
different application. A controlled compatibility fallback retains the
existing `COMPOSE_PROJECT` value (or `app`) only for an older rollback marker
that has no recorded project; controller-written markers are authoritative.

Focused source tests cover all four supported topologies and a non-default
Compose project on Linux. The current Windows workstation runs the source,
release-controller, typecheck, and lint tests but skips the Bash/Python
resolver fixture because those host tools are absent. No monitor helper was
installed, no systemd unit was run, and no production topology was changed.

## Initial mobile operational metrics

The same Phase 10 source slice also makes existing structured mobile logs more
useful as low-cardinality operational measurements. Mobile API request records
now contain a bounded response class instead of a request UUID. Separate
records cover authorization approval/cancel/failure, refresh success/retryable
failure/reuse detection, and sync page duration/event count/has-more/full
resync state. The existing six-hour retention worker now also records the
active non-revoked stable-device count plus journal rows, oldest retained age,
and prune count.

These records intentionally contain no user, device, feed/source, article,
query, token, request-body, header, or free-form device-name value. They do
not add an analytics SDK, a push-install metric, remote telemetry transport,
or production collection evidence. Offline-conflict aggregation remains
follow-up source work.
