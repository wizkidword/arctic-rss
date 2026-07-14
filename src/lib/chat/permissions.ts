export const CHAT_ROOM_MEMBER_ROLES = [
  "OWNER",
  "ADMIN",
  "OPERATOR",
  "VOICE",
  "MEMBER",
] as const

export const CHAT_ROOM_STATES = [
  "ACTIVE",
  "READ_ONLY",
  "ARCHIVED",
  "SUSPENDED",
] as const

export const CHAT_ACTIONS = [
  "VIEW_PUBLIC_DIRECTORY",
  "VIEW_PUBLIC_ROOM",
  "JOIN_OPEN_ROOM",
  "READ_MEMBER_HISTORY",
  "POST_MESSAGE",
  "UPDATE_TOPIC",
  "SET_ROOM_MODE",
  "INVITE_MEMBER",
  "MANAGE_ROOM",
  "KICK_MEMBER",
  "BAN_MEMBER",
  "MUTE_MEMBER",
  "REMOVE_MESSAGE",
  "VIEW_MODERATION_QUEUE",
  "MANAGE_REPORTS",
] as const

export type ChatRoomMemberRole = (typeof CHAT_ROOM_MEMBER_ROLES)[number]
export type ChatRoomState = (typeof CHAT_ROOM_STATES)[number]
export type ChatAction = (typeof CHAT_ACTIONS)[number]

export type ChatPermissionContext = {
  accountDisabled?: boolean
  chatEnabled: boolean
  emailVerified: boolean
  globalRole: "USER" | "ADMIN"
  roomMemberStatus?: "ACTIVE" | "LEFT" | "PENDING"
  roomRole?: ChatRoomMemberRole
  roomState?: ChatRoomState
}

const ROOM_MODERATOR_ROLES = new Set<ChatRoomMemberRole>([
  "OWNER",
  "ADMIN",
  "OPERATOR",
])

const ROOM_MANAGER_ROLES = new Set<ChatRoomMemberRole>(["OWNER", "ADMIN"])

export function canPerformChatAction(
  action: ChatAction,
  context: ChatPermissionContext
) {
  if (!isChatEligible(context)) {
    return false
  }

  if (context.roomState === "SUSPENDED" && context.globalRole !== "ADMIN") {
    return false
  }

  if (context.globalRole === "ADMIN") {
    return true
  }

  switch (action) {
    case "VIEW_PUBLIC_DIRECTORY":
    case "VIEW_PUBLIC_ROOM":
    case "JOIN_OPEN_ROOM":
      return true
    case "READ_MEMBER_HISTORY":
      return hasActiveMembership(context)
    case "POST_MESSAGE":
      return hasActiveMembership(context) && context.roomState === "ACTIVE"
    case "UPDATE_TOPIC":
    case "SET_ROOM_MODE":
      return hasActiveMembership(context) && isRoomModerator(context)
    case "INVITE_MEMBER":
    case "MANAGE_ROOM":
      return hasActiveMembership(context) && isRoomManager(context)
    case "KICK_MEMBER":
    case "BAN_MEMBER":
    case "MUTE_MEMBER":
    case "REMOVE_MESSAGE":
      return hasActiveMembership(context) && isRoomModerator(context)
    case "VIEW_MODERATION_QUEUE":
    case "MANAGE_REPORTS":
      return false
  }
}

export function isChatEligible(context: ChatPermissionContext) {
  return (
    context.chatEnabled &&
    context.emailVerified &&
    context.accountDisabled !== true
  )
}

function hasActiveMembership(context: ChatPermissionContext) {
  return context.roomMemberStatus === "ACTIVE" && Boolean(context.roomRole)
}

function isRoomModerator(context: ChatPermissionContext) {
  return context.roomRole ? ROOM_MODERATOR_ROLES.has(context.roomRole) : false
}

function isRoomManager(context: ChatPermissionContext) {
  return context.roomRole ? ROOM_MANAGER_ROLES.has(context.roomRole) : false
}
