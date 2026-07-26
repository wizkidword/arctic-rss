import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

describe("migration runtime package", () => {
  it("locks the migration CLI to the application Prisma version", async () => {
    const packageJson = JSON.parse(
      await readFile("docker/migrate/package.json", "utf8"),
    ) as { dependencies: { prisma: string } };

    expect(packageJson.dependencies.prisma).toBe("7.8.0");
  });

  it("does not include the vulnerable brace-expansion dependency", async () => {
    const packageLock = JSON.parse(
      await readFile("docker/migrate/package-lock.json", "utf8"),
    ) as { packages: Record<string, { version?: string }> };

    expect(
      Object.keys(packageLock.packages).filter((path) =>
        path.endsWith("/brace-expansion"),
      ),
    ).toEqual([]);
  });
});
