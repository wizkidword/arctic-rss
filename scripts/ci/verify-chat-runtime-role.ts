import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import { randomBytes, randomUUID } from "node:crypto"
import { readFileSync } from "node:fs"
import path from "node:path"

import { PrismaPg } from "@prisma/adapter-pg"

import { PrismaClient } from "../../src/generated/prisma/client"
import { revalidateChatGatewayAuthorization } from "../../src/lib/chat/gateway-auth"
import {
  getChatRoomSnapshot,
  sendChatRoomMessage,
  updateChatReadMarker,
} from "../../src/lib/chat/room-service"

const postgresImage =
  "postgres:17.10-alpine3.23@sha256:8189a1f6e40904781fc9e2612687877791d21679866db58b1de996b31fc312e4"
const suffix = `${process.pid}-${randomUUID().replaceAll("-", "").slice(0, 12)}`
const containerName = `arctic-rss-chat-role-${suffix}`
const databaseName = "arctic_rss"
const adminPassword = randomBytes(24).toString("base64url")
const chatPassword = randomBytes(24).toString("base64url")
const chatRole = "arctic_chat"
const bootstrapScript = readFileSync(
  path.join(process.cwd(), "ops", "postgres", "bootstrap-chat-runtime-role.sql"),
  "utf8"
)

async function main() {
  let adminDatabase: PrismaClient | undefined
  let chatDatabase: PrismaClient | undefined

  try {
    docker(
      [
        "run",
        "-d",
        "--rm",
        "--name",
        containerName,
        "-e",
        `POSTGRES_DB=${databaseName}`,
        "-e",
        "POSTGRES_USER=postgres",
        "-e",
        `POSTGRES_PASSWORD=${adminPassword}`,
        "-p",
        "127.0.0.1::5432",
        postgresImage,
      ],
      "starting the disposable PostgreSQL fixture"
    )
    await waitForDatabase()

    const adminUrl = databaseUrl("postgres", adminPassword)
    runPrismaMigrations(adminUrl)
    applyBootstrap()
    applyBootstrap()

    adminDatabase = createDatabaseClient(adminUrl)
    chatDatabase = createDatabaseClient(databaseUrl(chatRole, chatPassword))
    const fixture = await createFixture(adminDatabase)

    await revalidateChatGatewayAuthorization({
      environment: { ARCTIC_IRC_ENABLED: "true" },
      identity: {
        authVersion: 0,
        authorizedAt: new Date().toISOString(),
        chatEnabled: true,
        emailVerified: true,
        handle: "northernlights",
        plan: "FREE",
        policyVersion: "launch-policy-v1",
        profileId: fixture.profileId,
        role: "USER",
        userId: fixture.userId,
      },
      store: chatDatabase,
    })

    const snapshot = await getChatRoomSnapshot({
      identity: { role: "USER", userId: fixture.userId },
      slug: fixture.roomSlug,
      store: chatDatabase,
    })
    assert.equal(snapshot.room.id, fixture.roomId, "Chat role must read the room snapshot.")

    const sent = await sendChatRoomMessage({
      body: "Restricted role message",
      clientMessageId: "role-test-message-0001",
      identity: { role: "USER", userId: fixture.userId },
      roomId: fixture.roomId,
      store: chatDatabase,
    })
    assert.equal(sent.created, true, "Chat role must create a normal message and outbox event.")

    await updateChatReadMarker({
      identity: { role: "USER", userId: fixture.userId },
      messageId: sent.message.id,
      roomId: fixture.roomId,
      store: chatDatabase,
    })

    await chatDatabase.$queryRawUnsafe(
      'SELECT "id", "feedId", "title" FROM public."Article" LIMIT 0'
    )
    await chatDatabase.$queryRawUnsafe(
      'SELECT "id", "title" FROM public."Feed" LIMIT 0'
    )

    await assertDenied(
      () => chatDatabase!.$queryRawUnsafe('SELECT "contentHtml" FROM public."Article" LIMIT 0'),
      "Article bodies"
    )
    await assertDenied(
      () => chatDatabase!.$queryRawUnsafe('SELECT "passwordHash" FROM public."User" LIMIT 0'),
      "Password hashes"
    )
    await assertDenied(
      () => chatDatabase!.$queryRawUnsafe('SELECT * FROM public."PasswordResetToken" LIMIT 0'),
      "Password-reset tokens"
    )
    await assertDenied(
      () => chatDatabase!.$queryRawUnsafe('SELECT * FROM public."AccountDeletionConfirmationToken" LIMIT 0'),
      "Account-deletion tokens"
    )
    await assertDenied(
      () => chatDatabase!.$queryRawUnsafe('SELECT * FROM public."AiUsageLog" LIMIT 0'),
      "AI usage data"
    )
    await assertDenied(
      () => chatDatabase!.$executeRawUnsafe('UPDATE public."User" SET "plan" = \'PRO\' WHERE false'),
      "Plan changes"
    )
    await assertDenied(
      () => chatDatabase!.$executeRawUnsafe('UPDATE public."User" SET "role" = \'ADMIN\' WHERE false'),
      "Role changes"
    )
    await assertDenied(
      () => chatDatabase!.$queryRawUnsafe('SELECT * FROM public."ChatReport" LIMIT 0'),
      "Chat reports outside the gateway path"
    )
    await assertDenied(
      () => chatDatabase!.$executeRawUnsafe('CREATE TABLE public.chat_role_ddl_probe (id integer)'),
      "Schema DDL"
    )

    process.stdout.write("Chat runtime database role allowed and denied SQL behavior verified.\n")
  } finally {
    await Promise.allSettled([
      adminDatabase?.$disconnect() ?? Promise.resolve(),
      chatDatabase?.$disconnect() ?? Promise.resolve(),
    ])
    tryDocker(["rm", "-f", containerName])
  }
}

function createDatabaseClient(connectionString: string) {
  return new PrismaClient({ adapter: new PrismaPg({ connectionString }) })
}

function databaseUrl(username: string, password: string) {
  const port = docker(["port", containerName, "5432/tcp"], "reading the disposable PostgreSQL port")
    .trim()
    .match(/:(\d+)$/)?.[1]

  if (!port) {
    throw new Error("Could not resolve the disposable PostgreSQL port.")
  }

  return `postgresql://${username}:${password}@127.0.0.1:${port}/${databaseName}?schema=public`
}

function runPrismaMigrations(connectionString: string) {
  const cli = path.join(process.cwd(), "node_modules", "prisma", "build", "index.js")
  execute(
    process.execPath,
    [cli, "migrate", "deploy"],
    { DATABASE_URL: connectionString },
    "applying migrations to the disposable PostgreSQL fixture"
  )
}

function applyBootstrap() {
  docker(
    [
      "exec",
      "-i",
      containerName,
      "psql",
      "-X",
      "-v",
      "ON_ERROR_STOP=1",
      "-v",
      `chat_role=${chatRole}`,
      "-v",
      `chat_password=${chatPassword}`,
      "-U",
      "postgres",
      "-d",
      databaseName,
    ],
    "applying the chat runtime role bootstrap",
    bootstrapScript
  )
}

async function createFixture(database: PrismaClient) {
  const userId = `chat-role-user-${suffix}`
  const profileId = `chat-role-profile-${suffix}`
  const roomId = `chat-role-room-${suffix}`
  const roomSlug = `role-room-${suffix}`
  const memberId = `chat-role-member-${suffix}`
  const now = new Date()

  await database.user.create({
    data: {
      email: `chat-role-${suffix}@example.test`,
      emailVerified: now,
      id: userId,
    },
  })
  await database.chatProfile.create({
    data: {
      handle: "northernlights",
      handleNormalized: "northernlights",
      id: profileId,
      userId,
    },
  })
  await database.chatPolicyAcceptance.create({
    data: {
      ageAttestedAt: now,
      communityAcceptedAt: now,
      policyVersion: "launch-policy-v1",
      privacyAcceptedAt: now,
      termsAcceptedAt: now,
      userId,
    },
  })
  await database.chatRoom.create({
    data: {
      description: "Disposable chat role verification room",
      id: roomId,
      name: "Chat role verification",
      slug: roomSlug,
    },
  })
  await database.chatRoomMember.create({
    data: { id: memberId, roomId, userId },
  })

  return { profileId, roomId, roomSlug, userId }
}

async function waitForDatabase() {
  const deadline = Date.now() + 45_000

  while (Date.now() < deadline) {
    const result = tryDocker([
      "exec",
      containerName,
      "pg_isready",
      "-U",
      "postgres",
      "-d",
      databaseName,
    ])
    if (result.status === 0) {
      return
    }
    await new Promise((resolve) => setTimeout(resolve, 250))
  }

  throw new Error("Timed out waiting for the disposable PostgreSQL fixture.")
}

async function assertDenied(action: () => Promise<unknown>, description: string) {
  let allowed = false

  try {
    await action()
    allowed = true
  } catch {
    // PostgreSQL rejected the ungranted statement as required.
  }

  assert.equal(allowed, false, `${description} must be denied to the chat runtime role.`)
}

function docker(arguments_: string[], action: string, input?: string) {
  const result = tryDocker(arguments_, input)

  if (result.status !== 0) {
    throw new Error(`Docker failed while ${action}.`)
  }

  return result.stdout
}

function tryDocker(arguments_: string[], input?: string) {
  return spawnSync("docker", arguments_, {
    encoding: "utf8",
    input,
    stdio: ["pipe", "pipe", "pipe"],
  })
}

function execute(
  command: string,
  arguments_: string[],
  environment: Record<string, string>,
  action: string
) {
  const result = spawnSync(command, arguments_, {
    cwd: process.cwd(),
    encoding: "utf8",
    env: { ...process.env, ...environment },
    stdio: ["ignore", "pipe", "pipe"],
  })

  if (result.status !== 0) {
    throw new Error(`Command failed while ${action}.`)
  }
}

void main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : "Chat role verification failed."}\n`)
  process.exitCode = 1
})
