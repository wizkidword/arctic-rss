// @vitest-environment jsdom

import {
  act,
  cleanup,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const { subscribeDirectoryFeedAction } = vi.hoisted(() => ({
  subscribeDirectoryFeedAction: vi.fn(),
}))

vi.mock("@/app/app/actions", () => ({
  subscribeDirectoryFeedAction,
}))

import {
  FeedDirectorySubscribeButton,
} from "./feed-directory-subscribe-button"

const folders = [
  { id: "morning-news", name: "Morning News" },
  { id: "research", name: "Research" },
]

function createDeferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise
  })

  return { promise, resolve }
}

function getPersistentAnnouncement() {
  const dialogs = Array.from(
    document.querySelectorAll('[role="dialog"], [role="alertdialog"]')
  )

  return (
    Array.from(
      document.querySelectorAll<HTMLElement>(
        '[aria-live="polite"][aria-atomic="true"]'
      )
    ).find(
      (region) => !dialogs.some((dialog) => dialog.contains(region))
    ) ?? null
  )
}

function getPoliteLiveRegions() {
  return Array.from(
    document.querySelectorAll<HTMLElement>('[aria-live="polite"]')
  )
}

afterEach(() => {
  cleanup()
})

beforeEach(() => {
  subscribeDirectoryFeedAction.mockReset()
})

describe("FeedDirectorySubscribeDialogContent", () => {
  it("names the feed and defaults the folder picker to Uncategorized", async () => {
    const user = userEvent.setup()
    render(
      <FeedDirectorySubscribeButton
        feedId="npr-national"
        feedLabel="NPR - National"
        folders={folders}
        subscribed={false}
      />
    )

    await user.click(
      screen.getByRole("button", {
        name: /Subscribe.*NPR - National/,
      })
    )

    expect(
      screen.getByRole("heading", { name: "Subscribe to NPR - National" })
    ).toBeTruthy()

    const hiddenFeedId = document.querySelector<HTMLInputElement>(
      'input[name="directoryFeedId"]'
    )
    expect(hiddenFeedId?.value).toBe("npr-national")

    const folderSelect = screen.getByRole("combobox", { name: "Folder" })
    expect(folderSelect).toHaveProperty("value", "")
    expect(
      within(folderSelect).getByRole("option", { name: "Uncategorized" })
    ).toHaveProperty("selected", true)
    expect(
      within(folderSelect).getByRole("option", { name: "Morning News" })
    ).toBeTruthy()
    expect(
      within(folderSelect).getByRole("option", { name: "Research" })
    ).toBeTruthy()

    const liveRegion = document.querySelector('[aria-live="polite"]')
    expect(liveRegion?.getAttribute("aria-atomic")).toBe("true")
    expect(liveRegion?.textContent).toBe("")
  })
})

describe("FeedDirectorySubscribeButton", () => {
  it("opens the real dialog from the feed-specific Subscribe trigger", async () => {
    const user = userEvent.setup()

    render(
      <FeedDirectorySubscribeButton
        feedId="npr-national"
        feedLabel="NPR - National"
        folders={folders}
        subscribed={false}
      />
    )

    await user.click(
      screen.getByRole("button", {
        name: /Subscribe.*NPR - National/,
      })
    )

    expect(
      screen.getByRole("dialog", { name: "Subscribe to NPR - National" })
    ).toBeTruthy()
  })

  it("preserves the popup during its closing transition and restores trigger focus", async () => {
    const user = userEvent.setup()
    const closingAnimation = createDeferred<void>()
    const getAnimationsDescriptor = Object.getOwnPropertyDescriptor(
      Element.prototype,
      "getAnimations"
    )
    Object.defineProperty(Element.prototype, "getAnimations", {
      configurable: true,
      value(this: Element) {
        if (
          this.matches('[data-slot="alert-dialog-content"]') &&
          this.hasAttribute("data-ending-style")
        ) {
          return [
            {
              finished: closingAnimation.promise,
              pending: false,
              playState: "running",
            },
          ] as unknown as Animation[]
        }

        return []
      },
    })

    try {
      render(
        <FeedDirectorySubscribeButton
          feedId="npr-national"
          feedLabel="NPR - National"
          folders={folders}
          subscribed={false}
        />
      )

      const subscribeTrigger = screen.getByRole("button", {
        name: /Subscribe.*NPR - National/,
      })
      await user.click(subscribeTrigger)

      const popup = screen.getByRole("dialog")
      await user.click(
        within(popup).getByRole("button", {
          name: "Cancel",
        })
      )

      expect(popup.isConnected).toBe(true)

      await act(async () => {
        closingAnimation.resolve()
        await closingAnimation.promise
      })
      await waitFor(() => {
        expect(screen.queryByRole("dialog")).toBeNull()
      })
      expect(document.activeElement).toBe(subscribeTrigger)
    } finally {
      if (getAnimationsDescriptor) {
        Object.defineProperty(
          Element.prototype,
          "getAnimations",
          getAnimationsDescriptor
        )
      } else {
        Reflect.deleteProperty(Element.prototype, "getAnimations")
      }
    }
  })

  it("clears an action error after the dialog is closed and reopened", async () => {
    const user = userEvent.setup()
    const errorMessage = "NPR - National could not be subscribed. Try again."
    subscribeDirectoryFeedAction.mockResolvedValueOnce({
      message: errorMessage,
      status: "error",
    })

    render(
      <FeedDirectorySubscribeButton
        feedId="npr-national"
        feedLabel="NPR - National"
        folders={folders}
        subscribed={false}
      />
    )

    await user.click(
      screen.getByRole("button", {
        name: /Subscribe.*NPR - National/,
      })
    )
    await user.click(
      within(screen.getByRole("dialog")).getByRole("button", {
        name: "Subscribe",
      })
    )

    expect(
      await within(screen.getByRole("dialog")).findByText(errorMessage)
    ).toBeTruthy()
    const visibleError = within(screen.getByRole("dialog")).getByText(
      errorMessage
    )
    expect(visibleError.getAttribute("aria-live")).toBeNull()
    expect(visibleError.getAttribute("aria-atomic")).toBeNull()
    expect(getPoliteLiveRegions()).toEqual([getPersistentAnnouncement()])
    await waitFor(() => {
      expect(getPersistentAnnouncement()?.textContent).toBe(errorMessage)
    })

    await user.click(
      within(screen.getByRole("dialog")).getByRole("button", {
        name: "Cancel",
      })
    )
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).toBeNull()
    })

    const subscribeTrigger = screen.getByRole("button", {
      name: /Subscribe.*NPR - National/,
    })
    expect(document.activeElement).toBe(subscribeTrigger)
    await waitFor(() => {
      expect(getPersistentAnnouncement()?.textContent).toBe(errorMessage)
    })

    await user.click(subscribeTrigger)

    expect(
      within(screen.getByRole("dialog")).queryByText(errorMessage)
    ).toBeNull()
    await waitFor(() => {
      expect(getPersistentAnnouncement()?.textContent).toBe("")
    })
  })

  it("keeps a successful subscription message in a persistent live region after closing the dialog", async () => {
    const user = userEvent.setup()
    const successMessage =
      "Subscribed to NPR - National. Imported 12 articles."
    subscribeDirectoryFeedAction.mockResolvedValueOnce({
      message: successMessage,
      status: "success",
    })

    render(
      <FeedDirectorySubscribeButton
        feedId="npr-national"
        feedLabel="NPR - National"
        folders={folders}
        subscribed={false}
      />
    )

    await user.click(
      screen.getByRole("button", {
        name: /Subscribe.*NPR - National/,
      })
    )
    await user.click(
      within(screen.getByRole("dialog")).getByRole("button", {
        name: "Subscribe",
      })
    )

    await waitFor(() => {
      expect(screen.queryByRole("dialog")).toBeNull()
    })

    expect(screen.getByText(successMessage)).toBeTruthy()
    expect(getPersistentAnnouncement()?.textContent).toBe(successMessage)
    expect(document.activeElement).toBe(
      screen.getByRole("button", {
        name: /Subscribe.*NPR - National/,
      })
    )
  })

  it("preserves the success announcement when a refresh renders the subscribed state", async () => {
    const user = userEvent.setup()
    const successMessage =
      "Subscribed to NPR - National. Imported 12 articles."
    subscribeDirectoryFeedAction.mockResolvedValueOnce({
      message: successMessage,
      status: "success",
    })

    const { rerender } = render(
      <FeedDirectorySubscribeButton
        feedId="npr-national"
        feedLabel="NPR - National"
        folders={folders}
        subscribed={false}
      />
    )

    await user.click(
      screen.getByRole("button", {
        name: /Subscribe.*NPR - National/,
      })
    )
    await user.click(
      within(screen.getByRole("dialog")).getByRole("button", {
        name: "Subscribe",
      })
    )

    await waitFor(() => {
      expect(getPersistentAnnouncement()?.textContent).toBe(successMessage)
    })

    rerender(
      <FeedDirectorySubscribeButton
        feedId="npr-national"
        feedLabel="NPR - National"
        folders={folders}
        subscribed
      />
    )

    expect(screen.queryByRole("dialog")).toBeNull()
    expect(
      screen.getByRole("button", {
        name: /Subscribed.*NPR - National/,
      })
    ).toHaveProperty("disabled", true)
    expect(getPersistentAnnouncement()?.textContent).toBe(successMessage)
  })

  it("disables the folder picker and dialog actions while pending", async () => {
    const user = userEvent.setup()
    const deferred =
      createDeferred<Awaited<ReturnType<typeof subscribeDirectoryFeedAction>>>()
    subscribeDirectoryFeedAction.mockReturnValueOnce(deferred.promise)

    render(
      <FeedDirectorySubscribeButton
        feedId="npr-national"
        feedLabel="NPR - National"
        folders={folders}
        subscribed={false}
      />
    )

    await user.click(
      screen.getByRole("button", {
        name: /Subscribe.*NPR - National/,
      })
    )

    const dialog = screen.getByRole("dialog")
    const submitButton = within(dialog).getByRole("button", {
      name: "Subscribe",
    })
    await user.click(submitButton)

    await waitFor(() => {
      expect(within(dialog).getByRole("combobox", { name: "Folder" })).toHaveProperty(
        "disabled",
        true
      )
      expect(
        within(dialog).getByRole("button", { name: "Cancel" })
      ).toHaveProperty("disabled", true)
      expect(
        within(dialog).getByRole("button", { name: "Subscribing" })
      ).toHaveProperty("disabled", true)
    })

    await act(async () => {
      deferred.resolve({ message: "", status: "idle" })
      await deferred.promise
    })

    await waitFor(() => {
      expect(
        within(dialog).getByRole("button", { name: "Subscribe" })
      ).toHaveProperty("disabled", false)
    })
  })

  it("resets action state when the open control receives a new feed", async () => {
    const user = userEvent.setup()
    subscribeDirectoryFeedAction.mockResolvedValueOnce({
      message: "NPR - National could not be subscribed. Try again.",
      status: "error",
    })

    const { rerender } = render(
      <FeedDirectorySubscribeButton
        feedId="npr-national"
        feedLabel="NPR - National"
        folders={folders}
        subscribed={false}
      />
    )

    await user.click(
      screen.getByRole("button", {
        name: /Subscribe.*NPR - National/,
      })
    )
    await user.click(
      within(screen.getByRole("dialog")).getByRole("button", {
        name: "Subscribe",
      })
    )
    expect(
      await within(screen.getByRole("dialog")).findByText(
        "NPR - National could not be subscribed. Try again."
      )
    ).toBeTruthy()

    rerender(
      <FeedDirectorySubscribeButton
        feedId="science-friday"
        feedLabel="Science Friday"
        folders={folders}
        subscribed={false}
      />
    )

    expect(
      screen.getByRole("dialog", { name: "Subscribe to Science Friday" })
    ).toBeTruthy()
    expect(
      screen.queryByText(
        "NPR - National could not be subscribed. Try again."
      )
    ).toBeNull()
    expect(document.querySelector('[aria-live="polite"]')?.textContent).toBe("")
  })

  it("renders a disabled feed-specific Subscribed state", () => {
    render(
      <FeedDirectorySubscribeButton
        feedId="npr-national"
        feedLabel="NPR - National"
        folders={folders}
        subscribed
      />
    )

    expect(
      screen.getByRole("button", {
        name: /Subscribed.*NPR - National/,
      })
    ).toHaveProperty("disabled", true)
    expect(screen.queryByRole("dialog")).toBeNull()
  })
})
