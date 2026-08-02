import { describe, expect, it } from "vitest"

import { describeRedisSeparation, DOCTOR_REQUIRED_VARIABLES } from "./doctor"

describe("doctor report helpers", () => {
  it("reports configuration presence by name without returning secret values", () => {
    expect(DOCTOR_REQUIRED_VARIABLES.web).toContain("AUTH_SECRET")
    expect(DOCTOR_REQUIRED_VARIABLES["worker-ingestion"]).toEqual([
      "DATABASE_URL",
      "DURABLE_REDIS_URL",
    ])
  })

  it("compares Redis endpoints without exposing credentials", () => {
    expect(
      describeRedisSeparation({
        DURABLE_REDIS_URL: "redis://:durable-secret@redis:6379/0",
        EPHEMERAL_REDIS_URL: "redis://:ephemeral-secret@redis-ephemeral:6379/0",
      })
    ).toBe("distinct")
    expect(
      describeRedisSeparation({
        DURABLE_REDIS_URL: "redis://:durable-secret@REDIS:6379/0",
        EPHEMERAL_REDIS_URL: "redis://:ephemeral-secret@redis/",
      })
    ).toBe("shared")
  })
})
