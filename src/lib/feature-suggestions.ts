import { getPrisma } from "./db"

const MAX_TITLE_LENGTH = 120
const MAX_DESCRIPTION_LENGTH = 4000
const MAX_PAGE_URL_LENGTH = 500
const MAX_USER_AGENT_LENGTH = 500
const MAX_CONTACT_EMAIL_LENGTH = 320

type CreateFeatureSuggestionInput = {
  contactEmail?: string | null
  description: string
  pageUrl?: string | null
  title: string
  userAgent?: string | null
  userId: string
}

export type FeatureSuggestionStore = {
  featureSuggestion: {
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

export class FeatureSuggestionError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "FeatureSuggestionError"
  }
}

export async function createFeatureSuggestionForUser(
  input: CreateFeatureSuggestionInput
) {
  return createFeatureSuggestionForUserWithClient({
    ...input,
    store: getPrisma() as unknown as FeatureSuggestionStore,
  })
}

export async function createFeatureSuggestionForUserWithClient({
  contactEmail,
  description,
  pageUrl,
  store,
  title,
  userAgent,
  userId,
}: CreateFeatureSuggestionInput & {
  store: FeatureSuggestionStore
}) {
  const cleanTitle = requiredBoundedText(title, MAX_TITLE_LENGTH)
  const cleanDescription = requiredBoundedText(
    description,
    MAX_DESCRIPTION_LENGTH
  )

  if (!cleanTitle || !cleanDescription) {
    throw new FeatureSuggestionError("Describe the feature before sending it.")
  }

  return store.featureSuggestion.create({
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
