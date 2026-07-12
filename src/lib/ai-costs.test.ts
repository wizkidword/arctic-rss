import { describe, expect, it } from "vitest"

import { estimateAiUsageCost } from "./ai-costs"

describe("AI usage costs", () => {
  it("estimates standard OpenAI gpt-5.4-nano text costs from input and output tokens", () => {
    expect(
      estimateAiUsageCost({
        inputTokens: 1_000,
        model: "gpt-5.4-nano",
        outputTokens: 200,
        provider: "openai",
      })
    ).toBe(0.00045)
  })

  it("keeps local provider usage free", () => {
    expect(
      estimateAiUsageCost({
        inputTokens: 1_000,
        model: "local-extractive-v1",
        outputTokens: 200,
        provider: "local",
      })
    ).toBe(0)
  })
})
