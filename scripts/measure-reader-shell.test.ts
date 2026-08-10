import { describe, expect, it } from "vitest"

import { getReaderShellBenchmarkConfig } from "./measure-reader-shell"

const disposableEnvironment = {
  ARCTIC_RSS_SHELL_BENCHMARK_CONFIRM: "disposable",
  DATABASE_URL: "postgresql://benchmark:password@127.0.0.1:55440/arctic_rss",
}

describe("reader shell benchmark guardrails", () => {
  it("requires an explicit disposable loopback database confirmation", () => {
    expect(() => getReaderShellBenchmarkConfig({})).toThrow("CONFIRM=disposable")
    expect(() => getReaderShellBenchmarkConfig({
      ...disposableEnvironment,
      DATABASE_URL: "postgresql://benchmark:password@database.example.test/arctic_rss",
    })).toThrow("loopback")
  })

  it("uses a bounded local server port", () => {
    expect(getReaderShellBenchmarkConfig(disposableEnvironment)).toEqual({
      databaseUrl: disposableEnvironment.DATABASE_URL,
      port: 3107,
    })
    expect(() => getReaderShellBenchmarkConfig({
      ...disposableEnvironment,
      ARCTIC_RSS_SHELL_BENCHMARK_PORT: "80",
    })).toThrow("between 1024 and 65535")
  })
})
