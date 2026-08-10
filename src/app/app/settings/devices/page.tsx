import { SmartphoneIcon } from "lucide-react"
import Link from "next/link"
import { redirect } from "next/navigation"

import { auth } from "@/auth"
import { requireFreshUser } from "@/lib/authorization"
import { listMobileDeviceSessions } from "@/lib/mobile-auth"

import {
  revokeAllMobileDeviceSessionsAction,
  revokeMobileDeviceSessionAction,
} from "./actions"

export default async function MobileDevicesSettingsPage() {
  const session = await auth()
  if (!session?.user?.id) {
    redirect("/login")
  }

  const user = await requireFreshUser(session)
  const devices = await listMobileDeviceSessions({ userId: user.id })

  return (
    <div className="flex min-h-screen flex-col gap-4 p-3 sm:p-4 lg:p-6">
      <section className="flex flex-col gap-3 border-b pb-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex min-w-0 flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <SmartphoneIcon className="size-5 text-muted-foreground" />
            <h1 className="font-heading text-xl font-semibold">Mobile devices</h1>
          </div>
          <p className="max-w-2xl text-sm text-muted-foreground">
            Review mobile devices that can access your Arctic RSS account. Token values are
            never displayed.
          </p>
        </div>
        <Link className="text-sm text-primary underline-offset-4 hover:underline" href="/app/settings">
          Back to reader settings
        </Link>
      </section>

      <section className="rounded-lg border bg-card p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-heading text-base font-medium">Authorized mobile devices</h2>
            <p className="text-sm text-muted-foreground">
              Revoking a device ends its current access and refreshes immediately.
            </p>
          </div>
          <form action={revokeAllMobileDeviceSessionsAction}>
            <button
              className="rounded-md border border-destructive px-3 py-2 text-sm font-medium text-destructive disabled:cursor-not-allowed disabled:opacity-50"
              disabled={!devices.length}
              type="submit"
            >
              Revoke all mobile devices
            </button>
          </form>
        </div>

        {devices.length ? (
          <ul className="mt-4 divide-y rounded-md border">
            {devices.map((device) => (
              <li className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between" key={device.id}>
                <div className="min-w-0">
                  <p className="font-medium">{device.deviceName}</p>
                  <p className="text-sm text-muted-foreground">
                    {device.platform} · version {device.appVersion}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Last used {device.lastUsedAt.toLocaleString()}
                  </p>
                </div>
                <form action={revokeMobileDeviceSessionAction}>
                  <input name="sessionId" type="hidden" value={device.id} />
                  <button
                    className="rounded-md border px-3 py-2 text-sm font-medium hover:bg-muted"
                    type="submit"
                  >
                    Revoke device
                  </button>
                </form>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-4 rounded-md border border-dashed p-4 text-sm text-muted-foreground">
            No mobile devices are currently authorized.
          </p>
        )}
      </section>
    </div>
  )
}
