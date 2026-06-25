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

  it("clears an action error after the dialog is closed and reopened", async () => {
    const user = userEvent.setup()
    subscribeDirectoryFeedAction.mockResolvedValueOnce({
      message: "NPR - National could not be subscribed. Try again.",
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
      await screen.findByText(
        "NPR - National could not be subscribed. Try again."
      )
    ).toBeTruthy()

    await user.click(
      within(screen.getByRole("dialog")).getByRole("button", {
        name: "Cancel",
      })
    )
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).toBeNull()
    })

    await user.click(
      screen.getByRole("button", {
        name: /Subscribe.*NPR - National/,
      })
    )

    expect(
      screen.queryByText(
        "NPR - National could not be subscribed. Try again."
      )
    ).toBeNull()
  })

  it("closes the dialog after a successful subscription", async () => {
    const user = userEvent.setup()
    subscribeDirectoryFeedAction.mockResolvedValueOnce({
      message: "Subscribed to NPR - National.",
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
      await screen.findByText(
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
