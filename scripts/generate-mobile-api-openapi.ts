import { writeFile } from "node:fs/promises"
import { resolve } from "node:path"

import { mobileApiV1OpenApiDocument } from "@arctic-rss/api-contract"

async function main() {
  const outputPath = resolve("docs/mobile/openapi-v1.json")
  const body = `${JSON.stringify(mobileApiV1OpenApiDocument, null, 2)}\n`

  if (process.argv.includes("--check")) {
    const { readFile } = await import("node:fs/promises")
    const current = await readFile(outputPath, "utf8")

    if (current !== body) {
      throw new Error("docs/mobile/openapi-v1.json is out of date. Run npm run api:openapi:write.")
    }
  } else {
    await writeFile(outputPath, body, "utf8")
  }
}

void main()
