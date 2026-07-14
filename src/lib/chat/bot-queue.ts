import { Queue, type JobsOptions } from "bullmq"

import { redisConnectionOptions } from "@/lib/feed-refresh-queue"

export const CHAT_ARTICLE_INTEGRATION_QUEUE_NAME = "chat-article-integration"

export type ChatArticleIntegrationJobData = {
  articleId: string
}

let chatArticleIntegrationQueue: Queue<ChatArticleIntegrationJobData> | undefined

export function getChatArticleIntegrationQueue() {
  if (!chatArticleIntegrationQueue) {
    chatArticleIntegrationQueue = new Queue<ChatArticleIntegrationJobData>(
      CHAT_ARTICLE_INTEGRATION_QUEUE_NAME,
      { connection: redisConnectionOptions() }
    )
  }

  return chatArticleIntegrationQueue
}

export async function enqueueChatArticleIntegration(
  articleId: string,
  options: JobsOptions = {}
) {
  return getChatArticleIntegrationQueue().add(
    "integrate-article",
    { articleId },
    {
      attempts: 5,
      backoff: { delay: 15_000, type: "exponential" },
      jobId: chatArticleIntegrationJobId(articleId),
      removeOnComplete: true,
      removeOnFail: { age: 24 * 60 * 60, count: 1_000 },
      ...options,
    }
  )
}

export function chatArticleIntegrationJobId(articleId: string) {
  return `chat-article-${articleId.replace(/[^a-zA-Z0-9_-]/g, "-")}`
}
