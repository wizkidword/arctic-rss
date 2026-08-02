import { describe, expect, it } from "vitest"

import {
  assertRuntimeTopology,
  getRuntimeTopology,
  RuntimeTopologyConfigurationError,
} from "./runtime-topology"

describe("runtime topology", () => {
  it("defaults local development to the all-in-one topology", () => {
    expect(getRuntimeTopology({})).toMatchObject({
      chatEnabled: false,
      name: "all-in-one",
      workerModes: ["all"],
    })
  })

  it("maps the selected split chat topology to its required worker modes", () => {
    expect(
      getRuntimeTopology({ ARCTIC_RSS_TOPOLOGY: "split-with-chat" })
    ).toMatchObject({
      chatEnabled: true,
      name: "split-with-chat",
      workerModes: ["ingestion", "ai-mail", "imports", "maintenance", "chat-events"],
    })
  })

  it("requires an explicit topology in production", () => {
    expect(() => assertRuntimeTopology({ NODE_ENV: "production" })).toThrow(
      RuntimeTopologyConfigurationError
    )
    expect(() =>
      getRuntimeTopology({ ARCTIC_RSS_TOPOLOGY: "everything" })
    ).toThrow("ARCTIC_RSS_TOPOLOGY must be one of")
  })
})
