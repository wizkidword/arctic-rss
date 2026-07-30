import { describe, expect, it } from "vitest"

import {
  AiPricingError,
  assertKnownAiPricing,
  requireApprovedOpenAiTextModel,
} from "./ai-costs"

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

  it("permits only GPT-5.4 Mini or Nano for OpenAI AI features", () => {
    expect(requireApprovedOpenAiTextModel("GPT-5.4-MINI")).toBe("gpt-5.4-mini")
    expect(requireApprovedOpenAiTextModel("gpt-5.4-nano")).toBe("gpt-5.4-nano")
    expect(() => requireApprovedOpenAiTextModel("gpt-5.5")).toThrow(AiPricingError)
  })
})
