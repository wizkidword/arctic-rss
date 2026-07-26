import { Prisma } from "@/generated/prisma/client"

type ChatRecordLockStore = {
  $executeRaw?: (query: Prisma.Sql) => Promise<unknown>
  $transaction?: <T>(work: (transaction: ChatRecordLockStore) => Promise<T>) => Promise<T>
}

export async function withChatRecordLock<TStore extends ChatRecordLockStore, TResult>({
  recordId,
  scope,
  store,
  work,
}: {
  recordId: string
  scope: string
  store: TStore
  work: (transaction: TStore) => Promise<TResult>
}) {
  const run = async (transaction: TStore) => {
    if (transaction.$executeRaw) {
      await transaction.$executeRaw(Prisma.sql`SET LOCAL lock_timeout = '5s'`)
      await transaction.$executeRaw(
        Prisma.sql`SELECT pg_advisory_xact_lock(hashtext(${scope}), hashtext(${recordId}))`
      )
    }

    return work(transaction)
  }

  return store.$transaction
    ? store.$transaction((transaction) => run(transaction as TStore))
    : run(store)
}
