type TokenPricing = {
  inputPerMillion: number
  outputPerMillion: number
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

  const pricing = OPENAI_STANDARD_TEXT_PRICING[model.trim().toLowerCase()]

  if (!pricing) {
    return null
  }

  const inputCost = (Math.max(0, inputTokens) / 1_000_000) * pricing.inputPerMillion
  const outputCost =
    (Math.max(0, outputTokens) / 1_000_000) * pricing.outputPerMillion

  return roundCost(inputCost + outputCost)
}

function roundCost(value: number): number {
  return Number(value.toFixed(6))
}
