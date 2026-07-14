import { getPrisma } from "../src/lib/db"
import { bootstrapOfficialChatRooms } from "../src/lib/chat/official-rooms"

async function main() {
  const rooms = await bootstrapOfficialChatRooms({ store: getPrisma() })

  console.log(
    `Bootstrapped ${rooms.length} official Arctic IRC rooms: ${rooms
      .map((room) => `#${room.slug}`)
      .join(", ")}`
  )
}

main().catch((error: unknown) => {
  console.error(
    error instanceof Error
      ? `Official chat-room bootstrap failed: ${error.message}`
      : "Official chat-room bootstrap failed."
  )
  process.exitCode = 1
})
