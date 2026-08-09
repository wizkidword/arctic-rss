import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

const pinnedImage = (name: string) =>
  new RegExp(`${name}:[^\\s@]+@sha256:[a-f0-9]{64}`);

describe("production container image update policy", () => {
  it("uses immutable digests for every production image and the restore drill", async () => {
    const [dockerfile, compose, restoreDrill] = await Promise.all([
      readFile("Dockerfile", "utf8"),
      readFile("docker-compose.yml", "utf8"),
      readFile("scripts/production-restore-drill.sh", "utf8"),
    ]);

    expect(dockerfile).toMatch(pinnedImage("node"));
    expect(dockerfile).toMatch(pinnedImage("nginx"));
    expect(compose).toMatch(pinnedImage("postgres"));
    expect(compose.match(new RegExp(pinnedImage("redis"), "g"))).toHaveLength(2);
    expect(compose).toMatch(pinnedImage("cloudflare/cloudflared"));
    expect(restoreDrill).toMatch(pinnedImage("postgres"));
  });

  it("has a Docker update proposal path covered by container and Compose release gates", async () => {
    const [dependabot, ci] = await Promise.all([
      readFile(".github/dependabot.yml", "utf8"),
      readFile(".github/workflows/ci.yml", "utf8"),
    ]);

    expect(dependabot).toMatch(
      /package-ecosystem: docker\r?\n\s+directory: \/\r?\n\s+schedule:\r?\n\s+interval: weekly/,
    );
    expect(ci).toContain("docker build --target runner");
    expect(ci).toContain("Record production image sizes");
    expect(ci).toContain("aquasecurity/trivy-action@");
    expect(ci).toContain("anchore/sbom-action@");
    expect(ci).toContain("Compose-backed chat release gates");
  });
});
