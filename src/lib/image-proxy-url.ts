const IMAGE_PROXY_PATH = "/api/image"

export function imageProxyUrl(value: string | null | undefined) {
  const source = value?.trim()

  if (!source) {
    return null
  }

  if (source.startsWith(`${IMAGE_PROXY_PATH}?url=`)) {
    return source
  }

  try {
    const url = new URL(source)

    if (
      (url.protocol !== "http:" && url.protocol !== "https:") ||
      url.username ||
      url.password
    ) {
      return null
    }

    url.hash = ""

    return `${IMAGE_PROXY_PATH}?url=${encodeURIComponent(url.href)}`
  } catch {
    return null
  }
}
