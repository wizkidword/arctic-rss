import { readFile } from "node:fs/promises"
import { describe, expect, it } from "vitest"

describe("security.txt", () => {
  it("publishes a vulnerability disclosure contact", async () => {
    const securityTxt = await readFile(
      "public/.well-known/security.txt",
      "utf8"
    )

    expect(securityTxt).toContain("Contact: mailto:arcticrss@gmail.com")
    expect(securityTxt).toContain(
      "Canonical: https://arcticrss.com/.well-known/security.txt"
    )
    expect(securityTxt).toContain("Preferred-Languages: en")
    expect(securityTxt).toMatch(
      /^Expires: 2027-06-26T23:59:59Z$/m
    )
  })
})
