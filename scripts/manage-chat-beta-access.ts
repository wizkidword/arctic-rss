import "dotenv/config"

import {
  grantChatBetaAccess,
  revokeChatBetaAccess,
} from "../src/lib/chat/beta-access"
import { getPrisma } from "../src/lib/db"

type Command =
  | { email: string; kind: "grant"; note?: string }
  | { email: string; kind: "revoke" }

function parseCommand(argumentsList: string[]): Command {
  const [kind, ...options] = argumentsList
  const emailIndex = options.indexOf("--email")
  const email = emailIndex >= 0 ? options[emailIndex + 1] : undefined

  if ((kind !== "grant" && kind !== "revoke") || !email || options[emailIndex + 2] === "--email") {
    throw new Error(
      "Usage: npm run chat:beta -- grant --email <account-email> [--note <operator-note>] | revoke --email <account-email>"
    )
  }

  if (kind === "revoke") {
    if (options.length !== 2 || emailIndex !== 0) {
      throw new Error("Usage: npm run chat:beta -- revoke --email <account-email>")
    }
    return { email, kind }
  }

  const noteIndex = options.indexOf("--note")
  const note = noteIndex >= 0 ? options[noteIndex + 1] : undefined
  const isValidGrant =
    emailIndex === 0 &&
    (options.length === 2 || (options.length === 4 && noteIndex === 2 && Boolean(note)))

  if (!isValidGrant) {
    throw new Error(
      "Usage: npm run chat:beta -- grant --email <account-email> [--note <operator-note>]"
    )
  }

  return { email, kind, note }
}

async function main() {
  const command = parseCommand(process.argv.slice(2))
  const prisma = getPrisma()

  try {
    const result =
      command.kind === "grant"
        ? await grantChatBetaAccess({
            email: command.email,
            note: command.note,
            store: prisma,
          })
        : await revokeChatBetaAccess({ email: command.email, store: prisma })

    console.log(
      result.status === "granted"
        ? "Chat beta access granted and audited."
        : result.status === "restored"
          ? "Chat beta access restored and audited."
          : result.status === "revoked"
            ? "Chat beta access revoked and audited."
            : result.status === "already-granted"
              ? "Chat beta access was already active; no change was made."
              : "Chat beta access was already inactive; no change was made."
    )
  } finally {
    await prisma.$disconnect()
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "Chat beta access update failed.")
  process.exitCode = 1
})
