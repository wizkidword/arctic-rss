import { PrismaPg } from "@prisma/adapter-pg"

import { PrismaClient } from "../generated/prisma/client"
import { getDatabaseConnectionSettings } from "./database-connection-settings"
import { createDatabasePool } from "./database-pool"

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient
}

export function getPrisma(connectionString = process.env.DATABASE_URL) {
  if (!globalForPrisma.prisma) {
    if (!connectionString) {
      throw new Error("DATABASE_URL is required before opening a database connection.")
    }

    const settings = getDatabaseConnectionSettings()
    const pool = createDatabasePool({ connectionString, settings })
    const adapter = new PrismaPg(pool, { disposeExternalPool: true })
    globalForPrisma.prisma = new PrismaClient({
      adapter,
      ...(process.env.NODE_ENV !== "production" &&
      process.env.ARCTIC_RSS_QUERY_LOGGING === "1"
        ? { log: [{ emit: "event" as const, level: "query" as const }] }
        : {}),
    })
  }

  return globalForPrisma.prisma
}
