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
  to: string
}

type MailResult =
  | { status: "sent" }
  | { status: "not-configured"; url?: string }

function parseSmtpPort() {
  const rawPort = process.env.SMTP_PORT

  if (!rawPort) {
    return process.env.SMTP_SECURE === "true" ? 465 : 587
  }

  const port = Number(rawPort)
  return Number.isFinite(port) ? port : 587
}

function getSmtpTransport() {
  const host = process.env.SMTP_HOST
  const user = process.env.SMTP_USER
  const pass = process.env.SMTP_PASSWORD

  if (!host || !user || !pass) {
    return null
  }

  return nodemailer.createTransport({
    host,
    port: parseSmtpPort(),
    secure: process.env.SMTP_SECURE === "true",
    auth: { user, pass },
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
    if (process.env.NODE_ENV !== "production") {
      console.info(`Password reset link for ${to}: ${resetUrl}`)
    }

    return { status: "not-configured", url: resetUrl }
  }

  await transport.sendMail({
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
  })

  return { status: "sent" }
}

export async function sendEmailVerificationEmail({
  to,
  verificationUrl,
}: EmailVerificationInput): Promise<MailResult> {
  const transport = getSmtpTransport()

  if (!transport) {
    if (process.env.NODE_ENV !== "production") {
      console.info(`Email verification link for ${to}: ${verificationUrl}`)
    }

    return { status: "not-configured", url: verificationUrl }
  }

  await transport.sendMail({
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
  })

  return { status: "sent" }
}

export async function sendWelcomeEmail({
  to,
}: WelcomeEmailInput): Promise<MailResult> {
  const transport = getSmtpTransport()

  if (!transport) {
    if (process.env.NODE_ENV !== "production") {
      console.info(`Welcome email would be sent to ${to}`)
    }

    return { status: "not-configured" }
  }

  await transport.sendMail({
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
  })

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
    if (process.env.NODE_ENV !== "production") {
      console.info(`Admin signup notification would be sent to ${to}`)
    }

    return { status: "not-configured" }
  }

  await transport.sendMail({
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
  })

  return { status: "sent" }
}

export async function sendSmartDigestEmail({
  digest,
  to,
}: SmartDigestEmailInput): Promise<MailResult> {
  const transport = getSmtpTransport()

  if (!transport) {
    if (process.env.NODE_ENV !== "production") {
      console.info(`Smart Digest email would be sent to ${to}`)
    }

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

  await transport.sendMail({
    from: getMailFrom(),
    html,
    subject: digest.title,
    text,
    to,
  })

  return { status: "sent" }
}
