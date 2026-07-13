import { Prisma, type PrismaClient } from "../generated/prisma/client"

type AdminBootstrapStore = Pick<PrismaClient, "$transaction">

type BootstrapTarget = {
  disabledAt: Date | null
  emailVerified: Date | null
  id: string
  role: "ADMIN" | "USER"
}

export class AdminBootstrapError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "AdminBootstrapError"
  }
}

export function normalizeAdminBootstrapEmail(value: string) {
  const email = value.trim().toLowerCase()

  if (!email || !email.includes("@")) {
    throw new AdminBootstrapError("A valid --email value is required.")
  }

  return email
}

export async function promoteVerifiedUserToAdmin({
  email,
  store,
}: {
  email: string
  store: AdminBootstrapStore
}): Promise<{ status: "already-admin" | "promoted" }> {
  const normalizedEmail = normalizeAdminBootstrapEmail(email)

  return store.$transaction(async (transaction) => {
    const matches = (await transaction.user.findMany({
      where: {
        email: {
          equals: normalizedEmail,
          mode: "insensitive",
        },
      },
      select: {
        disabledAt: true,
        emailVerified: true,
        id: true,
        role: true,
      },
    })) as BootstrapTarget[]

    if (matches.length === 0) {
      throw new AdminBootstrapError("No account matched the requested address.")
    }

    if (matches.length !== 1) {
      throw new AdminBootstrapError(
        "The requested address matched multiple accounts; no change was made."
      )
    }

    const target = matches[0]

    if (target.disabledAt) {
      throw new AdminBootstrapError(
        "The requested account is disabled; no change was made."
      )
    }

    if (!target.emailVerified) {
      throw new AdminBootstrapError(
        "The requested account must have a verified email; no change was made."
      )
    }

    if (target.role === "ADMIN") {
      return { status: "already-admin" as const }
    }

    const updated = await transaction.user.updateMany({
      data: {
        authVersion: { increment: 1 },
        plan: "ADMIN",
        role: "ADMIN",
      },
      where: {
        disabledAt: null,
        emailVerified: { not: null },
        id: target.id,
        role: "USER",
      },
    })

    if (updated.count !== 1) {
      throw new AdminBootstrapError(
        "The requested account changed during validation; no change was made."
      )
    }

    await transaction.adminAuditLog.create({
      data: {
        action: "ADMIN_BOOTSTRAP_PROMOTE",
        adminUserId: target.id,
        metadata: {
          source: "local-cli",
        } satisfies Prisma.InputJsonValue,
        targetId: target.id,
        targetType: "User",
      },
    })

    return { status: "promoted" as const }
  })
}
