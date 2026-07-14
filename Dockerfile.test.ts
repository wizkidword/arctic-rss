import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

describe("production Docker images", () => {
  it("removes npm and npx after build-time tooling has finished", async () => {
    const dockerfile = await readFile("Dockerfile", "utf8");

    expect(dockerfile).toContain("FROM deps AS migrate");
    expect(dockerfile).toContain(
      "rm -rf /usr/local/lib/node_modules/npm /usr/local/bin/npm /usr/local/bin/npx",
    );
    expect(dockerfile).toContain(
      'CMD ["./node_modules/.bin/prisma", "migrate", "deploy"]',
    );
    expect(dockerfile).toContain("USER migrate");
    expect(dockerfile).toContain(
      'CMD ["./node_modules/.bin/tsx", "worker/index.ts"]',
    );
    expect(dockerfile).toContain("FROM deps AS chat-gateway");
    expect(dockerfile).toContain(
      'CMD ["./node_modules/.bin/tsx", "services/chat-gateway/index.ts"]',
    );
    expect(dockerfile).toContain("USER chatgateway");
  });
});
