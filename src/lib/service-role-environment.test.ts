import { describe, expect, it } from "vitest"

import {
  ALL_MANAGED_ENVIRONMENT_VARIABLES,
  ALL_ROLE_ENVIRONMENT_VARIABLES,
  findUnexpectedManagedServiceRoleEnvironmentVariables,
  getRuntimeAllowedServiceRoleEnvironment,
  INFRASTRUCTURE_ENVIRONMENT_MANIFEST,
  MANAGED_ENVIRONMENT_ALIASES,
  RUNTIME_COMPATIBILITY_ALIASES,
  SERVICE_ROLE_ENVIRONMENT_MANIFEST,
  type ServiceEnvironmentRole,
} from "./service-role-environment"

describe("service role environment manifest", () => {
  it("declares unique exact sets for every supported role and infrastructure service", () => {
    for (const role of Object.keys(
      SERVICE_ROLE_ENVIRONMENT_MANIFEST
    ) as ServiceEnvironmentRole[]) {
      const entry = SERVICE_ROLE_ENVIRONMENT_MANIFEST[role]
      expect(new Set(entry.allowed).size, `${role} has duplicate allowed variables`).toBe(
        entry.allowed.length
      )
      expect(entry.required.every((name) => entry.allowed.includes(name))).toBe(true)
      expect(
        entry.runtimeOptionalViaCompatibility.every((name) => entry.required.includes(name))
      ).toBe(true)
      expect(new Set(RUNTIME_COMPATIBILITY_ALIASES[role]).size).toBe(
        RUNTIME_COMPATIBILITY_ALIASES[role].length
      )
    }

    expect(new Set(MANAGED_ENVIRONMENT_ALIASES).size).toBe(
      MANAGED_ENVIRONMENT_ALIASES.length
    )

    expect(INFRASTRUCTURE_ENVIRONMENT_MANIFEST).toEqual({
      "edge-proxy": [],
      postgres: ["POSTGRES_DB", "POSTGRES_PASSWORD", "POSTGRES_USER"],
      redis: ["REDIS_PASSWORD"],
      "redis-ephemeral": ["REDIS_PASSWORD"],
    })
    expect(ALL_ROLE_ENVIRONMENT_VARIABLES).toContain("AUTH_SECRET")
    expect(ALL_ROLE_ENVIRONMENT_VARIABLES).not.toContain("MIGRATE_DATABASE_URL")
    expect(ALL_MANAGED_ENVIRONMENT_VARIABLES).toContain("MIGRATE_DATABASE_URL")
    expect(ALL_MANAGED_ENVIRONMENT_VARIABLES).toContain("TUNNEL_TOKEN")
    expect(MANAGED_ENVIRONMENT_ALIASES).toContain("CLOUDFLARE_TUNNEL_TOKEN")
  })

  it("uses the manifest registry to allow declared variables and reject every other managed variable", () => {
    for (const role of Object.keys(
      SERVICE_ROLE_ENVIRONMENT_MANIFEST
    ) as ServiceEnvironmentRole[]) {
      const allowed = getRuntimeAllowedServiceRoleEnvironment(role)
      const unexpected = ALL_MANAGED_ENVIRONMENT_VARIABLES.filter(
        (variable) => !allowed.includes(variable)
      )

      expect(
        findUnexpectedManagedServiceRoleEnvironmentVariables(
          Object.fromEntries(allowed.map((variable) => [variable, "configured"])),
          role
        )
      ).toEqual([])
      expect(
        findUnexpectedManagedServiceRoleEnvironmentVariables(
          Object.fromEntries(unexpected.map((variable) => [variable, "injected"])),
          role
        )
      ).toEqual(unexpected)
    }
  })

  it("does not classify ordinary process variables as managed application configuration", () => {
    expect(
      findUnexpectedManagedServiceRoleEnvironmentVariables(
        { HOME: "/home/runtime", NODE_VERSION: "24.17.0", PATH: "/usr/bin" },
        "web"
      )
    ).toEqual([])
  })
})
