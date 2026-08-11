import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";

import { componentPackageUrl, createMobileDependencyGraph } from "./mobile-dependency-graph.mjs";

const outputIndex = process.argv.indexOf("--output");
const outputPath = outputIndex === -1 ? "mobile-sbom.cdx.json" : process.argv[outputIndex + 1];
if (!outputPath || process.argv.length !== (outputIndex === -1 ? 2 : 4)) {
  throw new Error("Usage: node scripts/security/generate-mobile-sbom.mjs [--output path]");
}

const lockfileContents = await readFile("package-lock.json", "utf8");
const lockfile = JSON.parse(lockfileContents);
const graph = createMobileDependencyGraph(lockfile);
const components = graph
  .filter((component) => component.name && component.version)
  .map((component) => ({
    "bom-ref": `mobile:${component.lockPath}`,
    hashes: component.integrity
      ? [{ alg: "SHA-512", content: component.integrity.replace(/^sha512-/, "") }]
      : undefined,
    licenses: component.license ? [{ license: { name: component.license } }] : undefined,
    name: component.name,
    properties: [
      { name: "arctic-rss:lock-path", value: component.lockPath },
      { name: "arctic-rss:reachability", value: component.reachability },
      ...(component.resolved ? [{ name: "arctic-rss:resolved", value: component.resolved }] : []),
    ],
    purl: componentPackageUrl(component) ?? undefined,
    type: "library",
    version: component.version,
  }));
const serialHash = createHash("sha256").update(lockfileContents).digest("hex");
const bom = {
  "$schema": "https://cyclonedx.org/schema/bom-1.5.schema.json",
  bomFormat: "CycloneDX",
  components,
  metadata: {
    component: {
      name: "@arctic-rss/mobile",
      type: "application",
      version: lockfile.packages?.["apps/mobile"]?.version ?? "unknown",
    },
    properties: [
      { name: "arctic-rss:scope", value: "mobile JavaScript and native module dependency graph" },
      { name: "arctic-rss:signed-artifact", value: "false" },
    ],
    timestamp: new Date().toISOString(),
    tools: [{ vendor: "Arctic RSS", name: "generate-mobile-sbom.mjs" }],
  },
  serialNumber: `urn:uuid:${serialHash.slice(0, 8)}-${serialHash.slice(8, 12)}-4${serialHash.slice(13, 16)}-8${serialHash.slice(17, 20)}-${serialHash.slice(20, 32)}`,
  specVersion: "1.5",
  version: 1,
};

await writeFile(outputPath, `${JSON.stringify(bom, null, 2)}\n`);
console.log(`Mobile SBOM wrote ${components.length} components to ${outputPath}.`);
