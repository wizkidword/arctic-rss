import { readFile, writeFile } from "node:fs/promises";
import { gunzipSync } from "node:zlib";

import {
  createMobileAdvisoryPayload,
  createMobileDependencyGraph,
} from "./mobile-dependency-graph.mjs";

const HIGH_OR_CRITICAL = new Set(["high", "critical"]);
const ADVISORY_ENDPOINT = "https://registry.npmjs.org/-/npm/v1/security/advisories/bulk";
const MAX_ATTEMPTS = 3;
const outputPath = optionValue("--output");
const exceptionsPath = "docs/security/mobile-dependency-exceptions.json";

function optionValue(name) {
  const index = process.argv.indexOf(name);
  if (index === -1) {
    return null;
  }
  const value = process.argv[index + 1];
  if (!value || value.startsWith("--") || process.argv.indexOf(name, index + 1) !== -1) {
    throw new Error(`${name} requires exactly one path value.`);
  }
  return value;
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
          `Mobile advisory request failed (attempt ${attempt}/${MAX_ATTEMPTS}); retrying in ${delayMilliseconds / 1_000}s.`,
        );
        await new Promise((resolve) => setTimeout(resolve, delayMilliseconds));
      }
    }
  }
  throw lastError;
}

function assertExceptions(exceptions) {
  if (exceptions?.schemaVersion !== 1 || !Array.isArray(exceptions.exceptions)) {
    throw new Error(`${exceptionsPath} must contain schemaVersion 1 and an exceptions array.`);
  }
  for (const exception of exceptions.exceptions) {
    const requiredStrings = [
      "advisoryId",
      "advisoryUrl",
      "decision",
      "decisionOwner",
      "expiresAt",
      "fixedVersion",
      "installedVersion",
      "package",
      "reachability",
      "severity",
    ];
    for (const field of requiredStrings) {
      if (typeof exception[field] !== "string" || exception[field].trim().length === 0) {
        throw new Error(`Mobile dependency exception is missing ${field}.`);
      }
    }
    if (typeof exception.breakingChange !== "boolean") {
      throw new Error("Mobile dependency exception must state whether the fix is breaking.");
    }
    if (!/^(runtime|build)$/.test(exception.reachability)) {
      throw new Error("Mobile dependency exception reachability must be runtime or build.");
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(exception.expiresAt) || Number.isNaN(Date.parse(`${exception.expiresAt}T00:00:00Z`))) {
      throw new Error("Mobile dependency exception expiry must be an ISO calendar date.");
    }
    if (Date.parse(`${exception.expiresAt}T23:59:59Z`) < Date.now()) {
      throw new Error(`Mobile dependency exception for ${exception.package} expired on ${exception.expiresAt}.`);
    }
  }
}

function advisoryEntries(graph, advisoriesByPackage, exceptions) {
  const entries = [];
  const usedExceptions = new Set();
  const componentsByPackageVersion = new Map();
  for (const component of graph) {
    if (!component.name || !component.version) {
      continue;
    }
    const key = `${component.name}@${component.version}`;
    const existing = componentsByPackageVersion.get(key);
    componentsByPackageVersion.set(key, {
      ...component,
      reachability:
        existing?.reachability === "runtime" || component.reachability === "runtime"
          ? "runtime"
          : "build",
    });
  }
  for (const component of componentsByPackageVersion.values()) {
    for (const advisory of advisoriesByPackage[component.name] ?? []) {
      const exception = exceptions.exceptions.find(
        (candidate) =>
          candidate.package === component.name &&
          candidate.installedVersion === component.version &&
          (candidate.advisoryId === String(advisory.id) || candidate.advisoryUrl === advisory.url),
      );
      if (exception) {
        if (exception.reachability !== component.reachability || exception.severity !== advisory.severity) {
          throw new Error(`Mobile dependency exception metadata drifted for ${component.name}@${component.version}.`);
        }
        usedExceptions.add(exception);
      }
      entries.push({
        advisory: {
          id: String(advisory.id),
          title: advisory.title,
          url: advisory.url,
          vulnerableVersions: advisory.vulnerable_versions,
        },
        breakingChange: exception?.breakingChange ?? null,
        decision: exception?.decision ?? "unreviewed",
        decisionOwner: exception?.decisionOwner ?? null,
        expiresAt: exception?.expiresAt ?? null,
        fixedVersion: exception?.fixedVersion ?? advisory.patched_versions ?? "unknown",
        installedVersion: component.version,
        package: component.name,
        reachability: component.reachability,
        severity: advisory.severity,
      });
    }
  }
  const staleException = exceptions.exceptions.find((exception) => !usedExceptions.has(exception));
  if (staleException) {
    throw new Error(`Mobile dependency exception for ${staleException.package} no longer matches the installed graph.`);
  }
  return entries.sort((left, right) =>
    `${left.package}@${left.installedVersion}:${left.advisory.id}`.localeCompare(
      `${right.package}@${right.installedVersion}:${right.advisory.id}`,
    ),
  );
}

const [lockfile, exceptions] = await Promise.all([
  readFile("package-lock.json", "utf8").then(JSON.parse),
  readFile(exceptionsPath, "utf8").then(JSON.parse),
]);
assertExceptions(exceptions);
const graph = createMobileDependencyGraph(lockfile);
const payload = createMobileAdvisoryPayload(graph);
const advisoriesByPackage = await requestAdvisories(payload);
const findings = advisoryEntries(graph, advisoriesByPackage, exceptions);
const report = {
  generatedAt: new Date().toISOString(),
  graphPackageCount: Object.keys(payload).length,
  schemaVersion: 1,
  findings,
};

if (outputPath) {
  await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`);
}

const unreviewedHighOrCritical = findings.filter(
  (finding) => HIGH_OR_CRITICAL.has(finding.severity) && finding.decision === "unreviewed",
);
if (unreviewedHighOrCritical.length > 0) {
  console.error("Unreviewed high or critical mobile dependency advisories found:");
  for (const finding of unreviewedHighOrCritical) {
    console.error(
      `- ${finding.package}@${finding.installedVersion}: [${finding.severity}] ${finding.advisory.title} (${finding.advisory.url})`,
    );
  }
  process.exit(1);
}

console.log(
  `Mobile dependency advisory check passed for ${Object.keys(payload).length} package names; ${findings.length} advisories recorded.`,
);
