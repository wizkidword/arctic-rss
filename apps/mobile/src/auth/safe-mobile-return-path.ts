const protectedRoutePatterns = [
  /^\/(?:article|articles|podcast|podcast-episodes|collection|collections|saved-view|saved-views|briefing|briefings)\/[^/?#]+$/,
  /^\/(?:collection-picker|notifications|support|search|library|settings|unread|starred)$/,
]

export function safeMobileReturnPath(value: string | string[] | undefined) {
  const candidate = Array.isArray(value) ? value[0] : value

  if (!candidate || candidate.includes("?") || candidate.includes("#")) {
    return null
  }

  return protectedRoutePatterns.some((pattern) => pattern.test(candidate)) ? candidate : null
}
