import { auth } from "@/auth"
import { buildOpmlDocument, listOpmlExportSubscriptions } from "@/lib/opml"

export async function GET() {
  const session = await auth()

  if (!session?.user?.id) {
    return new Response("Unauthorized", { status: 401 })
  }

  const subscriptions = await listOpmlExportSubscriptions(session.user.id)
  const opml = buildOpmlDocument({
    ownerName: session.user.name || session.user.email,
    subscriptions,
  })

  return new Response(opml, {
    headers: {
      "Content-Disposition": 'attachment; filename="arctic-rss-subscriptions.opml"',
      "Content-Type": "text/x-opml; charset=utf-8",
    },
  })
}
