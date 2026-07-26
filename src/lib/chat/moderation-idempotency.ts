import { createHash } from "node:crypto";

import type { Prisma, PrismaClient } from "@/generated/prisma/client";

import { withChatRecordLock } from "./record-lock";

const IDEMPOTENCY_KEY_PATTERN = /^[A-Za-z0-9._-]{16,128}$/;

export type ChatModerationIdempotency = {
  action: string;
  actorUserId: string;
  key: string;
  requestHash: string;
};

export class ChatModerationIdempotencyError extends Error {
  constructor(
    message: string,
    readonly code: "conflict" | "invalid-request",
  ) {
    super(message);
    this.name = "ChatModerationIdempotencyError";
  }
}

type ChatModerationIdempotencyStore = Pick<
  PrismaClient,
  "$executeRaw" | "$transaction" | "chatModerationAction"
>;

export function parseChatModerationIdempotencyKey(value: string | null) {
  const key = value?.trim() ?? "";

  if (!IDEMPOTENCY_KEY_PATTERN.test(key)) {
    throw new ChatModerationIdempotencyError(
      "A valid Idempotency-Key header is required for moderation changes.",
      "invalid-request",
    );
  }

  return key;
}

export function createChatModerationIdempotency({
  action,
  actorUserId,
  key,
  request,
}: {
  action: string;
  actorUserId: string;
  key: string;
  request: unknown;
}): ChatModerationIdempotency {
  return {
    action,
    actorUserId,
    key,
    requestHash: createHash("sha256")
      .update(JSON.stringify(request), "utf8")
      .digest("hex"),
  };
}

/**
 * Makes a moderator mutation safe to retry after a response, proxy, or network
 * failure. The receipt, durable mutation, and audit row are all committed in
 * one transaction. An advisory lock prevents two replicas from racing the same
 * actor/key pair before the unique index can be observed.
 */
export async function withChatModerationIdempotency<
  TStore extends ChatModerationIdempotencyStore,
  TResult,
>({
  idempotency,
  store,
  work,
}: {
  idempotency?: ChatModerationIdempotency;
  store: TStore;
  work: (transaction: TStore) => Promise<TResult>;
}) {
  if (!idempotency) {
    return work(store);
  }

  return withChatRecordLock({
    recordId: `${idempotency.actorUserId}:${idempotency.key}`,
    scope: "CHAT_MODERATION_IDEMPOTENCY",
    store,
    work: async (transaction) => {
      const existing = await transaction.chatModerationAction.findUnique({
        select: { action: true, requestHash: true, result: true },
        where: {
          actorUserId_idempotencyKey: {
            actorUserId: idempotency.actorUserId,
            idempotencyKey: idempotency.key,
          },
        },
      });

      if (existing) {
        if (
          existing.action !== idempotency.action ||
          existing.requestHash !== idempotency.requestHash
        ) {
          throw new ChatModerationIdempotencyError(
            "That Idempotency-Key was already used for a different moderation request.",
            "conflict",
          );
        }

        return existing.result as TResult;
      }

      const result = await work(transaction);
      await transaction.chatModerationAction.create({
        data: {
          action: idempotency.action,
          actorUserId: idempotency.actorUserId,
          idempotencyKey: idempotency.key,
          requestHash: idempotency.requestHash,
          result: toJsonValue(result),
        },
        select: { id: true },
      });

      return result;
    },
  });
}

function toJsonValue(value: unknown): Prisma.InputJsonValue {
  const serialized = JSON.stringify(value);

  if (!serialized) {
    throw new Error("A moderation action must return a JSON response.");
  }

  return JSON.parse(serialized) as Prisma.InputJsonValue;
}
