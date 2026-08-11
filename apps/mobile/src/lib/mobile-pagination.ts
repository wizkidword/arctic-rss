export const MAXIMUM_MOBILE_PAGE_ITEMS = 300

export function mergeMobilePageItems<T>(
  current: T[],
  incoming: T[],
  itemId: (item: T) => string,
  maximumItems = MAXIMUM_MOBILE_PAGE_ITEMS
) {
  const seen = new Set<string>()
  const merged: T[] = []
  for (const item of [...current, ...incoming]) {
    const id = itemId(item)
    if (seen.has(id)) {
      continue
    }
    seen.add(id)
    merged.push(item)
    if (merged.length === maximumItems) {
      return { isTruncated: true, items: merged }
    }
  }
  return { isTruncated: false, items: merged }
}
