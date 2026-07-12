import { getPrisma } from "./db"
import { sendAdminSignupNotificationEmail } from "./mail"

export type RegistrationSource = "credentials" | "google"

export type NewRegistrationNotification = {
  email: string
  name: string | null
  registeredAt: Date
  source: RegistrationSource
  userId: string
}

type AdminNotificationStore = {
  user: {
    findMany(args: Record<string, unknown>): Promise<Array<{ email: string }>>
  }
}

type NotificationDependencies = {
  sendAdminSignupNotificationEmail?: typeof sendAdminSignupNotificationEmail
  store?: AdminNotificationStore
}

export async function notifyAdminsOfNewRegistration(
  notification: NewRegistrationNotification,
  dependencies: NotificationDependencies = {}
) {
  const store =
    dependencies.store ??
    (getPrisma() as unknown as AdminNotificationStore)
  const sendNotification =
    dependencies.sendAdminSignupNotificationEmail ??
    sendAdminSignupNotificationEmail

  const adminRecipients = await store.user.findMany({
    orderBy: {
      createdAt: "asc",
    },
    select: {
      email: true,
    },
    where: {
      disabledAt: null,
      role: "ADMIN",
    },
  })
  const recipientEmails = Array.from(
    new Set(
      adminRecipients
        .map((recipient) => recipient.email.trim().toLowerCase())
        .filter(Boolean)
    )
  )

  if (!recipientEmails.length) {
    return {
      recipientCount: 0,
      status: "skipped" as const,
    }
  }

  await Promise.all(
    recipientEmails.map((to) =>
      sendNotification({
        registeredAt: notification.registeredAt,
        source: notification.source,
        to,
        userEmail: notification.email,
        userName: notification.name,
      })
    )
  )

  return {
    recipientCount: recipientEmails.length,
    status: "sent" as const,
  }
}
