import { describe, expect, it, vi } from "vitest"

import { createNativeSessionStore } from "./native-session-store"

vi.mock("expo-secure-store", () => ({
  deleteItemAsync: vi.fn(),
  getItemAsync: vi.fn(),
  setItemAsync: vi.fn(),
}))

describe("native session bundle store", () => {
  it("writes credentials as one validated v2 bundle", async () => {
    const adapter = createAdapter()
    const store = createNativeSessionStore(adapter)

    await store.write(tokens())

    expect(adapter.setItemAsync).toHaveBeenCalledTimes(1)
    expect(adapter.setItemAsync).toHaveBeenCalledWith(
      "arcticrss.mobile.token-bundle.v2",
      expect.stringContaining('"schemaVersion":2')
    )
    expect(adapter.data.get("arcticrss.mobile.token-bundle.v2")).toContain('"refreshToken":"refresh"')
  })

  it("keeps a prior bundle when replacement persistence fails", async () => {
    const adapter = createAdapter({
      "arcticrss.mobile.token-bundle.v2": JSON.stringify(tokens({ accessToken: "old" })),
    })
    adapter.setItemAsync.mockRejectedValueOnce(new Error("secure storage unavailable"))
    const store = createNativeSessionStore(adapter)

    await expect(store.write(tokens({ accessToken: "new" }))).rejects.toThrow("secure storage unavailable")
    await expect(store.read()).resolves.toMatchObject({ accessToken: "old", refreshToken: "refresh" })
  })

  it("clears a legacy bundle that lacks an authenticated owner and device", async () => {
    const adapter = createAdapter({
      "arcticrss.mobile.access-token.v1": "legacy-access",
      "arcticrss.mobile.access-expiry.v1": "70000",
      "arcticrss.mobile.refresh-token.v1": "legacy-refresh",
    })
    const store = createNativeSessionStore(adapter)

    await expect(store.read()).resolves.toBeNull()
    expect(adapter.data.has("arcticrss.mobile.token-bundle.v2")).toBe(false)
    expect(adapter.data.has("arcticrss.mobile.access-token.v1")).toBe(false)
  })

  it("rejects unknown bundle versions without returning account credentials", async () => {
    const adapter = createAdapter({
      "arcticrss.mobile.token-bundle.v2": JSON.stringify({ ...tokens(), schemaVersion: 99 }),
    })
    const store = createNativeSessionStore(adapter)

    await expect(store.read()).resolves.toBeNull()
    expect(adapter.data.has("arcticrss.mobile.token-bundle.v2")).toBe(false)
  })

  it("reports persistent deletion failure without restoring the deleted in-memory session", async () => {
    const adapter = createAdapter({
      "arcticrss.mobile.token-bundle.v2": JSON.stringify(tokens()),
    })
    adapter.deleteItemAsync.mockRejectedValueOnce(new Error("secure storage unavailable"))
    const store = createNativeSessionStore(adapter)

    await expect(store.clear()).rejects.toThrow("secure storage unavailable")
    expect(adapter.deleteItemAsync).toHaveBeenCalled()
  })
})

function createAdapter(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial))
  return {
    data,
    deleteItemAsync: vi.fn(async (key: string) => {
      data.delete(key)
    }),
    getItemAsync: vi.fn(async (key: string) => data.get(key) ?? null),
    setItemAsync: vi.fn(async (key: string, value: string) => {
      data.set(key, value)
    }),
  }
}

function tokens(overrides: Partial<{ accessToken: string; refreshToken: string }> = {}) {
  return {
    accessToken: "access",
    accessTokenExpiresAt: 70_000,
    accessTokenExpiresIn: 60,
    mobileDeviceId: "device_1",
    refreshToken: "refresh",
    schemaVersion: 2 as const,
    userId: "user_1",
    ...overrides,
  }
}
