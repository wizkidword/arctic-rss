import sanitizeHtml from "sanitize-html"

import { imageProxyUrl } from "../image-proxy-url"

declare const sanitizedArticleHtmlBrand: unique symbol

export type SanitizedArticleHtml = string & {
  readonly [sanitizedArticleHtmlBrand]: true
}

export function sanitizeArticleHtml(
  html: string | null | undefined
): SanitizedArticleHtml | null {
  if (!html) {
    return null
  }

  const sanitized = sanitizeHtml(html, {
    allowedAttributes: {
      a: ["href", "name", "rel", "target"],
      blockquote: ["cite"],
      img: ["alt", "height", "loading", "referrerpolicy", "src", "title", "width"],
    },
    allowedSchemes: ["http", "https", "mailto"],
    allowedSchemesByTag: { a: ["http", "https", "mailto"], img: ["http", "https"] },
    allowedTags: [
      "a", "b", "blockquote", "br", "code", "em", "figcaption", "figure", "h1", "h2",
      "h3", "h4", "h5", "h6", "hr", "i", "img", "li", "ol", "p", "pre", "strong", "ul",
    ],
    exclusiveFilter: (frame) =>
      frame.tag === "img" && (isTrackingPixel(frame.attribs) || !imageProxyUrl(frame.attribs.src)),
    transformTags: {
      a: sanitizeHtml.simpleTransform("a", { rel: "nofollow noreferrer", target: "_blank" }),
      img: (tagName, attribs) => {
        const proxiedSrc = imageProxyUrl(attribs.src)

        return proxiedSrc
          ? {
              attribs: { ...attribs, loading: "lazy", referrerpolicy: "no-referrer", src: proxiedSrc },
              tagName,
            }
          : { attribs: {}, tagName }
      },
    },
  }).trim()

  return sanitized ? (sanitized as SanitizedArticleHtml) : null
}

function isTrackingPixel(attributes: Record<string, string>) {
  const width = parseImageDimension(attributes.width)
  const height = parseImageDimension(attributes.height)

  return width !== null && height !== null && width <= 1 && height <= 1
}

function parseImageDimension(value: string | undefined) {
  if (!value || !/^\d+(?:\.\d+)?$/.test(value)) {
    return null
  }

  const dimension = Number(value)

  return Number.isFinite(dimension) ? dimension : null
}
