import { describe, expect, it } from "vitest"

import {
  getArticleSearchBenchmarkConfig,
  summarizeLatencySamples,
} from "./measure-article-search"

const disposableEnvironment = {
  ARCTIC_RSS_SEARCH_BENCHMARK_CONFIRM: "disposable",
  DATABASE_URL: "postgresql://benchmark:password@127.0.0.1:55439/arctic_rss",
}

describe("article search benchmark guardrails", () => {
  it("requires an explicit disposable loopback database confirmation", () => {
    expect(() => getArticleSearchBenchmarkConfig({})).toThrow("CONFIRM=disposable")
    expect(() =>
      getArticleSearchBenchmarkConfig({
        ...disposableEnvironment,
        DATABASE_URL: "postgresql://benchmark:password@database.example.test/arctic_rss",
      })
    ).toThrow("loopback")
    expect(() =>
      getArticleSearchBenchmarkConfig({ ...disposableEnvironment, NODE_ENV: "production" })
    ).toThrow("NODE_ENV=production")
  })

  it("uses bounded defaults and summarizes deterministic latency percentiles", () => {
    expect(getArticleSearchBenchmarkConfig(disposableEnvironment)).toMatchObject({
      articleCount: 30_000,
      maxP95Ms: 350,
      sampleCount: 15,
      vectorMode: "stored",
    })
    expect(summarizeLatencySamples([20, 10, 40, 30])).toEqual({
      p50Ms: 20,
      p95Ms: 40,
      samples: 4,
    })
  })
})
