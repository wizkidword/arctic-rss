import { PrismaPg } from "@prisma/adapter-pg"

import { PrismaClient } from "../generated/prisma/client"

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient
}

export function getPrisma(connectionString = process.env.DATABASE_URL) {
  if (!globalForPrisma.prisma) {
    if (!connectionString) {
      throw new Error("DATABASE_URL is required before opening a database connection.")
    }

    const adapter = new PrismaPg({ connectionString })
    globalForPrisma.prisma = new PrismaClient({ adapter })
  }

  return globalForPrisma.prisma
}
