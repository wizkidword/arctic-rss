import { describe, expect, it } from "vitest"

import {
  ALL_ROLE_ENVIRONMENT_VARIABLES,
  INFRASTRUCTURE_ENVIRONMENT_MANIFEST,
  SERVICE_ROLE_ENVIRONMENT_MANIFEST,
} from "./service-role-environment"

describe("service role environment manifest", () => {
  it("declares unique exact sets for every supported role and infrastructure service", () => {
    for (const [role, entry] of Object.entries(SERVICE_ROLE_ENVIRONMENT_MANIFEST)) {
      expect(new Set(entry.allowed).size, `${role} has duplicate allowed variables`).toBe(
        entry.allowed.length
      )
      expect(entry.required.every((name) => entry.allowed.includes(name))).toBe(true)
      expect(
        entry.runtimeOptionalViaCompatibility.every((name) => entry.required.includes(name))
      ).toBe(true)
    }

    expect(INFRASTRUCTURE_ENVIRONMENT_MANIFEST).toEqual({
      "edge-proxy": [],
      postgres: ["POSTGRES_DB", "POSTGRES_PASSWORD", "POSTGRES_USER"],
      redis: ["REDIS_PASSWORD"],
      "redis-ephemeral": ["REDIS_PASSWORD"],
    })
    expect(ALL_ROLE_ENVIRONMENT_VARIABLES).toContain("AUTH_SECRET")
    expect(ALL_ROLE_ENVIRONMENT_VARIABLES).not.toContain("MIGRATE_DATABASE_URL")
  })
})
