import { describe, expect, it } from "vitest"

import { AiPricingError, assertKnownAiPricing } from "./ai-costs"

describe("AI pricing validation", () => {
  it("fails closed before an unknown external model can be used", () => {
    expect(() =>
      assertKnownAiPricing({
        model: "unpriced-model",
        provider: "openai",
      }),
    ).toThrow(AiPricingError)
  })

  it("does not require an external price entry for the local provider", () => {
    expect(() =>
      assertKnownAiPricing({
        model: "local-extractive-v1",
        provider: "local",
      }),
    ).not.toThrow()
  })
})
