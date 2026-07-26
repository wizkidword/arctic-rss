import { readFile } from "node:fs/promises";
import { gunzipSync } from "node:zlib";

const HIGH_OR_CRITICAL = new Set(["high", "critical"]);
const ADVISORY_ENDPOINT =
  "https://registry.npmjs.org/-/npm/v1/security/advisories/bulk";
const MAX_ATTEMPTS = 3;

function packageNameFromLockPath(lockPath) {
  const nodeModulesIndex = lockPath.lastIndexOf("node_modules/");
  if (nodeModulesIndex === -1) {
    return null;
  }

  const packagePath = lockPath.slice(nodeModulesIndex + "node_modules/".length);
  const segments = packagePath.split("/");

  if (segments[0]?.startsWith("@")) {
    return segments.length >= 2 ? `${segments[0]}/${segments[1]}` : null;
  }

  return segments[0] || null;
}

function createProductionPayload(packages) {
  const versionsByPackage = new Map();

  for (const [lockPath, metadata] of Object.entries(packages)) {
    if (
      !lockPath ||
      metadata.dev === true ||
      typeof metadata.version !== "string"
    ) {
      continue;
    }

    const packageName = packageNameFromLockPath(lockPath);
    if (!packageName) {
      continue;
    }

    const versions = versionsByPackage.get(packageName) ?? new Set();
    versions.add(metadata.version);
    versionsByPackage.set(packageName, versions);
  }

  return Object.fromEntries(
    [...versionsByPackage.entries()]
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([packageName, versions]) => [packageName, [...versions].sort()]),
  );
}

async function requestAdvisories(payload) {
  let lastError;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    try {
      const response = await fetch(ADVISORY_ENDPOINT, {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(`npm advisory API returned HTTP ${response.status}`);
      }

      const responseBytes = Buffer.from(await response.arrayBuffer());
      const responseBody =
        responseBytes[0] === 0x1f && responseBytes[1] === 0x8b
          ? gunzipSync(responseBytes)
          : responseBytes;

      return JSON.parse(responseBody.toString("utf8"));
    } catch (error) {
      lastError = error;

      if (attempt < MAX_ATTEMPTS) {
        const delayMilliseconds = attempt * 5_000;
        console.warn(
          `npm advisory request failed (attempt ${attempt}/${MAX_ATTEMPTS}); retrying in ${delayMilliseconds / 1_000}s.`,
        );
        await new Promise((resolve) => setTimeout(resolve, delayMilliseconds));
      }
    }
  }

  throw lastError;
}

const lockfile = JSON.parse(await readFile("package-lock.json", "utf8"));
const payload = createProductionPayload(lockfile.packages ?? {});
const advisoriesByPackage = await requestAdvisories(payload);
const findings = Object.entries(advisoriesByPackage).flatMap(
  ([packageName, advisories]) =>
    advisories
      .filter((advisory) => HIGH_OR_CRITICAL.has(advisory.severity))
      .map((advisory) => ({ packageName, advisory })),
);

if (findings.length > 0) {
  console.error(
    "High or critical production dependency vulnerabilities found:",
  );

  for (const { packageName, advisory } of findings) {
    console.error(
      `- ${packageName}: [${advisory.severity}] ${advisory.title} (${advisory.url})`,
    );
  }

  process.exit(1);
}

console.log(
  `Production dependency advisory check passed for ${Object.keys(payload).length} package names.`,
);
