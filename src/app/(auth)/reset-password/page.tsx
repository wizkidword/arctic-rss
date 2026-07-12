import { ResetPasswordForm } from "./reset-password-form"

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string | string[] }>
}) {
  const params = await searchParams
  const token = Array.isArray(params.token)
    ? params.token[0] ?? ""
    : params.token ?? ""

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <ResetPasswordForm token={token} />
    </main>
  )
}
