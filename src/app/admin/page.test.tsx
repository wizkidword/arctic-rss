import { renderToStaticMarkup } from "react-dom/server"
import { beforeEach, describe, expect, it, vi } from "vitest"

const {
  getAdminDashboard,
  inspectAdminQueues,
  listDiscoverCategoryEditorOptions,
  redirect,
  requireAuthenticatedUser,
  requireFreshAdmin,
} = vi.hoisted(() => ({
    getAdminDashboard: vi.fn(),
    listDiscoverCategoryEditorOptions: vi.fn(),
    inspectAdminQueues: vi.fn(),
    redirect: vi.fn((path: string) => {
      throw new Error(`REDIRECT:${path}`)
    }),
    requireAuthenticatedUser: vi.fn(),
    requireFreshAdmin: vi.fn(),
  }))

vi.mock("@/lib/authorization", () => ({
  requireAuthenticatedUser,
  requireFreshAdmin,
}))

vi.mock("@/lib/admin-dashboard", () => ({
  getAdminDashboard,
}))

vi.mock("@/lib/admin-queues", () => ({
  inspectAdminQueues,
}))

vi.mock("@/lib/discover-category-customizations", () => ({
  listDiscoverCategoryEditorOptions,
}))

vi.mock("next/navigation", () => ({
  redirect,
}))

vi.mock("@/components/admin-dashboard", () => ({
  AdminDashboard: ({
    discoverCategories,
  }: {
    discoverCategories: Array<{ id: string; label: string }>
  }) => (
    <div>
      Operational dashboard {discoverCategories.map((category) => category.label).join(", ")}
    </div>
  ),
}))

vi.mock("@/components/ui/card", () => ({
  Card: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CardContent: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  CardDescription: ({ children }: { children: React.ReactNode }) => (
    <p>{children}</p>
  ),
  CardHeader: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  CardTitle: ({ children }: { children: React.ReactNode }) => (
    <h1>{children}</h1>
  ),
}))

import AdminPage from "./page"

describe("admin page", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("redirects anonymous visitors to login", async () => {
    requireAuthenticatedUser.mockResolvedValue(null)

    await expect(AdminPage()).rejects.toThrow("REDIRECT:/login")
    expect(getAdminDashboard).not.toHaveBeenCalled()
  })

  it("redirects non-admin users to the reader", async () => {
    requireAuthenticatedUser.mockResolvedValue({
      user: {
        id: "user-1",
        role: "USER",
      },
    })
    requireFreshAdmin.mockResolvedValue(null)

    await expect(AdminPage()).rejects.toThrow("REDIRECT:/app")
    expect(getAdminDashboard).not.toHaveBeenCalled()
  })

  it("loads database and queue operations for administrators", async () => {
    requireAuthenticatedUser.mockResolvedValue({
      user: {
        id: "admin-1",
        role: "ADMIN",
      },
    })
    requireFreshAdmin.mockResolvedValue({ id: "admin-1" })
    getAdminDashboard.mockResolvedValue({
      generatedAt: new Date("2026-06-24T08:15:00.000Z"),
    })
    inspectAdminQueues.mockResolvedValue({
      available: true,
      failedJobs: [],
      queues: [],
    })
    listDiscoverCategoryEditorOptions.mockResolvedValue([
      {
        description: "National and world reporting.",
        iconKey: "general",
        id: "us-general",
        label: "US General",
      },
    ])

    const markup = renderToStaticMarkup(await AdminPage())

    expect(markup).toContain("Operational dashboard")
    expect(markup).toContain("US General")
    expect(getAdminDashboard).toHaveBeenCalledWith({
      isAdmin: true,
    })
    expect(inspectAdminQueues).toHaveBeenCalledOnce()
    expect(listDiscoverCategoryEditorOptions).toHaveBeenCalledOnce()
  })
})
