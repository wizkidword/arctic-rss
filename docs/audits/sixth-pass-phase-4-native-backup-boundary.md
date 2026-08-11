# Sixth-pass Phase 4 Android backup boundary

**Status:** source-verified; no signed Android artifact or Play action.

The Android Expo configuration sets `allowBackup` to `false`, preventing the
application's private data from being included in Android Auto Backup or
device-to-device transfer. The SecureStore plugin's Android backup setting is
retained as an explicit configuration boundary.

`npm run mobile:verify-native-config` verifies the registered Android package,
the disabled-backup setting, the exact HTTPS authorization callback, and the
SecureStore configuration from source. It is local evidence only: inspecting a
generated signed Android manifest and a real restore attempt remain required
before an alpha build can claim backup-exclusion proof.
