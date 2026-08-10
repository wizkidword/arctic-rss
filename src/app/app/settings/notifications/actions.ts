"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"

import { requireFreshUser } from "@/lib/authorization"
import {
  MOBILE_NOTIFICATION_CHANNELS,
  MOBILE_NOTIFICATION_TOPICS,
  updateNotificationPreferenceForUser,
} from "@/lib/mobile-sync"

const preferenceSchema = z.object({
  channel: z.enum(MOBILE_NOTIFICATION_CHANNELS),
  topic: z.enum(MOBILE_NOTIFICATION_TOPICS),
})

export async function updateNotificationPreferenceAction(formData: FormData) {
  const parsed = preferenceSchema.safeParse({
    channel: formData.get("channel"),
    topic: formData.get("topic"),
  })
  if (!parsed.success) {
    return
  }
  const user = await requireFreshUser()
  await updateNotificationPreferenceForUser({ ...parsed.data, userId: user.id })
  revalidatePath("/app/settings/notifications")
}
