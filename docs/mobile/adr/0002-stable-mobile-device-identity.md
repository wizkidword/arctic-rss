# ADR 0002: stable mobile device identity

**Status:** accepted for sixth-pass source work.

## Decision

Add an additive `MobileDevice` record that is independent of refresh-token
rotation. It owns a user, token family, bounded descriptive metadata,
authorization version, lifecycle timestamps, revocation, reuse-detection, and
refresh expiry. Refresh-token rows become a `DeviceSession`/refresh-history
relation to that stable device.

Existing `DeviceSession` data will be retained and backfilled into one stable
device per extant token family. The rollout is expand/backfill/dual-read before
any later contract or schema removal; no destructive rename is allowed.

## Rationale and consequences

A refresh token is deliberately replaced frequently, so it is not a usable
device identity. Stable records permit family-wide revocation, installation
cleanup, honest device management, and bounded history while preserving
current sessions through a reversible additive migration. Device names and app
versions remain untrusted labels and are never authentication evidence.
