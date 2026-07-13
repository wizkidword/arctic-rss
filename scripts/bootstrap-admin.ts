import "dotenv/config"

import { promoteVerifiedUserToAdmin } from "../src/lib/admin-bootstrap"
import { getPrisma } from "../src/lib/db"

function parseEmailArgument(argumentsList: string[]) {
  if (argumentsList.length !== 2 || argumentsList[0] !== "--email") {
    throw new Error("Usage: npm run admin:bootstrap -- --email <verified-email>")
  }

  return argumentsList[1]
}

async function main() {
  const email = parseEmailArgument(process.argv.slice(2))
  const prisma = getPrisma()

  try {
    const result = await promoteVerifiedUserToAdmin({ email, store: prisma })

    console.log(
      result.status === "promoted"
        ? "Administrator role granted and audited."
        : "Account is already an administrator; no change was made."
    )
  } finally {
    await prisma.$disconnect()
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "Admin bootstrap failed.")
  process.exitCode = 1
})
