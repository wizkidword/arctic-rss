# Android App Link statement

The native authorization callback is the registered production URI:

```text
https://arcticrss.com/mobile/auth/callback
```

The Android manifest declares that path, but no `assetlinks.json` is included
in the repository or published by this source change. The owner must first
create or select the real Android signing identity and obtain its SHA-256
certificate fingerprint.

Generate the statement locally only after that owner action:

```powershell
node scripts/generate-android-assetlinks.mjs --package com.arcticrss.reader --sha256-cert-fingerprint "AA:BB:..."
```

The generator requires the registered package and an exactly formatted,
non-placeholder 32-byte fingerprint. It refuses zero and placeholder values.
The resulting JSON must be reviewed and served at
`https://arcticrss.com/.well-known/assetlinks.json`; publishing it, configuring
the host, creating a signed Android build, and testing verification are
separate owner-approved operations.
