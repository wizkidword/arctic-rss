import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { cp, mkdtemp, readdir, readFile, rm, symlink } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { basename, join, resolve } from "node:path";
import { promisify } from "node:util";
import { tmpdir } from "node:os";

const executeFile = promisify(execFile);
const repositoryRoot = resolve(fileURLToPath(new URL("../../", import.meta.url)));
const mobileRoot = join(repositoryRoot, "apps", "mobile");
const appConfig = JSON.parse(await readFile(join(mobileRoot, "app.json"), "utf8"));
const expo = appConfig.expo;
const android = expo?.android;
const expectedPackage = "com.arcticrss.reader";
const dangerousPermissions = new Set([
  "android.permission.ACCESS_BACKGROUND_LOCATION",
  "android.permission.ACCESS_COARSE_LOCATION",
  "android.permission.ACCESS_FINE_LOCATION",
  "android.permission.ACTIVITY_RECOGNITION",
  "android.permission.BLUETOOTH_CONNECT",
  "android.permission.BLUETOOTH_SCAN",
  "android.permission.CALL_PHONE",
  "android.permission.CAMERA",
  "android.permission.POST_NOTIFICATIONS",
  "android.permission.READ_CALENDAR",
  "android.permission.READ_CONTACTS",
  "android.permission.READ_EXTERNAL_STORAGE",
  "android.permission.READ_MEDIA_AUDIO",
  "android.permission.READ_MEDIA_IMAGES",
  "android.permission.READ_MEDIA_VIDEO",
  "android.permission.READ_PHONE_STATE",
  "android.permission.RECEIVE_SMS",
  "android.permission.RECORD_AUDIO",
  "android.permission.SEND_SMS",
  "android.permission.SYSTEM_ALERT_WINDOW",
  "android.permission.WRITE_CALENDAR",
  "android.permission.WRITE_CONTACTS",
  "android.permission.WRITE_EXTERNAL_STORAGE",
]);

assert.equal(android?.package, expectedPackage, "The Android package must remain registered.");
assert.match(expo?.version ?? "", /^\d+\.\d+\.\d+$/, "The mobile version must be explicit SemVer.");
assert.ok(Number.isSafeInteger(android?.versionCode) && android.versionCode > 0, "The Android versionCode must be a positive integer.");
assert.equal(android?.allowBackup, false, "Android backups must be disabled for mobile account data.");
assert.ok(
  expo?.plugins?.includes("./plugins/with-no-cleartext.cjs"),
  "The managed Android configuration must apply the reviewed no-cleartext plugin.",
);
assert.ok(
  !(android?.permissions ?? []).some((permission) => dangerousPermissions.has(permission)),
  "The mobile source must not request unreviewed dangerous Android permissions.",
);

const expectedAppLinkPaths = new Set([
  "/articles",
  "/briefings",
  "/collections",
  "/mobile/auth/callback",
  "/podcast-episodes",
  "/saved-views",
]);
const appLinkPaths = new Set(
  (android?.intentFilters ?? [])
    .filter(
      (intentFilter) =>
        intentFilter.action === "VIEW" &&
        intentFilter.autoVerify === true &&
        intentFilter.category?.includes("BROWSABLE") &&
        intentFilter.category?.includes("DEFAULT"),
    )
    .flatMap((intentFilter) => intentFilter.data ?? [])
    .filter((entry) => entry.scheme === "https" && entry.host === "arcticrss.com")
    .map((entry) => entry.pathPrefix),
);
assert.deepEqual(appLinkPaths, expectedAppLinkPaths, "Android App Links must remain an exact reviewed route set.");
assert.ok(appLinkPaths.has("/mobile/auth/callback"), "The HTTPS authorization callback must remain an App Link.");

const secureStorePlugin = expo?.plugins?.find(
  (plugin) => Array.isArray(plugin) && plugin[0] === "expo-secure-store",
);
assert.equal(
  secureStorePlugin?.[1]?.configureAndroidBackup,
  true,
  "Expo SecureStore must retain its Android backup configuration.",
);

const configSource = await readFile(join(mobileRoot, "src", "config.ts"), "utf8");
assert.match(
  configSource,
  /if \(__DEV__ && !configuredMobileServiceOrigin\)/,
  "Development builds must require an explicit mobile service origin.",
);
assert.doesNotMatch(
  configSource,
  /EXPO_PUBLIC_ARCTIC_RSS_ORIGIN\?\.trim\(\) \|\| "https:\/\/arcticrss\.com"/,
  "Development builds must not silently fall back to the production origin.",
);
const mobileSources = await mobileSourceFiles();
assert.equal(
  mobileSources.some((file) => basename(file) === "assetlinks.json"),
  false,
  "Do not commit assetlinks.json or any signing fingerprint to mobile source.",
);
for (const sourcePath of mobileSources.filter((file) => /\.(?:cjs|json|ts|tsx)$/.test(file))) {
  assert.doesNotMatch(
    await readFile(sourcePath, "utf8"),
    /sha256_cert_fingerprints|signingConfigs\s*\.\s*debug/i,
    "Mobile source must not contain signing fingerprints or debug release signing.",
  );
}

await assertCleanGeneratedAndroidConfig();

async function assertCleanGeneratedAndroidConfig() {
  const temporaryRoot = await mkdtemp(join(tmpdir(), "arctic-rss-mobile-native-"));
  const temporaryMobileRoot = join(temporaryRoot, "mobile");
  try {
    await cp(mobileRoot, temporaryMobileRoot, {
      filter: (source) => !new Set([".expo", "android", "dist", "ios", "node_modules"]).has(basename(source)),
      recursive: true,
    });
    await symlink(
      join(repositoryRoot, "node_modules"),
      join(temporaryRoot, "node_modules"),
      process.platform === "win32" ? "junction" : "dir",
    );
    await executeFile(
      process.execPath,
      [
        join(repositoryRoot, "node_modules", "expo", "bin", "cli"),
        "prebuild",
        "--platform",
        "android",
        "--no-install",
        "--non-interactive",
      ],
      { cwd: temporaryMobileRoot, maxBuffer: 10 * 1024 * 1024 },
    );

    const androidRoot = join(temporaryMobileRoot, "android");
    const [manifest, appGradle, rootGradle, gradleProperties] = await Promise.all([
      readFile(join(androidRoot, "app", "src", "main", "AndroidManifest.xml"), "utf8"),
      readFile(join(androidRoot, "app", "build.gradle"), "utf8"),
      readFile(join(androidRoot, "build.gradle"), "utf8"),
      readFile(join(androidRoot, "gradle.properties"), "utf8"),
    ]);
    assert.match(appGradle, new RegExp(`namespace ["']${expectedPackage}["']`), "Generated Android namespace drifted.");
    assert.match(appGradle, new RegExp(`applicationId ["']${expectedPackage}["']`), "Generated Android application ID drifted.");
    assert.match(manifest, /android:allowBackup="false"/, "Generated manifest must disable backups.");
    assert.doesNotMatch(manifest, /android:usesCleartextTraffic="true"/, "Generated manifest must disable cleartext traffic.");
    const manifestPermissionTags = [...manifest.matchAll(/<uses-permission\b[^>]*>/g)];
    const unreviewedDangerousPermissions = manifestPermissionTags.filter((match) => {
      const permission = match[0].match(/android:name="([^"]+)"/)?.[1];
      return dangerousPermissions.has(permission) && !/tools:node="remove"/.test(match[0]);
    });
    const activePermissions = manifestPermissionTags
      .filter((match) => !/tools:node="remove"/.test(match[0]))
      .map((match) => match[0].match(/android:name="([^"]+)"/)?.[1])
      .filter(Boolean)
      .sort();
    console.log(`Generated Android active permissions: ${activePermissions.join(", ")}.`);
    assert.equal(
      unreviewedDangerousPermissions.length,
      0,
      "Generated manifest contains an unreviewed dangerous permission.",
    );
    const exportedComponents = [...manifest.matchAll(/<(activity|receiver|service)\b[^>]*android:exported="true"[^>]*>/g)]
      .map((match) => match[0].match(/android:name="([^"]+)"/)?.[1] ?? "unnamed")
      .sort();
    assert.deepEqual(
      exportedComponents,
      [".MainActivity"],
      "Generated Android manifest contains an unreviewed exported component.",
    );
    assert.doesNotMatch(
      appGradle,
      /release\s*\{[\s\S]{0,1_500}?signingConfig\s+signingConfigs\.debug/,
      "Generated release source must not use the debug signing configuration.",
    );
    const reactNativeVersions = await readFile(
      join(repositoryRoot, "node_modules", "react-native", "gradle", "libs.versions.toml"),
      "utf8",
    );
    const sdkSource = `${rootGradle}\n${gradleProperties}\n${reactNativeVersions}`;
    const compileSdk = sdkNumber(sdkSource, "compileSdk");
    const targetSdk = sdkNumber(sdkSource, "targetSdk");
    assert.ok(compileSdk >= 35, "Generated Android compile SDK must stay current.");
    assert.ok(targetSdk >= 35, "Generated Android target SDK must stay current.");
    console.log(
      `Mobile native configuration verified (version ${expo.version}, versionCode ${android.versionCode}, compileSdk ${compileSdk}, targetSdk ${targetSdk}).`,
    );
  } finally {
    await removeTemporaryRoot(temporaryRoot);
  }
}

async function removeTemporaryRoot(temporaryRoot) {
  let lastError;
  for (let attempt = 1; attempt <= 6; attempt += 1) {
    try {
      await rm(temporaryRoot, { force: true, maxRetries: 0, recursive: true });
      return;
    } catch (error) {
      lastError = error;
      if (attempt < 6 && (error?.code === "EBUSY" || error?.code === "EPERM")) {
        await new Promise((resolve) => setTimeout(resolve, attempt * 500));
        continue;
      }
      throw error;
    }
  }
  throw lastError;
}

async function mobileSourceFiles(directory = mobileRoot) {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if ([".expo", "dist", "node_modules"].includes(entry.name)) {
      continue;
    }
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await mobileSourceFiles(path)));
    } else {
      files.push(path);
    }
  }
  return files;
}

function sdkNumber(source, propertyName) {
  const match = source.match(
    new RegExp(
      `(?:android\\.)?${propertyName}\\s*=\\s*(?:Integer\\.parseInt\\([^\\n]*?:\\s*)?['"]?(\\d+)['"]?`,
      "m",
    ),
  );
  if (!match) {
    throw new Error(`Generated Android source does not expose ${propertyName}.`);
  }
  return Number(match[1]);
}
