import { getPrisma } from "./db"

const MAX_TITLE_LENGTH = 120
const MAX_DESCRIPTION_LENGTH = 4000
const MAX_PAGE_URL_LENGTH = 500
const MAX_USER_AGENT_LENGTH = 500
const MAX_CONTACT_EMAIL_LENGTH = 320

type CreateBugReportInput = {
  contactEmail?: string | null
  description: string
  pageUrl?: string | null
  title: string
  userAgent?: string | null
  userId: string
}

export type BugReportStore = {
  bugReport: {
    create(args: {
      data: {
        contactEmail: string | null
        description: string
        pageUrl: string | null
        title: string
        userAgent: string | null
        userId: string
      }
      select: {
        id: true
      }
    }): Promise<{ id: string }>
  }
}

export class BugReportError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "BugReportError"
  }
}

export async function createBugReportForUser(input: CreateBugReportInput) {
  return createBugReportForUserWithClient({
    ...input,
    store: getPrisma() as unknown as BugReportStore,
  })
}

export async function createBugReportForUserWithClient({
  contactEmail,
  description,
  pageUrl,
  store,
  title,
  userAgent,
  userId,
}: CreateBugReportInput & {
  store: BugReportStore
}) {
  const cleanTitle = requiredBoundedText(title, MAX_TITLE_LENGTH)
  const cleanDescription = requiredBoundedText(
    description,
    MAX_DESCRIPTION_LENGTH
  )

  if (!cleanTitle || !cleanDescription) {
    throw new BugReportError("Describe the bug before sending it.")
  }

  return store.bugReport.create({
    data: {
      contactEmail: optionalBoundedText(contactEmail, MAX_CONTACT_EMAIL_LENGTH),
      description: cleanDescription,
      pageUrl: optionalBoundedText(pageUrl, MAX_PAGE_URL_LENGTH),
      title: cleanTitle,
      userAgent: optionalBoundedText(userAgent, MAX_USER_AGENT_LENGTH),
      userId,
    },
    select: {
      id: true,
    },
  })
}

function requiredBoundedText(value: string, maxLength: number) {
  const cleanValue = value.trim()

  return cleanValue ? cleanValue.slice(0, maxLength) : ""
}

function optionalBoundedText(
  value: string | null | undefined,
  maxLength: number
) {
  const cleanValue = value?.trim()

  return cleanValue ? cleanValue.slice(0, maxLength) : null
}
