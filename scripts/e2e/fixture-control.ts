import { installFixtureNetworkHooks } from "./feed-fixture-network.cjs"

installFixtureNetworkHooks()

export {}

void main().then(
  () => process.exit(0),
  (error) => {
    console.error(error)
    process.exit(1)
  }
)

async function main() {
  const command = process.argv[2]

  if (command === "seed") {
    await seedE2eFixtures()
    process.stdout.write("seeded\n")
    return
  }

  if (command === "process-opml") {
    const email = process.argv[3]

    if (!email) {
      throw new Error("An E2E fixture email is required to process OPML.")
    }

    const result = await processLatestOpmlImportForUser(email)
    process.stdout.write(`${JSON.stringify(result)}\n`)
    return
  }

  throw new Error("Usage: fixture-control.ts <seed|process-opml> [email]")
}

async function seedE2eFixtures() {
  const [
    { getPrisma },
    { hashPassword },
    { createChatProfileForUser },
    { acceptChatPolicy },
  ] = await Promise.all([
    import("../../src/lib/db"),
    import("../../src/lib/password"),
    import("../../src/lib/chat/profiles"),
    import("../../src/lib/chat/policy-acceptance"),
  ])
  const prisma = getPrisma()
  const passwordHash = await hashPassword("E2E reader password 123!")
  const fixtureHost = process.env.ARCTIC_RSS_E2E_FEED_HOST ?? "feeds.e2e.arcticrss.test"
  const feedUrl = `http://${fixtureHost}`
  const fixtures = [
    ["admin", "admin@e2e.arcticrss.test", "E2E Admin"],
    ["oauth", "oauth@e2e.arcticrss.test", "E2E OAuth Reader"],
    ["opml", "opml@e2e.arcticrss.test", "E2E OPML Reader"],
    ["reader", "reader@e2e.arcticrss.test", "E2E Reader"],
    ["revoked", "revoked@e2e.arcticrss.test", "E2E Revoked Reader"],
    ["search", "search@e2e.arcticrss.test", "E2E Search Reader"],
    ["settings", "settings@e2e.arcticrss.test", "E2E Settings Reader"],
  ] as const
  const fixtureEmails = fixtures.map(([, email]) => email)

  await prisma.userPlanQuota.deleteMany({
    where: { user: { email: { in: fixtureEmails } } },
  })
  await prisma.user.deleteMany({ where: { email: { in: fixtureEmails } } })
  await prisma.feed.deleteMany({
    where: {
      feedUrl: {
        in: [
          `${feedUrl}/reader.xml`,
          `${feedUrl}/opml-a.xml`,
          `${feedUrl}/opml-b.xml`,
          `${feedUrl}/search.xml`,
        ],
      },
    },
  })

  const users = await Promise.all(
    fixtures.map(async ([key, email, name]) =>
      prisma.user.create({
        data: {
          email,
          emailVerified: new Date("2030-01-01T00:00:00.000Z"),
          name,
          passwordHash: key === "oauth" ? null : passwordHash,
          plan: key === "admin" ? "ADMIN" : "FREE",
          role: key === "admin" ? "ADMIN" : "USER",
        },
        select: { email: true, id: true },
      })
    )
  )
  const searchUser = users.find((user) => user.email === "search@e2e.arcticrss.test")

  if (!searchUser) {
    throw new Error("Search fixture user was not created.")
  }

  const revokedUser = users.find((user) => user.email === "revoked@e2e.arcticrss.test")

  if (!revokedUser) {
    throw new Error("Revocation fixture user was not created.")
  }

  await createChatProfileForUser({
    handle: "e2erevoked",
    store: prisma,
    userId: revokedUser.id,
  })
  await acceptChatPolicy({ store: prisma, userId: revokedUser.id })

  const searchFeed = await prisma.feed.create({
    data: {
      feedUrl: `${feedUrl}/search.xml`,
      title: "E2E Search Feed",
    },
  })
  await prisma.feedSubscription.create({
    data: { feedId: searchFeed.id, userId: searchUser.id },
  })
  await prisma.article.create({
    data: {
      contentText: "A deterministic article used only for E2E search coverage.",
      externalId: "e2e-search-result",
      feedId: searchFeed.id,
      publishedAt: new Date("2030-01-01T00:00:00.000Z"),
      title: "E2E Search Phrase Result",
      url: `${feedUrl}/articles/search-result`,
    },
  })

  await prisma.$disconnect()
}

async function processLatestOpmlImportForUser(email: string) {
  const [{ getPrisma }, { processOpmlImportJob }] = await Promise.all([
    import("../../src/lib/db"),
    import("../../src/lib/opml-import-jobs"),
  ])
  const prisma = getPrisma()
  const user = await prisma.user.findUnique({
    select: { id: true },
    where: { email },
  })

  if (!user) {
    throw new Error(`Missing E2E fixture user ${email}.`)
  }

  const job = await prisma.importJob.findFirst({
    orderBy: { createdAt: "desc" },
    select: { id: true },
    where: { userId: user.id },
  })

  if (!job) {
    throw new Error(`No OPML job was queued for ${email}.`)
  }

  const result = await processOpmlImportJob({ jobId: job.id })
  await prisma.$disconnect()
  return result
}
