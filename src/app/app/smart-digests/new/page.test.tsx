import { renderToStaticMarkup } from "react-dom/server"
import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  listSmartDigestSourceOptions: vi.fn(),
  redirect: vi.fn((path: string) => {
    throw new Error(`REDIRECT:${path}`)
  }),
}))

vi.mock("next/link", () => ({
  default: ({
    children,
    href,
    ...props
  }: React.ComponentProps<"a"> & { href: string }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}))

vi.mock("next/navigation", () => ({
  redirect: mocks.redirect,
}))

vi.mock("@/auth", () => ({
  auth: mocks.auth,
}))

vi.mock("@/app/app/smart-digests/actions", () => ({
  createSmartDigestRuleAction: vi.fn(),
}))

vi.mock("@/components/ui/button", () => ({
  Button: ({
    children,
    ...props
  }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button {...props}>{children}</button>
  ),
  buttonVariants: () => "button",
}))

vi.mock("@/lib/smart-digests", () => ({
  listSmartDigestSourceOptions: mocks.listSmartDigestSourceOptions,
}))

import NewSmartDigestPage from "./page"

describe("NewSmartDigestPage", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.auth.mockResolvedValue({
      user: {
        id: "user-1",
      },
    })
    mocks.listSmartDigestSourceOptions.mockResolvedValue({
      folders: [{ id: "folder-1", name: "World News" }],
      subscriptions: [
        {
          faviconUrl: null,
          folderId: "folder-1",
          folderName: "World News",
          id: "subscription-1",
          title: "Reuters",
        },
      ],
    })
  })

  it("renders the create form fields for a signed-in reader", async () => {
    const markup = renderToStaticMarkup(await NewSmartDigestPage())

    expect(mocks.listSmartDigestSourceOptions).toHaveBeenCalledWith("user-1")
    expect(markup).toContain("Create Smart Digest")
    expect(markup).toContain("Include terms")
    expect(markup).toContain("Selected feeds")
    expect(markup).toContain("Reuters")
  })
})
