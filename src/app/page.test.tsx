import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it, vi } from "vitest"

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

vi.mock("next/image", () => ({
  default: ({
    alt,
    priority,
    src,
    unoptimized,
    ...props
  }: React.ComponentProps<"img"> & {
    priority?: boolean
    src: string
    unoptimized?: boolean
  }) => {
    void priority
    void unoptimized

    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img alt={alt} src={src} {...props} />
    )
  },
}))

import Home from "@/app/page"

describe("Home", () => {
  it("uses the wordmark as the hero brand without a duplicate top nav", () => {
    const markup = renderToStaticMarkup(<Home />)

    expect(markup).toContain('alt="Arctic RSS"')
    expect(markup.match(/src="\/brand\/arctic-rss-wordmark\.png"/g)).toHaveLength(1)
    expect(markup.match(/href="\/login"/g)).toHaveLength(1)
    expect(markup.match(/href="\/guest"/g)).toHaveLength(1)
    expect(markup).toContain(">Browse as Guest<")
    expect(markup.indexOf('href="/guest"')).toBeLessThan(
      markup.indexOf('href="/signup"'),
    )
    expect(markup).not.toContain("<header")
    expect(markup).not.toContain(">Article Stream<")
  })

  it("respects system dark mode on the public landing page", () => {
    const markup = renderToStaticMarkup(<Home />)

    expect(markup).toContain("prefers-color-scheme: dark")
    expect(markup).toContain("dark:bg-slate-950")
    expect(markup).toContain("dark:text-slate-50")
    expect(markup).toContain("dark:border-slate-800")
  })

  it("shows a Discover-style product preview on the landing page", () => {
    const markup = renderToStaticMarkup(<Home />)

    expect(markup).toContain(">Discover<")
    expect(markup).toContain(">AI<")
    expect(markup).toContain(">Cybersecurity<")
    expect(markup).toContain(">Follow<")
  })

  it("constrains long Discover topic names inside their preview cards", () => {
    const markup = renderToStaticMarkup(<Home />)

    expect(markup).toContain(
      'class="truncate text-xs font-semibold leading-5 text-slate-950 dark:text-slate-50"',
    )
  })

  it("links to public legal policies from the landing footer", () => {
    const markup = renderToStaticMarkup(<Home />)

    expect(markup).toContain('href="/legal"')
    expect(markup).toContain('href="/privacy"')
    expect(markup).toContain('href="/terms"')
    expect(markup).toContain('href="/cookies"')
    expect(markup).toContain('href="/security"')
    expect(markup).toContain(">Legal<")
    expect(markup).toContain(">Privacy<")
    expect(markup).toContain(">Terms<")
    expect(markup).toContain(">Cookies<")
    expect(markup).toContain(">Security<")
  })
})
