"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"

import { requireFreshUser } from "@/lib/authorization"
import {
  revokeAllMobileDeviceSessions,
  revokeMobileDeviceSession,
} from "@/lib/mobile-auth"

const sessionIdSchema = z.string().min(20).max(128)

export async function revokeMobileDeviceSessionAction(formData: FormData) {
  const parsed = sessionIdSchema.safeParse(formData.get("sessionId"))
  if (!parsed.success) {
    return
  }

  const user = await requireFreshUser()
  await revokeMobileDeviceSession({ sessionId: parsed.data, userId: user.id })
  revalidatePath("/app/settings/devices")
}

export async function revokeAllMobileDeviceSessionsAction() {
  const user = await requireFreshUser()
  await revokeAllMobileDeviceSessions({ userId: user.id })
  revalidatePath("/app/settings/devices")
}
