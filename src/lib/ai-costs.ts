type TokenPricing = {
  inputPerMillion: number
  outputPerMillion: number
}

export class AiPricingError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "AiPricingError"
  }
}

const OPENAI_STANDARD_TEXT_PRICING: Record<string, TokenPricing> = {
  "gpt-5.4": {
    inputPerMillion: 2.5,
    outputPerMillion: 15,
  },
  "gpt-5.4-mini": {
    inputPerMillion: 0.75,
    outputPerMillion: 4.5,
  },
  "gpt-5.4-nano": {
    inputPerMillion: 0.2,
    outputPerMillion: 1.25,
  },
  "gpt-5.5": {
    inputPerMillion: 5,
    outputPerMillion: 30,
  },
}

export function estimateAiUsageCost({
  inputTokens,
  model,
  outputTokens,
  provider,
}: {
  inputTokens: number
  model: string
  outputTokens: number
  provider: string
}): number | null {
  if (provider.toLowerCase() !== "openai") {
    return 0
  }

  const pricing = getAiTokenPricing({ model, provider })

  if (!pricing) {
    return null
  }

  const inputCost =
    (Math.max(0, inputTokens) / 1_000_000) * pricing.inputPerMillion
  const outputCost =
    (Math.max(0, outputTokens) / 1_000_000) * pricing.outputPerMillion

  return roundCost(inputCost + outputCost)
}

/**
 * External providers must have an explicit pricing entry before we send a
 * request. A missing price is a configuration error, not a free request.
 */
export function assertKnownAiPricing({
  model,
  provider,
}: {
  model: string
  provider: string
}) {
  if (provider.trim().toLowerCase() !== "openai") {
    return
  }

  if (!getAiTokenPricing({ model, provider })) {
    throw new AiPricingError(
      `No validated price is configured for OpenAI model ${model.trim() || "(empty)"}.`,
    )
  }
}

export function getAiTokenPricing({
  model,
  provider,
}: {
  model: string
  provider: string
}) {
  if (provider.trim().toLowerCase() !== "openai") {
    return null
  }

  return OPENAI_STANDARD_TEXT_PRICING[model.trim().toLowerCase()] ?? null
}

function roundCost(value: number): number {
  return Number(value.toFixed(6))
}
