import { z } from "zod"

import { apiV1IdentifierSchema, apiV1SuccessSchema, apiV1TimestampSchema } from "./common"

export const notificationTopicSchema = z.enum([
  "SECURITY_ALERTS",
  "SAVED_MONITOR_MATCHES",
  "SMART_DIGEST_COMPLETION",
  "CHAT_MENTIONS",
])

export const notificationChannelSchema = z.enum([
  "IN_APP",
  "EMAIL",
  "MOBILE_PUSH",
  "DISABLED",
])

export const notificationPreferenceSchema = z
  .object({
    channel: notificationChannelSchema,
    topic: notificationTopicSchema,
    updatedAt: apiV1TimestampSchema,
  })
  .strict()

export const notificationPreferencesResponseSchema = apiV1SuccessSchema(
  z.object({ preferences: z.array(notificationPreferenceSchema) }).strict()
)

export const notificationPreferenceUpdateRequestSchema = z
  .object({ channel: notificationChannelSchema })
  .strict()

export const notificationPreferenceUpdateResponseSchema = apiV1SuccessSchema(
  notificationPreferenceSchema.extend({ replayed: z.boolean() })
)

export const deviceInstallationRequestSchema = z
  .object({
    environment: z.enum(["development", "preview", "production"]),
    pushToken: z.string().trim().min(32).max(4096),
  })
  .strict()

export const deviceInstallationUnregisterRequestSchema = z
  .object({ pushToken: z.string().trim().min(32).max(4096) })
  .strict()

export const deviceInstallationResultSchema = z
  .object({
    installationId: apiV1IdentifierSchema,
    lastSeenAt: apiV1TimestampSchema,
    replayed: z.boolean(),
    status: z.enum(["ACTIVE", "DISABLED"]),
  })
  .strict()

export const deviceInstallationResponseSchema = apiV1SuccessSchema(
  deviceInstallationResultSchema
)

export type NotificationChannel = z.infer<typeof notificationChannelSchema>
export type NotificationTopic = z.infer<typeof notificationTopicSchema>
