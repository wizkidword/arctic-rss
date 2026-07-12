import { Badge } from "@/components/ui/badge"

export function AppPlaceholderPage({
  badge,
  message,
  title,
}: {
  badge: string
  message: string
  title: string
}) {
  return (
    <div className="flex min-h-screen flex-col gap-4 p-3 sm:p-4 lg:p-6">
      <section className="flex flex-col gap-3 rounded-lg border bg-card p-4">
        <div className="flex items-center gap-2">
          <h1 className="font-heading text-xl font-semibold">{title}</h1>
          <Badge variant="secondary">{badge}</Badge>
        </div>
        <p className="max-w-2xl text-sm text-muted-foreground">{message}</p>
      </section>
    </div>
  )
}
