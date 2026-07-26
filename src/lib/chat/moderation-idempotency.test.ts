import { describe, expect, it, vi } from "vitest";

import {
  ChatModerationIdempotencyError,
  createChatModerationIdempotency,
  parseChatModerationIdempotencyKey,
  withChatModerationIdempotency,
} from "./moderation-idempotency";

const actorUserId = "user-1234";
const key = "moderation-request-0001";

function createStore() {
  const receipts = new Map<
    string,
    { action: string; requestHash: string; result: unknown }
  >();
  const chatModerationAction = {
    create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
      receipts.set(`${data.actorUserId}:${data.idempotencyKey}`, {
        action: data.action as string,
        requestHash: data.requestHash as string,
        result: data.result,
      });
      return { id: "receipt-1" };
    }),
    findUnique: vi.fn(
      async ({
        where,
      }: {
        where: {
          actorUserId_idempotencyKey: {
            actorUserId: string;
            idempotencyKey: string;
          };
        };
      }) =>
        receipts.get(
          `${where.actorUserId_idempotencyKey.actorUserId}:${where.actorUserId_idempotencyKey.idempotencyKey}`,
        ) ?? null,
    ),
  };
  const store = {
    $executeRaw: vi.fn().mockResolvedValue(0),
    $transaction: vi.fn(),
    chatModerationAction,
  };
  store.$transaction.mockImplementation(async (work) => work(store));

  return store;
}

describe("chat moderation idempotency", () => {
  it("returns the durable original result without reapplying a retried mutation", async () => {
    const store = createStore();
    const audit = vi.fn();
    const idempotency = createChatModerationIdempotency({
      action: "room:mute",
      actorUserId,
      key,
      request: {
        durationSeconds: 900,
        roomSlug: "news",
        targetHandle: "north",
      },
    });
    const work = vi.fn(async () => {
      audit();
      return {
        mutedUntil: new Date("2026-07-26T14:00:00.000Z"),
        targetUserId: "user-5678",
      };
    });

    await expect(
      withChatModerationIdempotency({
        idempotency,
        store: store as never,
        work,
      }),
    ).resolves.toMatchObject({
      targetUserId: "user-5678",
    });
    await expect(
      withChatModerationIdempotency({
        idempotency,
        store: store as never,
        work,
      }),
    ).resolves.toEqual({
      mutedUntil: "2026-07-26T14:00:00.000Z",
      targetUserId: "user-5678",
    });

    expect(work).toHaveBeenCalledOnce();
    expect(audit).toHaveBeenCalledOnce();
    expect(store.chatModerationAction.create).toHaveBeenCalledOnce();
  });

  it("rejects a reused key when its action or request changes", async () => {
    const store = createStore();
    const first = createChatModerationIdempotency({
      action: "room:mute",
      actorUserId,
      key,
      request: { durationSeconds: 900 },
    });
    const changed = createChatModerationIdempotency({
      action: "room:ban",
      actorUserId,
      key,
      request: { durationSeconds: 900 },
    });

    await withChatModerationIdempotency({
      idempotency: first,
      store: store as never,
      work: async () => ({ targetUserId: "user-5678" }),
    });

    await expect(
      withChatModerationIdempotency({
        idempotency: changed,
        store: store as never,
        work: async () => ({ targetUserId: "user-5678" }),
      }),
    ).rejects.toMatchObject({
      code: "conflict",
    } satisfies Partial<ChatModerationIdempotencyError>);
  });

  it("requires a bounded opaque key", () => {
    expect(() => parseChatModerationIdempotencyKey(null)).toThrow(
      ChatModerationIdempotencyError,
    );
    expect(() => parseChatModerationIdempotencyKey("short")).toThrow(
      ChatModerationIdempotencyError,
    );
    expect(parseChatModerationIdempotencyKey(key)).toBe(key);
  });
});
