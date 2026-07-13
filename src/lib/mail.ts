import nodemailer from "nodemailer"

type PasswordResetEmailInput = {
  to: string
  resetUrl: string
}

type EmailVerificationInput = {
  to: string
  verificationUrl: string
}

type WelcomeEmailInput = {
  to: string
}

type AdminSignupNotificationInput = {
  registeredAt: Date
  source: string
  to: string
  userEmail: string
  userName: string | null
}

type SmartDigestEmailInput = {
  digest: {
    articleCount: number
    id: string
    items: Array<{
      articleTitle: string
      articleUrl: string
      feedTitle: string
      matchedTerms: string[]
      publishedAt: Date | null
      reason: string
      summary: string
    }>
    title: string
    topicPrompt: string
  }
  messageId?: string
  to: string
}

type MailResult =
  | { providerMessageId?: string; status: "sent" }
  | { status: "not-configured"; url?: string }

export type SmartDigestMailResult = MailResult

type SmtpTransport = {
  close(): void
  sendMail(message: nodemailer.SendMailOptions): Promise<{ messageId?: string }>
}

let cachedSmtpTransport: SmtpTransport | undefined
let smtpTransportFingerprint: string | undefined

function parseSmtpPort() {
  const rawPort = process.env.SMTP_PORT

  if (!rawPort) {
    return process.env.SMTP_SECURE === "true" ? 465 : 587
  }

  const port = Number(rawPort)
  return Number.isFinite(port) ? port : 587
}

function parseSmtpTimeout(variable: string, fallback: number) {
  const parsed = Number(process.env[variable])

  if (!Number.isFinite(parsed)) {
    return fallback
  }

  return Math.min(120_000, Math.max(1_000, Math.round(parsed)))
}

function parseSmtpPoolMaxConnections() {
  const parsed = Number(process.env.SMTP_POOL_MAX_CONNECTIONS)

  if (!Number.isFinite(parsed)) {
    return 2
  }

  return Math.min(5, Math.max(1, Math.round(parsed)))
}

export function resetSmtpTransportCache() {
  const transport = cachedSmtpTransport
  cachedSmtpTransport = undefined
  smtpTransportFingerprint = undefined

  try {
    transport?.close?.()
  } catch {
    // A new connection can still be created for the current configuration.
  }
}

function getSmtpTransport() {
  const host = process.env.SMTP_HOST
  const user = process.env.SMTP_USER
  const pass = process.env.SMTP_PASSWORD

  if (!host || !user || !pass) {
    resetSmtpTransportCache()
    return null
  }

  const port = parseSmtpPort()
  const secure = process.env.SMTP_SECURE === "true"
  const connectionTimeout = parseSmtpTimeout("SMTP_CONNECTION_TIMEOUT_MS", 10_000)
  const greetingTimeout = parseSmtpTimeout("SMTP_GREETING_TIMEOUT_MS", 10_000)
  const socketTimeout = parseSmtpTimeout("SMTP_SOCKET_TIMEOUT_MS", 30_000)
  const maxConnections = parseSmtpPoolMaxConnections()
  const fingerprint = [
    host,
    port,
    secure,
    user,
    pass,
    connectionTimeout,
    greetingTimeout,
    socketTimeout,
    maxConnections,
  ].join("\u0000")

  if (cachedSmtpTransport && smtpTransportFingerprint === fingerprint) {
    return cachedSmtpTransport
  }

  resetSmtpTransportCache()
  const transport = nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass },
    connectionTimeout,
    greetingTimeout,
    socketTimeout,
    maxConnections,
    pool: true,
  })
  cachedSmtpTransport = transport
  smtpTransportFingerprint = fingerprint

  return transport
}

function sendMailWithDeadline<T>(operation: Promise<T>) {
  const timeoutMs = parseSmtpTimeout("SMTP_SEND_TIMEOUT_MS", 45_000)

  return new Promise<T>((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error("SMTP send timed out."))
    }, timeoutMs)

    operation.then(
      (result) => {
        clearTimeout(timeout)
        resolve(result)
      },
      (error) => {
        clearTimeout(timeout)
        reject(error)
      }
    )
  })
}

function getMailFrom() {
  const smtpFrom = process.env.SMTP_FROM?.trim()

  if (smtpFrom) {
    return smtpFrom
  }

  const smtpUser = process.env.SMTP_USER?.trim()
  return smtpUser
    ? `Arctic RSS <${smtpUser}>`
    : "Arctic RSS <no-reply@arcticrss.com>"
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;")
}

function formatRegistrationSource(source: string) {
  if (source === "credentials") {
    return "Email and password"
  }

  if (source === "google") {
    return "Google"
  }

  return source
}

function groupDigestItemsByFeed<
  T extends { feedTitle: string; publishedAt: Date | null },
>(items: T[]) {
  const groups = new Map<string, T[]>()

  for (const item of items) {
    const existing = groups.get(item.feedTitle) ?? []
    existing.push(item)
    groups.set(item.feedTitle, existing)
  }

  return Array.from(groups.entries()).map(([feedTitle, groupedItems]) => [
    feedTitle,
    groupedItems.sort(
      (left, right) =>
        (right.publishedAt?.getTime() ?? 0) -
        (left.publishedAt?.getTime() ?? 0)
    ),
  ] as const)
}

export function isPasswordResetEmailConfigured() {
  return isTransactionalEmailConfigured()
}

export function isTransactionalEmailConfigured() {
  return Boolean(
    process.env.SMTP_HOST?.trim() &&
      process.env.SMTP_USER?.trim() &&
      process.env.SMTP_PASSWORD?.trim()
  )
}

export async function sendPasswordResetEmail({
  to,
  resetUrl,
}: PasswordResetEmailInput): Promise<MailResult> {
  const transport = getSmtpTransport()

  if (!transport) {
    return { status: "not-configured", url: resetUrl }
  }

  await sendMailWithDeadline(transport.sendMail({
    from: getMailFrom(),
    to,
    subject: "Reset your Arctic RSS password",
    text: [
      "Use the link below to reset your Arctic RSS password.",
      "",
      resetUrl,
      "",
      "This link expires in 1 hour. If you did not request it, you can ignore this email.",
    ].join("\n"),
    html: [
      "<p>Use the link below to reset your Arctic RSS password.</p>",
      `<p><a href="${resetUrl}">Reset your password</a></p>`,
      "<p>This link expires in 1 hour. If you did not request it, you can ignore this email.</p>",
    ].join(""),
  }))

  return { status: "sent" }
}

export async function sendEmailVerificationEmail({
  to,
  verificationUrl,
}: EmailVerificationInput): Promise<MailResult> {
  const transport = getSmtpTransport()

  if (!transport) {
    return { status: "not-configured", url: verificationUrl }
  }

  await sendMailWithDeadline(transport.sendMail({
    from: getMailFrom(),
    to,
    subject: "Verify your Arctic RSS email",
    text: [
      "Welcome to Arctic RSS.",
      "",
      "Use the link below to verify your email address and finish creating your account.",
      "",
      verificationUrl,
      "",
      "This link expires in 24 hours. If you did not create an Arctic RSS account, you can ignore this email.",
    ].join("\n"),
    html: [
      "<p>Welcome to Arctic RSS.</p>",
      "<p>Use the link below to verify your email address and finish creating your account.</p>",
      `<p><a href="${verificationUrl}">Verify your email</a></p>`,
      "<p>This link expires in 24 hours. If you did not create an Arctic RSS account, you can ignore this email.</p>",
    ].join(""),
  }))

  return { status: "sent" }
}

export async function sendWelcomeEmail({
  to,
}: WelcomeEmailInput): Promise<MailResult> {
  const transport = getSmtpTransport()

  if (!transport) {
    return { status: "not-configured" }
  }

  await sendMailWithDeadline(transport.sendMail({
    from: getMailFrom(),
    to,
    subject: "Welcome to Arctic RSS",
    text: [
      "Welcome to Arctic RSS.",
      "",
      "Your account is ready. You can now log in, add feeds, browse Discover, and start building your reader.",
      "",
      "Thanks for being here.",
    ].join("\n"),
    html: [
      "<p>Welcome to Arctic RSS.</p>",
      "<p>Your account is ready. You can now log in, add feeds, browse Discover, and start building your reader.</p>",
      "<p>Thanks for being here.</p>",
    ].join(""),
  }))

  return { status: "sent" }
}

export async function sendAdminSignupNotificationEmail({
  registeredAt,
  source,
  to,
  userEmail,
  userName,
}: AdminSignupNotificationInput): Promise<MailResult> {
  const transport = getSmtpTransport()
  const sourceLabel = formatRegistrationSource(source)
  const displayName = userName?.trim() || "Unnamed reader"

  if (!transport) {
    return { status: "not-configured" }
  }

  await sendMailWithDeadline(transport.sendMail({
    from: getMailFrom(),
    to,
    subject: `New Arctic RSS signup: ${userEmail}`,
    text: [
      "A new reader registered for Arctic RSS.",
      "",
      `Name: ${displayName}`,
      `Email: ${userEmail}`,
      `Signup method: ${sourceLabel}`,
      `Registered: ${registeredAt.toISOString()}`,
      "",
      "You can review recent users from the Arctic RSS admin dashboard.",
    ].join("\n"),
    html: [
      "<p>A new reader registered for Arctic RSS.</p>",
      "<ul>",
      `<li><strong>Name:</strong> ${escapeHtml(displayName)}</li>`,
      `<li><strong>Email:</strong> ${escapeHtml(userEmail)}</li>`,
      `<li><strong>Signup method:</strong> ${escapeHtml(sourceLabel)}</li>`,
      `<li><strong>Registered:</strong> ${escapeHtml(
        registeredAt.toISOString()
      )}</li>`,
      "</ul>",
      "<p>You can review recent users from the Arctic RSS admin dashboard.</p>",
    ].join(""),
  }))

  return { status: "sent" }
}

export async function sendSmartDigestEmail({
  digest,
  messageId,
  to,
}: SmartDigestEmailInput): Promise<MailResult> {
  const transport = getSmtpTransport()

  if (!transport) {
    return { status: "not-configured" }
  }

  const grouped = groupDigestItemsByFeed(digest.items)
  const text = [
    digest.title,
    "",
    digest.topicPrompt,
    "",
    `${digest.articleCount} matching articles`,
    "",
    ...grouped.flatMap(([feedTitle, items]) => [
      feedTitle,
      ...items.map((item) =>
        [
          `- ${item.articleTitle}`,
          `  ${item.summary}`,
          `  Matched: ${item.matchedTerms.join(", ")}`,
          `  ${item.reason}`,
          `  ${item.articleUrl}`,
        ].join("\n")
      ),
      "",
    ]),
  ].join("\n")
  const html = [
    `<h1>${escapeHtml(digest.title)}</h1>`,
    `<p>${escapeHtml(digest.topicPrompt)}</p>`,
    `<p>${digest.articleCount} matching articles</p>`,
    ...grouped.map(
      ([feedTitle, items]) =>
        `<h2>${escapeHtml(feedTitle)}</h2><ul>${items
          .map(
            (item) =>
              `<li><p><a href="${escapeHtml(
                item.articleUrl
              )}">${escapeHtml(item.articleTitle)}</a></p><p>${escapeHtml(
                item.summary
              )}</p><p><small>Matched: ${escapeHtml(
                item.matchedTerms.join(", ")
              )}</small></p><p><small>${escapeHtml(item.reason)}</small></p></li>`
          )
          .join("")}</ul>`
    ),
  ].join("")

  const result = await sendMailWithDeadline(transport.sendMail({
    from: getMailFrom(),
    html,
    ...(messageId ? { messageId } : {}),
    subject: digest.title,
    text,
    to,
  }))

  return {
    providerMessageId: result?.messageId || messageId,
    status: "sent",
  }
}
