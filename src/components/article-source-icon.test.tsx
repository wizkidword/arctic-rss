/** @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { renderToStaticMarkup } from "react-dom/server"
import { afterEach, describe, expect, it } from "vitest"

import { ArticleSourceIcon } from "./article-source-icon"

describe("ArticleSourceIcon", () => {
  afterEach(() => {
    cleanup()
  })

  it("server-renders the article domain favicon before a stored direct favicon", () => {
    const markup = renderToStaticMarkup(
      <ArticleSourceIcon
        articleUrl="https://www.mmafighting.com/2026/7/2/story"
        faviconUrl="https://www.mmafighting.com/favicon.ico"
        title="MMA Fighting"
      />
    )

    expect(markup).toContain(
      "/api/image?url=https%3A%2F%2Fwww.google.com%2Fs2%2Ffavicons%3Fdomain%3Dmmafighting.com%26sz%3D64"
    )
    expect(markup).not.toContain("https://www.mmafighting.com/favicon.ico")
  })

  it("falls back from a broken domain favicon to a distinct stored favicon", () => {
    render(
      <ArticleSourceIcon
        articleUrl="https://example.com/articles/story"
        faviconUrl="https://publisher.example.com/missing.ico"
        title="Example Publisher"
      />
    )

    const image = screen.getByAltText("Example Publisher icon")

    expect(image.getAttribute("src")).toBe(
      "/api/image?url=https%3A%2F%2Fwww.google.com%2Fs2%2Ffavicons%3Fdomain%3Dexample.com%26sz%3D64"
    )

    fireEvent.error(image)

    expect(
      screen.getByAltText("Example Publisher icon").getAttribute("src")
    ).toBe(
      "/api/image?url=https%3A%2F%2Fpublisher.example.com%2Fmissing.ico"
    )
  })

  it("falls back to source initials when the domain favicon also fails", () => {
    render(
      <ArticleSourceIcon
        articleUrl="https://example.com/articles/story"
        faviconUrl="https://publisher.example.com/missing.ico"
        title="Example Publisher"
      />
    )

    fireEvent.error(screen.getByAltText("Example Publisher icon"))
    fireEvent.error(screen.getByAltText("Example Publisher icon"))

    expect(screen.getByLabelText("Example Publisher icon").textContent).toBe(
      "EP"
    )
  })
})
