import { execFile } from "node:child_process"
import path from "node:path"

export const e2eCredentials = {
  admin: {
    email: "admin@e2e.arcticrss.test",
    name: "E2E Admin",
  },
  oauth: {
    email: "oauth@e2e.arcticrss.test",
    name: "E2E OAuth Reader",
  },
  opml: {
    email: "opml@e2e.arcticrss.test",
    name: "E2E OPML Reader",
  },
  reader: {
    email: "reader@e2e.arcticrss.test",
    name: "E2E Reader",
  },
  revoked: {
    email: "revoked@e2e.arcticrss.test",
    name: "E2E Revoked Reader",
  },
  search: {
    email: "search@e2e.arcticrss.test",
    name: "E2E Search Reader",
  },
  settings: {
    email: "settings@e2e.arcticrss.test",
    name: "E2E Settings Reader",
  },
} as const

export const e2ePassword = "E2E reader password 123!"
export const e2eFeedUrl = `http://${process.env.ARCTIC_RSS_E2E_FEED_HOST ?? "feeds.e2e.arcticrss.test"}`

export async function processLatestOpmlImportForUser(email: string) {
  const output = await runFixtureControl(["process-opml", email])
  return JSON.parse(output) as { status: string }
}

export function runFixtureControl(arguments_: string[]) {
  const fixtureControlScript = path.join(
    process.cwd(),
    "scripts",
    "e2e",
    "fixture-control.ts"
  )
  const tsxCli = path.join(process.cwd(), "node_modules", "tsx", "dist", "cli.mjs")

  return new Promise<string>((resolve, reject) => {
    execFile(
      process.execPath,
      [tsxCli, fixtureControlScript, ...arguments_],
      { env: process.env },
      (error, stdout, stderr) => {
        if (error) {
          reject(
            new Error(
              `Fixture control failed: ${stderr.trim() || stdout.trim() || error.message}`
            )
          )
          return
        }

        const lastOutputLine = stdout.trim().split(/\r?\n/).at(-1)
        resolve(lastOutputLine ?? "")
      }
    )
  })
}
