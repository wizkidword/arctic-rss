import { renderToStaticMarkup } from "react-dom/server"
import { beforeEach, describe, expect, it, vi } from "vitest"

const {
  parseAdminDashboardFilters,
  redirect,
  requireAuthenticatedUser,
  requireFreshAdmin,
} = vi.hoisted(() => ({
    parseAdminDashboardFilters: vi.fn(),
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
  parseAdminDashboardFilters,
}))

vi.mock("next/navigation", () => ({
  redirect,
}))

vi.mock("@/components/admin-dashboard", () => ({
  AdminDashboard: ({
    filters,
  }: {
    filters: { from: string; to: string }
  }) => (
    <div>
      Operational dashboard {filters.from} through {filters.to}
    </div>
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
    expect(parseAdminDashboardFilters).not.toHaveBeenCalled()
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
    expect(parseAdminDashboardFilters).not.toHaveBeenCalled()
  })

  it("loads independently streamed panels only after fresh-admin validation", async () => {
    requireAuthenticatedUser.mockResolvedValue({
      user: {
        id: "admin-1",
        role: "ADMIN",
      },
    })
    requireFreshAdmin.mockResolvedValue({ id: "admin-1" })
    const filters = {
      from: "2026-06-01",
      to: "2026-06-24",
    }
    parseAdminDashboardFilters.mockReturnValue(filters)

    const markup = renderToStaticMarkup(
      await AdminPage({
        searchParams: Promise.resolve({ from: "2026-06-01", to: "2026-06-24" }),
      })
    )

    expect(markup).toContain("Operational dashboard")
    expect(markup).toContain("2026-06-01 through 2026-06-24")
    expect(parseAdminDashboardFilters).toHaveBeenCalledWith({
      from: "2026-06-01",
      to: "2026-06-24",
    })
  })
})
