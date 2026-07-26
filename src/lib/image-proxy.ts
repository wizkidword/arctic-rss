import sharp from "sharp"

export const IMAGE_PROXY_MAX_BYTES = 5 * 1024 * 1024
export const IMAGE_PROXY_MAX_OUTPUT_BYTES = 4 * 1024 * 1024
export const IMAGE_PROXY_MAX_PIXELS = 16_000_000
export const IMAGE_PROXY_MAX_ANIMATION_FRAMES = 100
export const IMAGE_PROXY_MAX_CONCURRENT_DECODES = 2
export const IMAGE_PROXY_MAX_QUEUED_DECODES = 8
export const IMAGE_PROXY_CACHE_CONTROL =
  "public, max-age=86400, s-maxage=604800, stale-while-revalidate=86400"
export const IMAGE_PROXY_ACCEPT =
  "image/avif,image/webp,image/apng,image/png,image/jpeg,image/gif,image/x-icon;q=0.9,*/*;q=0.1"
export const IMAGE_PROXY_USER_AGENT = "ArcticRSS Image Proxy/0.1"
export const IMAGE_PROXY_OUTPUT_CONTENT_TYPE = "image/webp"

type ImageSignature = "avif" | "bmp" | "gif" | "ico" | "jpeg" | "png" | "webp"

type ImageProxyProcessingOptions = {
  maxAnimationFrames?: number
  maxOutputBytes?: number
  maxPixels?: number
}

type ImageMetadata = {
  height?: number
  pageHeight?: number
  pages?: number
  width?: number
}

export type ReencodedImage = {
  bytes: Uint8Array
  contentType: typeof IMAGE_PROXY_OUTPUT_CONTENT_TYPE
}

export class ImageProxyValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "ImageProxyValidationError"
  }
}

export class ImageProxyCapacityError extends Error {
  constructor() {
    super("The image proxy is busy.")
    this.name = "ImageProxyCapacityError"
  }
}

let activeDecodes = 0
const decodeWaiters: Array<() => void> = []

export function imageSignature(bytes: Uint8Array): ImageSignature | null {
  if (hasPrefix(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) {
    return "png"
  }

  if (hasPrefix(bytes, [0xff, 0xd8, 0xff])) {
    return "jpeg"
  }

  if (
    hasPrefix(bytes, [0x47, 0x49, 0x46, 0x38, 0x37, 0x61]) ||
    hasPrefix(bytes, [0x47, 0x49, 0x46, 0x38, 0x39, 0x61])
  ) {
    return "gif"
  }

  if (
    hasPrefix(bytes, [0x52, 0x49, 0x46, 0x46]) &&
    hasPrefix(bytes, [0x57, 0x45, 0x42, 0x50], 8)
  ) {
    return "webp"
  }

  if (hasPrefix(bytes, [0x42, 0x4d])) {
    return "bmp"
  }

  if (hasPrefix(bytes, [0x00, 0x00, 0x01, 0x00])) {
    return "ico"
  }

  return hasAvifBrand(bytes) ? "avif" : null
}

export async function reencodeProxiedImage(
  bytes: Uint8Array,
  options: ImageProxyProcessingOptions = {}
): Promise<ReencodedImage> {
  if (!imageSignature(bytes)) {
    throw new ImageProxyValidationError("The response does not have an approved image signature.")
  }

  return withDecodeSlot(async () => {
    const maxPixels = options.maxPixels ?? IMAGE_PROXY_MAX_PIXELS
    const image = sharp(Buffer.from(bytes), {
      failOn: "warning",
      limitInputChannels: 4,
      limitInputPixels: maxPixels,
      pages: 1,
      sequentialRead: true,
    })
    const metadata = await image.metadata()

    assertImageMetadata(metadata, {
      maxAnimationFrames: options.maxAnimationFrames ?? IMAGE_PROXY_MAX_ANIMATION_FRAMES,
      maxPixels,
    })

    const output = await image
      .rotate()
      .webp({ effort: 4, quality: 82 })
      .toBuffer()
    const maxOutputBytes = options.maxOutputBytes ?? IMAGE_PROXY_MAX_OUTPUT_BYTES

    if (output.byteLength > maxOutputBytes) {
      throw new ImageProxyValidationError("The re-encoded image is too large to serve safely.")
    }

    return {
      bytes: new Uint8Array(output),
      contentType: IMAGE_PROXY_OUTPUT_CONTENT_TYPE,
    }
  })
}

export function assertImageMetadata(
  metadata: ImageMetadata,
  {
    maxAnimationFrames,
    maxPixels,
  }: Required<Pick<ImageProxyProcessingOptions, "maxAnimationFrames" | "maxPixels">>
) {
  const width = metadata.width
  const height = metadata.pageHeight ?? metadata.height
  const pages = metadata.pages ?? 1

  if (
    typeof width !== "number" ||
    typeof height !== "number" ||
    !Number.isSafeInteger(width) ||
    !Number.isSafeInteger(height) ||
    width < 1 ||
    height < 1
  ) {
    throw new ImageProxyValidationError("The image dimensions are invalid.")
  }

  if (!Number.isSafeInteger(pages) || pages < 1 || pages > maxAnimationFrames) {
    throw new ImageProxyValidationError("The image has too many animation frames.")
  }

  if (width * height > maxPixels) {
    throw new ImageProxyValidationError("The image has too many decoded pixels.")
  }
}

function hasPrefix(bytes: Uint8Array, prefix: readonly number[], offset = 0) {
  return prefix.every((value, index) => bytes[offset + index] === value)
}

function hasAvifBrand(bytes: Uint8Array) {
  if (!hasPrefix(bytes, [0x66, 0x74, 0x79, 0x70], 4)) {
    return false
  }

  for (let offset = 8; offset + 3 < Math.min(bytes.length, 64); offset += 4) {
    const brand = String.fromCharCode(...bytes.slice(offset, offset + 4))

    if (brand === "avif" || brand === "avis") {
      return true
    }
  }

  return false
}

async function withDecodeSlot<T>(operation: () => Promise<T>) {
  if (activeDecodes >= IMAGE_PROXY_MAX_CONCURRENT_DECODES) {
    if (decodeWaiters.length >= IMAGE_PROXY_MAX_QUEUED_DECODES) {
      throw new ImageProxyCapacityError()
    }

    await new Promise<void>((resolve) => decodeWaiters.push(resolve))
  }

  activeDecodes += 1

  try {
    return await operation()
  } catch (error) {
    if (error instanceof ImageProxyValidationError) {
      throw error
    }

    throw new ImageProxyValidationError("The response could not be decoded as a safe image.")
  } finally {
    activeDecodes -= 1
    decodeWaiters.shift()?.()
  }
}
