export const IMAGE_PROXY_MAX_BYTES = 5 * 1024 * 1024
export const IMAGE_PROXY_CACHE_CONTROL =
  "public, max-age=86400, s-maxage=604800, stale-while-revalidate=86400"
export const IMAGE_PROXY_ACCEPT =
  "image/avif,image/webp,image/apng,image/png,image/jpeg,image/gif,image/x-icon;q=0.9,*/*;q=0.1"
export const IMAGE_PROXY_USER_AGENT = "ArcticRSS Image Proxy/0.1"

const ALLOWED_IMAGE_CONTENT_TYPES = new Set([
  "image/avif",
  "image/bmp",
  "image/gif",
  "image/jpeg",
  "image/png",
  "image/vnd.microsoft.icon",
  "image/webp",
  "image/x-icon",
])

export function allowedImageContentType(contentType: string) {
  const normalized = contentType.split(";", 1)[0]?.trim().toLowerCase()

  return normalized && ALLOWED_IMAGE_CONTENT_TYPES.has(normalized)
    ? normalized
    : null
}
