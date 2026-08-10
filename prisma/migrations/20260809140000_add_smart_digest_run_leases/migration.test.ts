import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const migrationPath = fileURLToPath(
  new URL("./migration.sql", import.meta.url),
);

describe("add smart digest run leases migration", () => {
  it("expands ownership fields and the run-to-digest boundary without a backfill", async () => {
    const migration = await readFile(migrationPath, "utf8");

    expect(migration).toContain(
      'ADD COLUMN "attempt" INTEGER NOT NULL DEFAULT 0',
    );
    expect(migration).toContain('ADD COLUMN "leaseOwner" TEXT');
    expect(migration).toContain('ADD COLUMN "leaseExpiresAt" TIMESTAMP(3)');
    expect(migration).toContain('ADD COLUMN "lastHeartbeatAt" TIMESTAMP(3)');
    expect(migration).toContain('ADD COLUMN "runId" TEXT');
    expect(migration).toContain('"SmartDigest_runId_key"');
    expect(migration).toContain('"DigestRun_status_leaseExpiresAt_idx"');
    expect(migration).toContain(
      'FOREIGN KEY ("runId") REFERENCES "DigestRun"("id")',
    );
    expect(migration).toContain("NOT VALID");
    expect(migration).not.toMatch(/^(?:\s)*(?:UPDATE|DELETE|DROP)\b/im);
  });
});
