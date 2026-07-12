import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { applyThemePreferenceToDocument } from "./theme-dom"

describe("applyThemePreferenceToDocument", () => {
  beforeEach(() => {
    vi.stubGlobal("document", createDocumentStub())
    vi.stubGlobal("window", {
      matchMedia: vi.fn().mockReturnValue({
        addEventListener: vi.fn(),
        matches: false,
        removeEventListener: vi.fn(),
      }),
    })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("applies a named light reader theme to the document", () => {
    applyThemePreferenceToDocument("ORANGE")

    expect(document.documentElement.dataset.themePreference).toBe("orange")
    expect(document.documentElement.dataset.readerTheme).toBe("orange")
    expect(document.documentElement.classList.contains("dark")).toBe(false)
    expect(document.documentElement.style.colorScheme).toBe("light")
  })

  it("marks grey as a dark reader theme", () => {
    applyThemePreferenceToDocument("GREY")

    expect(document.documentElement.dataset.themePreference).toBe("grey")
    expect(document.documentElement.dataset.readerTheme).toBe("grey")
    expect(document.documentElement.classList.contains("dark")).toBe(true)
    expect(document.documentElement.style.colorScheme).toBe("dark")
  })

  it("resolves the system theme from the current OS preference", () => {
    vi.stubGlobal("window", {
      matchMedia: vi.fn().mockReturnValue({
        addEventListener: vi.fn(),
        matches: true,
        removeEventListener: vi.fn(),
      }),
    })

    applyThemePreferenceToDocument("SYSTEM")

    expect(document.documentElement.dataset.themePreference).toBe("system")
    expect(document.documentElement.dataset.readerTheme).toBe("dark")
    expect(document.documentElement.classList.contains("dark")).toBe(true)
    expect(document.documentElement.style.colorScheme).toBe("dark")
  })
})

function createDocumentStub() {
  const classes = new Set<string>()

  return {
    documentElement: {
      classList: {
        contains(className: string) {
          return classes.has(className)
        },
        toggle(className: string, force?: boolean) {
          const shouldAdd = force ?? !classes.has(className)

          if (shouldAdd) {
            classes.add(className)
          } else {
            classes.delete(className)
          }

          return shouldAdd
        },
      },
      dataset: {},
      style: {},
    },
  } as unknown as Document
}
