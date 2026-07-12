// @vitest-environment jsdom

import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const {
  addArticleToCollectionAction,
  deleteArticleAction,
  generateArticleSummaryAction,
  markAllReadAction,
  removeArticleFromCollectionAction,
  setArticleReadAction,
  setArticleStarredAction,
} = vi.hoisted(() => ({
  addArticleToCollectionAction: vi.fn(),
  deleteArticleAction: vi.fn(),
  generateArticleSummaryAction: vi.fn(),
  markAllReadAction: vi.fn(),
  removeArticleFromCollectionAction: vi.fn(),
  setArticleReadAction: vi.fn(),
  setArticleStarredAction: vi.fn(),
}))

vi.mock("@/app/app/actions", () => ({
  addArticleToCollectionAction,
  deleteArticleAction,
  generateArticleSummaryAction,
  markAllReadAction,
  removeArticleFromCollectionAction,
  setArticleReadAction,
  setArticleStarredAction,
}))

import { ArticleContextMenu } from "@/components/article-context-menu"

const article = {
  feedId: "feed-wired-science",
  id: "article-asteroid",
  isRead: true,
  isStarred: false,
  title: "How to See the Giant Asteroid",
  url: "https://www.wired.com/story/asteroid/",
}

afterEach(() => {
  cleanup()
})

beforeEach(() => {
  addArticleToCollectionAction.mockReset()
  addArticleToCollectionAction.mockResolvedValue({
    message: "Article saved to collection.",
    status: "success",
  })
  deleteArticleAction.mockReset()
  markAllReadAction.mockReset()
  removeArticleFromCollectionAction.mockReset()
  generateArticleSummaryAction.mockReset()
  generateArticleSummaryAction.mockResolvedValue({
    message: "Summary generated.",
    status: "success",
  })
  setArticleReadAction.mockReset()
  setArticleStarredAction.mockReset()
})

describe("ArticleContextMenu", () => {
  it("opens post actions from a right-click on an article", () => {
    render(
      <ArticleContextMenu article={article}>
        <article>How to See the Giant Asteroid</article>
      </ArticleContextMenu>
    )

    fireEvent.contextMenu(screen.getByText("How to See the Giant Asteroid"), {
      clientX: 160,
      clientY: 220,
    })

    expect(
      screen.getByRole("menu", { name: "How to See the Giant Asteroid post actions" })
    ).toBeTruthy()
    expect(screen.getByRole("menuitem", { name: "Mark as unread" })).toBeTruthy()
    expect(screen.getByRole("menuitem", { name: "Star post" })).toBeTruthy()
    expect(screen.getByRole("menuitem", { name: "Save to collection" })).toBeTruthy()
    expect(screen.getByRole("menuitem", { name: "Delete article" })).toBeTruthy()
    expect(screen.getByRole("menuitem", { name: "Share" })).toBeTruthy()
    expect(screen.getByRole("menuitem", { name: "Mark feed as read" })).toBeTruthy()
    expect(screen.getByRole("menuitem", { name: "Mark all as read" })).toBeTruthy()
  })

  it("deletes the selected article from the reader", async () => {
    const user = userEvent.setup()
    render(
      <ArticleContextMenu article={article}>
        <article>How to See the Giant Asteroid</article>
      </ArticleContextMenu>
    )

    fireEvent.contextMenu(screen.getByText("How to See the Giant Asteroid"), {
      clientX: 160,
      clientY: 220,
    })

    await user.click(screen.getByRole("menuitem", { name: "Delete article" }))

    await waitFor(() => {
      expect(deleteArticleAction).toHaveBeenCalledTimes(1)
    })

    const formData = deleteArticleAction.mock.calls[0][0] as FormData
    expect(formData.get("articleId")).toBe("article-asteroid")
  })

  it("removes a saved article from the current collection", async () => {
    const user = userEvent.setup()
    render(
      <ArticleContextMenu
        article={article}
        currentCollection={{
          id: "collection-later",
          name: "Read Later",
        }}
      >
        <article>How to See the Giant Asteroid</article>
      </ArticleContextMenu>
    )

    fireEvent.contextMenu(screen.getByText("How to See the Giant Asteroid"), {
      clientX: 160,
      clientY: 220,
    })

    await user.click(
      screen.getByRole("menuitem", { name: "Remove from Read Later" })
    )

    await waitFor(() => {
      expect(removeArticleFromCollectionAction).toHaveBeenCalledTimes(1)
    })

    const formData = removeArticleFromCollectionAction.mock.calls[0][0] as FormData
    expect(formData.get("articleId")).toBe("article-asteroid")
    expect(formData.get("collectionId")).toBe("collection-later")
  })

  it("opens a collection picker and submits an existing collection", async () => {
    const user = userEvent.setup()
    render(
      <ArticleContextMenu
        article={article}
        collections={[
          { articleCount: 2, id: "collection-research", name: "Research" },
          { articleCount: 0, id: "collection-later", name: "Read Later" },
        ]}
      >
        <article>How to See the Giant Asteroid</article>
      </ArticleContextMenu>
    )

    fireEvent.contextMenu(screen.getByText("How to See the Giant Asteroid"), {
      clientX: 160,
      clientY: 220,
    })
    await user.click(screen.getByRole("menuitem", { name: "Save to collection" }))

    const dialog = screen.getByRole("dialog", {
      name: "Save to collection",
    })
    expect(within(dialog).getByRole("combobox", { name: "Collection" })).toBeTruthy()
    await user.selectOptions(
      within(dialog).getByRole("combobox", { name: "Collection" }),
      "collection-later"
    )
    await user.click(within(dialog).getByRole("button", { name: "Save" }))

    await waitFor(() => {
      expect(addArticleToCollectionAction).toHaveBeenCalled()
    })

    const formData = addArticleToCollectionAction.mock.calls[0][1] as FormData
    expect(formData.get("articleId")).toBe("article-asteroid")
    expect(formData.get("collectionId")).toBe("collection-later")
    expect(formData.get("collectionName")).toBeNull()
  })

  it("lets readers create a collection while saving a post", async () => {
    const user = userEvent.setup()
    render(
      <ArticleContextMenu article={article} collections={[]}>
        <article>How to See the Giant Asteroid</article>
      </ArticleContextMenu>
    )

    fireEvent.contextMenu(screen.getByText("How to See the Giant Asteroid"), {
      clientX: 160,
      clientY: 220,
    })
    await user.click(screen.getByRole("menuitem", { name: "Save to collection" }))

    const dialog = screen.getByRole("dialog", {
      name: "Save to collection",
    })
    expect(within(dialog).getByRole("combobox", { name: "Collection" })).toHaveProperty(
      "value",
      "new-collection"
    )
    await user.type(
      within(dialog).getByRole("textbox", { name: "New collection name" }),
      "Deep Reads"
    )
    await user.click(within(dialog).getByRole("button", { name: "Save" }))

    await waitFor(() => {
      expect(addArticleToCollectionAction).toHaveBeenCalled()
    })

    const formData = addArticleToCollectionAction.mock.calls[0][1] as FormData
    expect(formData.get("articleId")).toBe("article-asteroid")
    expect(formData.get("collectionId")).toBe("")
    expect(formData.get("collectionName")).toBe("Deep Reads")
  })

  it("toggles the selected article read state", async () => {
    const user = userEvent.setup()
    render(
      <ArticleContextMenu article={article}>
        <article>How to See the Giant Asteroid</article>
      </ArticleContextMenu>
    )

    fireEvent.contextMenu(screen.getByText("How to See the Giant Asteroid"), {
      clientX: 160,
      clientY: 220,
    })

    await user.click(screen.getByRole("menuitem", { name: "Mark as unread" }))

    await waitFor(() => {
      expect(setArticleReadAction).toHaveBeenCalledTimes(1)
    })

    const formData = setArticleReadAction.mock.calls[0][0] as FormData
    expect(formData.get("articleId")).toBe("article-asteroid")
    expect(formData.get("isRead")).toBe("false")
  })

  it("toggles the selected article star state", async () => {
    const user = userEvent.setup()
    render(
      <ArticleContextMenu article={article}>
        <article>How to See the Giant Asteroid</article>
      </ArticleContextMenu>
    )

    fireEvent.contextMenu(screen.getByText("How to See the Giant Asteroid"), {
      clientX: 160,
      clientY: 220,
    })

    await user.click(screen.getByRole("menuitem", { name: "Star post" }))

    await waitFor(() => {
      expect(setArticleStarredAction).toHaveBeenCalledTimes(1)
    })

    const formData = setArticleStarredAction.mock.calls[0][0] as FormData
    expect(formData.get("articleId")).toBe("article-asteroid")
    expect(formData.get("isStarred")).toBe("true")
  })

  it("marks the source feed as read", async () => {
    const user = userEvent.setup()
    render(
      <ArticleContextMenu article={article}>
        <article>How to See the Giant Asteroid</article>
      </ArticleContextMenu>
    )

    fireEvent.contextMenu(screen.getByText("How to See the Giant Asteroid"), {
      clientX: 160,
      clientY: 220,
    })

    await user.click(screen.getByRole("menuitem", { name: "Mark feed as read" }))

    await waitFor(() => {
      expect(markAllReadAction).toHaveBeenCalledTimes(1)
    })

    const formData = markAllReadAction.mock.calls[0][0] as FormData
    expect(formData.get("scope")).toBe("feed")
    expect(formData.get("feedId")).toBe("feed-wired-science")
  })

  it("shows hover action buttons and wires them to article actions", async () => {
    const user = userEvent.setup()
    render(
      <ArticleContextMenu article={article} inlineActions>
        <article>How to See the Giant Asteroid</article>
      </ArticleContextMenu>
    )

    const toolbar = screen.getByRole("toolbar", {
      name: "How to See the Giant Asteroid quick actions",
    })
    expect(toolbar.className).toContain("group-hover/article-actions:opacity-100")
    expect(toolbar.className).not.toContain("group-focus-within")
    expect(within(toolbar).getByRole("button", { name: "Share post" })).toBeTruthy()
    expect(
      within(toolbar).getByRole("button", { name: "Summarize with AI" })
    ).toBeTruthy()
    expect(
      within(toolbar).getByRole("button", { name: "Save to collection" })
    ).toBeTruthy()
    expect(
      within(toolbar).getByRole("button", { name: "Delete article" })
    ).toBeTruthy()
    expect(within(toolbar).getByRole("button", { name: "Star post" })).toBeTruthy()
    expect(
      within(toolbar).getByRole("button", { name: "Mark as unread" })
    ).toBeTruthy()

    await user.click(within(toolbar).getByRole("button", { name: "Summarize with AI" }))

    await waitFor(() => {
      expect(generateArticleSummaryAction).toHaveBeenCalledTimes(1)
    })

    const summaryFormData = generateArticleSummaryAction.mock.calls[0][1] as FormData
    expect(summaryFormData.get("articleId")).toBe("article-asteroid")

    await user.click(within(toolbar).getByRole("button", { name: "Star post" }))

    await waitFor(() => {
      expect(setArticleStarredAction).toHaveBeenCalledTimes(1)
    })

    const starFormData = setArticleStarredAction.mock.calls[0][0] as FormData
    expect(starFormData.get("isStarred")).toBe("true")

    await user.click(
      within(toolbar).getByRole("button", { name: "Save to collection" })
    )

    expect(
      screen.getByRole("dialog", {
        name: "Save to collection",
      })
    ).toBeTruthy()

    await user.keyboard("{Escape}")
    await user.click(within(toolbar).getByRole("button", { name: "Delete article" }))

    await waitFor(() => {
      expect(deleteArticleAction).toHaveBeenCalledTimes(1)
    })
  })

  it("greys out mutating article actions for guest browsing", () => {
    render(
      <ArticleContextMenu
        article={article}
        inlineActions
        readOnlyReason="Create an account to star, save, summarize, or mark posts."
      >
        <article>How to See the Giant Asteroid</article>
      </ArticleContextMenu>
    )

    fireEvent.contextMenu(screen.getByText("How to See the Giant Asteroid"), {
      clientX: 160,
      clientY: 220,
    })

    expect(screen.getByRole("menuitem", { name: "Share" })).toHaveProperty(
      "disabled",
      false
    )

    for (const name of [
      "Mark as unread",
      "Star post",
      "Delete article",
      "Save to collection",
      "Mark feed as read",
      "Mark all as read",
    ]) {
      const item = screen.getByRole("menuitem", { name })
      expect(item).toHaveProperty("disabled", true)
      expect(item.getAttribute("title")).toBe(
        "Create an account to star, save, summarize, or mark posts."
      )
    }

    const toolbar = screen.getByRole("toolbar", {
      name: "How to See the Giant Asteroid quick actions",
    })

    for (const name of [
      "Summarize with AI",
      "Save to collection",
      "Delete article",
      "Star post",
      "Mark as unread",
    ]) {
      expect(within(toolbar).getByRole("button", { name })).toHaveProperty(
        "disabled",
        true
      )
    }
  })

  it("shows a remove quick action when a collection is active", async () => {
    const user = userEvent.setup()
    render(
      <ArticleContextMenu
        article={article}
        currentCollection={{
          id: "collection-later",
          name: "Read Later",
        }}
        inlineActions
      >
        <article>How to See the Giant Asteroid</article>
      </ArticleContextMenu>
    )

    const toolbar = screen.getByRole("toolbar", {
      name: "How to See the Giant Asteroid quick actions",
    })

    await user.click(
      within(toolbar).getByRole("button", { name: "Remove from Read Later" })
    )

    await waitFor(() => {
      expect(removeArticleFromCollectionAction).toHaveBeenCalledTimes(1)
    })

    const formData = removeArticleFromCollectionAction.mock.calls[0][0] as FormData
    expect(formData.get("articleId")).toBe("article-asteroid")
    expect(formData.get("collectionId")).toBe("collection-later")
  })
})
