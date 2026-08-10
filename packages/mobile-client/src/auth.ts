export type PkceAuthorization = {
  codeChallenge: string
  codeVerifier: string
  nonce: string
  state: string
}

export async function createPkceAuthorization({
  randomBytes,
  sha256,
}: {
  randomBytes: (size: number) => Uint8Array
  sha256: (value: string) => Promise<Uint8Array>
}): Promise<PkceAuthorization> {
  const codeVerifier = encodeBase64Url(randomBytes(64))
  const [nonce, state, challenge] = await Promise.all([
    Promise.resolve(encodeBase64Url(randomBytes(32))),
    Promise.resolve(encodeBase64Url(randomBytes(32))),
    sha256(codeVerifier).then(encodeBase64Url),
  ])

  return { codeChallenge: challenge, codeVerifier, nonce, state }
}

export function encodeBase64Url(bytes: Uint8Array) {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_"
  let result = ""
  for (let index = 0; index < bytes.length; index += 3) {
    const first = bytes[index] ?? 0
    const second = bytes[index + 1]
    const third = bytes[index + 2]
    result += alphabet[first >> 2]
    result += alphabet[((first & 0b11) << 4) | ((second ?? 0) >> 4)]
    if (second !== undefined) {
      result += alphabet[((second & 0b1111) << 2) | ((third ?? 0) >> 6)]
    }
    if (third !== undefined) {
      result += alphabet[third & 0b111111]
    }
  }
  return result
}
