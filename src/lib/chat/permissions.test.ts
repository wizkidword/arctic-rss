import { describe, expect, it } from "vitest"

import {
  CHAT_ACTIONS,
  CHAT_ROOM_MEMBER_ROLES,
  canPerformChatAction,
  type ChatAction,
  type ChatPermissionContext,
  type ChatRoomMemberRole,
} from "./permissions"

const baseContext: ChatPermissionContext = {
  chatEnabled: true,
  emailVerified: true,
  globalRole: "USER",
  roomMemberStatus: "ACTIVE",
  roomState: "ACTIVE",
}

const allowedActionsByRole: Record<ChatRoomMemberRole, readonly ChatAction[]> = {
  ADMIN: [
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
  ],
  MEMBER: [
    "VIEW_PUBLIC_DIRECTORY",
    "VIEW_PUBLIC_ROOM",
    "JOIN_OPEN_ROOM",
    "READ_MEMBER_HISTORY",
    "POST_MESSAGE",
  ],
  OPERATOR: [
    "VIEW_PUBLIC_DIRECTORY",
    "VIEW_PUBLIC_ROOM",
    "JOIN_OPEN_ROOM",
    "READ_MEMBER_HISTORY",
    "POST_MESSAGE",
    "UPDATE_TOPIC",
    "SET_ROOM_MODE",
    "KICK_MEMBER",
    "BAN_MEMBER",
    "MUTE_MEMBER",
    "REMOVE_MESSAGE",
  ],
  OWNER: [
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
  ],
  VOICE: [
    "VIEW_PUBLIC_DIRECTORY",
    "VIEW_PUBLIC_ROOM",
    "JOIN_OPEN_ROOM",
    "READ_MEMBER_HISTORY",
    "POST_MESSAGE",
  ],
}

describe("chat permissions", () => {
  it("enforces the complete room-role permission matrix", () => {
    for (const roomRole of CHAT_ROOM_MEMBER_ROLES) {
      for (const action of CHAT_ACTIONS) {
        expect(
          canPerformChatAction(action, { ...baseContext, roomRole })
        ).toBe(allowedActionsByRole[roomRole].includes(action))
      }
    }
  })

  it("requires active membership for member-only operations", () => {
    expect(
      canPerformChatAction("POST_MESSAGE", {
        ...baseContext,
        roomMemberStatus: "LEFT",
        roomRole: "MEMBER",
      })
    ).toBe(false)
    expect(
      canPerformChatAction("READ_MEMBER_HISTORY", {
        ...baseContext,
        roomRole: undefined,
      })
    ).toBe(false)
  })

  it("does not allow ordinary users to post to a non-active room", () => {
    expect(
      canPerformChatAction("POST_MESSAGE", {
        ...baseContext,
        roomRole: "MEMBER",
        roomState: "READ_ONLY",
      })
    ).toBe(false)
  })

  it("prevents non-admin access to suspended rooms while retaining admin review access", () => {
    expect(
      canPerformChatAction("READ_MEMBER_HISTORY", {
        ...baseContext,
        roomRole: "MEMBER",
        roomState: "SUSPENDED",
      })
    ).toBe(false)
    expect(
      canPerformChatAction("READ_MEMBER_HISTORY", {
        chatEnabled: true,
        emailVerified: true,
        globalRole: "ADMIN",
        roomState: "SUSPENDED",
      })
    ).toBe(true)
  })

  it("fails closed when the feature, account, or verification state is ineligible", () => {
    for (const context of [
      { ...baseContext, chatEnabled: false },
      { ...baseContext, accountDisabled: true },
      { ...baseContext, emailVerified: false },
    ]) {
      expect(canPerformChatAction("VIEW_PUBLIC_DIRECTORY", context)).toBe(false)
      expect(canPerformChatAction("POST_MESSAGE", context)).toBe(false)
    }
  })

  it("permits existing administrators while the feature is enabled", () => {
    for (const action of CHAT_ACTIONS) {
      expect(
        canPerformChatAction(action, {
          chatEnabled: true,
          emailVerified: true,
          globalRole: "ADMIN",
        })
      ).toBe(true)
    }
  })
})
