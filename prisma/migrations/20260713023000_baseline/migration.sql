-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('USER', 'ADMIN');

-- CreateEnum
CREATE TYPE "Plan" AS ENUM ('FREE', 'PRO', 'ADMIN');

-- CreateEnum
CREATE TYPE "DefaultView" AS ENUM ('CLASSIC', 'CARD', 'COMPACT', 'RIVER');

-- CreateEnum
CREATE TYPE "DisplayMode" AS ENUM ('MINIMAL', 'READER', 'THREE_PANE');

-- CreateEnum
CREATE TYPE "ThemePreference" AS ENUM ('SYSTEM', 'LIGHT', 'HOLIDAY', 'ORANGE', 'SAND', 'DARK', 'GREY');

-- CreateEnum
CREATE TYPE "FontSizePreference" AS ENUM ('SMALL', 'MEDIUM', 'LARGE');

-- CreateEnum
CREATE TYPE "DateFormatPreference" AS ENUM ('DEFAULT', 'YYYY_MM_DD', 'YYYY_DOT_MM_DD', 'YYYY_SLASH_MM_DD', 'YYYY_DD_MM', 'DD_MM_YYYY', 'MM_DD_YYYY');

-- CreateEnum
CREATE TYPE "TimeFormatPreference" AS ENUM ('DEFAULT', 'HOUR_24', 'HOUR_12');

-- CreateEnum
CREATE TYPE "ImportStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "AiAction" AS ENUM ('ARTICLE_SUMMARY', 'DAILY_DIGEST', 'EXPLAIN_ARTICLE', 'SMART_CATEGORY', 'SEARCH');

-- CreateEnum
CREATE TYPE "AiDigestStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "AiDigestSection" AS ENUM ('MUST_READ', 'SKIM_LATER');

-- CreateEnum
CREATE TYPE "SmartDigestMatchingMode" AS ENUM ('RULES', 'HYBRID_AI');

-- CreateEnum
CREATE TYPE "SmartDigestSourceScope" AS ENUM ('ALL_FEEDS', 'FOLDERS', 'FEEDS');

-- CreateEnum
CREATE TYPE "SmartDigestCadence" AS ENUM ('DAILY');

-- CreateEnum
CREATE TYPE "SmartDigestStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'COMPLETED_NO_MATCHES', 'FAILED');

-- CreateEnum
CREATE TYPE "SmartDigestEmailStatus" AS ENUM ('NOT_REQUESTED', 'PENDING', 'SENT', 'FAILED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "emailVerified" TIMESTAMP(3),
    "name" TEXT,
    "image" TEXT,
    "passwordHash" TEXT,
    "role" "Role" NOT NULL DEFAULT 'USER',
    "plan" "Plan" NOT NULL DEFAULT 'FREE',
    "aiMonthlyLimit" INTEGER NOT NULL DEFAULT 100,
    "aiMonthlyUsed" INTEGER NOT NULL DEFAULT 0,
    "disabledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Account" (
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("provider","providerAccountId")
);

-- CreateTable
CREATE TABLE "Session" (
    "sessionToken" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL
);

-- CreateTable
CREATE TABLE "VerificationToken" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VerificationToken_pkey" PRIMARY KEY ("identifier","token")
);

-- CreateTable
CREATE TABLE "PasswordResetToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PasswordResetToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmailVerificationToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmailVerificationToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserSettings" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "defaultView" "DefaultView" NOT NULL DEFAULT 'CLASSIC',
    "displayMode" "DisplayMode" NOT NULL DEFAULT 'THREE_PANE',
    "theme" "ThemePreference" NOT NULL DEFAULT 'SYSTEM',
    "fontSize" "FontSizePreference" NOT NULL DEFAULT 'MEDIUM',
    "dateFormat" "DateFormatPreference" NOT NULL DEFAULT 'DEFAULT',
    "timeFormat" "TimeFormatPreference" NOT NULL DEFAULT 'DEFAULT',
    "timeZone" TEXT NOT NULL DEFAULT 'UTC',
    "markReadOnOpen" BOOLEAN NOT NULL DEFAULT true,
    "openLinksInNewTab" BOOLEAN NOT NULL DEFAULT true,
    "aiAutoSummariesEnabled" BOOLEAN NOT NULL DEFAULT false,
    "dailyDigestEnabled" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Folder" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Folder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Feed" (
    "id" TEXT NOT NULL,
    "feedUrl" TEXT NOT NULL,
    "siteUrl" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "faviconUrl" TEXT,
    "language" TEXT,
    "lastFetchedAt" TIMESTAMP(3),
    "lastSuccessfulFetchAt" TIMESTAMP(3),
    "lastFailedAt" TIMESTAMP(3),
    "lastError" TEXT,
    "etag" TEXT,
    "lastModified" TEXT,
    "refreshIntervalMinutes" INTEGER NOT NULL DEFAULT 60,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Feed_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FeedSubscription" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "feedId" TEXT NOT NULL,
    "folderId" TEXT,
    "customTitle" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isMuted" BOOLEAN NOT NULL DEFAULT false,
    "isPaused" BOOLEAN NOT NULL DEFAULT false,
    "subscribedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FeedSubscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Podcast" (
    "id" TEXT NOT NULL,
    "feedUrl" TEXT NOT NULL,
    "siteUrl" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "artworkUrl" TEXT,
    "author" TEXT,
    "language" TEXT,
    "lastFetchedAt" TIMESTAMP(3),
    "lastSuccessfulFetchAt" TIMESTAMP(3),
    "lastFailedAt" TIMESTAMP(3),
    "lastError" TEXT,
    "etag" TEXT,
    "lastModified" TEXT,
    "refreshIntervalMinutes" INTEGER NOT NULL DEFAULT 60,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Podcast_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PodcastSubscription" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "podcastId" TEXT NOT NULL,
    "customTitle" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isMuted" BOOLEAN NOT NULL DEFAULT false,
    "isPaused" BOOLEAN NOT NULL DEFAULT false,
    "subscribedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PodcastSubscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PodcastEpisode" (
    "id" TEXT NOT NULL,
    "podcastId" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "url" TEXT,
    "description" TEXT,
    "contentHtml" TEXT,
    "contentText" TEXT,
    "audioUrl" TEXT NOT NULL,
    "audioType" TEXT,
    "audioLengthBytes" BIGINT,
    "durationSeconds" INTEGER,
    "imageUrl" TEXT,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PodcastEpisode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PodcastEpisodeState" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "episodeId" TEXT NOT NULL,
    "isPlayed" BOOLEAN NOT NULL DEFAULT false,
    "isStarred" BOOLEAN NOT NULL DEFAULT false,
    "playbackPositionSeconds" INTEGER NOT NULL DEFAULT 0,
    "playedAt" TIMESTAMP(3),
    "starredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PodcastEpisodeState_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Article" (
    "id" TEXT NOT NULL,
    "feedId" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "canonicalUrl" TEXT,
    "author" TEXT,
    "summary" TEXT,
    "contentHtml" TEXT,
    "contentText" TEXT,
    "imageUrl" TEXT,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Article_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ArticleState" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "articleId" TEXT NOT NULL,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "isStarred" BOOLEAN NOT NULL DEFAULT false,
    "readAt" TIMESTAMP(3),
    "starredAt" TIMESTAMP(3),
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ArticleState_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ArticleCollection" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ArticleCollection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ArticleCollectionItem" (
    "id" TEXT NOT NULL,
    "collectionId" TEXT NOT NULL,
    "articleId" TEXT,
    "podcastEpisodeId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ArticleCollectionItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ArticleAiSummary" (
    "id" TEXT NOT NULL,
    "articleId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "shortSummary" TEXT NOT NULL,
    "bulletSummary" JSONB,
    "keyTakeaway" TEXT,
    "category" TEXT,
    "sentiment" TEXT,
    "readingTimeSeconds" INTEGER,
    "tokenCount" INTEGER,
    "costEstimate" DECIMAL(10,6),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ArticleAiSummary_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiUsageLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "action" "AiAction" NOT NULL,
    "provider" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "inputTokens" INTEGER NOT NULL DEFAULT 0,
    "outputTokens" INTEGER NOT NULL DEFAULT 0,
    "costEstimate" DECIMAL(10,6),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AiUsageLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiDigest" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" "AiDigestStatus" NOT NULL DEFAULT 'PENDING',
    "title" TEXT,
    "overview" TEXT,
    "provider" TEXT,
    "model" TEXT,
    "articleCount" INTEGER NOT NULL DEFAULT 0,
    "inputTokens" INTEGER NOT NULL DEFAULT 0,
    "outputTokens" INTEGER NOT NULL DEFAULT 0,
    "errorMessage" TEXT,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AiDigest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiDigestItem" (
    "id" TEXT NOT NULL,
    "digestId" TEXT NOT NULL,
    "articleId" TEXT,
    "section" "AiDigestSection" NOT NULL,
    "topic" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "articleTitle" TEXT NOT NULL,
    "articleUrl" TEXT NOT NULL,
    "feedTitle" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "reason" TEXT,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AiDigestItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SmartDigestRule" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "topicPrompt" TEXT NOT NULL,
    "matchingMode" "SmartDigestMatchingMode" NOT NULL DEFAULT 'RULES',
    "includeTerms" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "excludeTerms" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "sourceScope" "SmartDigestSourceScope" NOT NULL DEFAULT 'ALL_FEEDS',
    "emailEnabled" BOOLEAN NOT NULL DEFAULT false,
    "cadence" "SmartDigestCadence" NOT NULL DEFAULT 'DAILY',
    "scheduledHour" INTEGER NOT NULL DEFAULT 8,
    "timeZone" TEXT NOT NULL DEFAULT 'UTC',
    "lastRunAt" TIMESTAMP(3),
    "nextRunAt" TIMESTAMP(3),
    "lastMatchedAt" TIMESTAMP(3),
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SmartDigestRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SmartDigestRuleFolder" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "ruleId" TEXT NOT NULL,
    "folderId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SmartDigestRuleFolder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SmartDigestRuleSubscription" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "ruleId" TEXT NOT NULL,
    "subscriptionId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SmartDigestRuleSubscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SmartDigest" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "ruleId" TEXT NOT NULL,
    "status" "SmartDigestStatus" NOT NULL DEFAULT 'PENDING',
    "emailStatus" "SmartDigestEmailStatus" NOT NULL DEFAULT 'NOT_REQUESTED',
    "title" TEXT NOT NULL,
    "topicPrompt" TEXT NOT NULL,
    "articleCount" INTEGER NOT NULL DEFAULT 0,
    "errorMessage" TEXT,
    "emailErrorMessage" TEXT,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "emailedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SmartDigest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SmartDigestItem" (
    "id" TEXT NOT NULL,
    "digestId" TEXT NOT NULL,
    "articleId" TEXT,
    "articleTitle" TEXT NOT NULL,
    "articleUrl" TEXT NOT NULL,
    "feedTitle" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "matchedTerms" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "matchedFields" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "reason" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SmartDigestItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImportJob" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" "ImportStatus" NOT NULL DEFAULT 'PENDING',
    "totalFeeds" INTEGER NOT NULL DEFAULT 0,
    "addedFeeds" INTEGER NOT NULL DEFAULT 0,
    "skippedFeeds" INTEGER NOT NULL DEFAULT 0,
    "failedFeeds" INTEGER NOT NULL DEFAULT 0,
    "errorLog" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ImportJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BugReport" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "pageUrl" TEXT,
    "userAgent" TEXT,
    "contactEmail" TEXT,
    "status" TEXT NOT NULL DEFAULT 'NEW',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BugReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FeatureSuggestion" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "pageUrl" TEXT,
    "userAgent" TEXT,
    "contactEmail" TEXT,
    "status" TEXT NOT NULL DEFAULT 'NEW',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FeatureSuggestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DiscoverCategory" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "countryCode" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DiscoverCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DiscoverFeed" (
    "id" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "aliases" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DiscoverFeed_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DiscoverCategoryCustomization" (
    "id" TEXT NOT NULL,
    "categorySlug" TEXT NOT NULL,
    "description" TEXT,
    "iconKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DiscoverCategoryCustomization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdminAuditLog" (
    "id" TEXT NOT NULL,
    "adminUserId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdminAuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Session_sessionToken_key" ON "Session"("sessionToken");

-- CreateIndex
CREATE UNIQUE INDEX "PasswordResetToken_tokenHash_key" ON "PasswordResetToken"("tokenHash");

-- CreateIndex
CREATE INDEX "PasswordResetToken_userId_createdAt_idx" ON "PasswordResetToken"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "PasswordResetToken_expiresAt_idx" ON "PasswordResetToken"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "EmailVerificationToken_tokenHash_key" ON "EmailVerificationToken"("tokenHash");

-- CreateIndex
CREATE INDEX "EmailVerificationToken_userId_createdAt_idx" ON "EmailVerificationToken"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "EmailVerificationToken_expiresAt_idx" ON "EmailVerificationToken"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "UserSettings_userId_key" ON "UserSettings"("userId");

-- CreateIndex
CREATE INDEX "Folder_userId_sortOrder_idx" ON "Folder"("userId", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "Folder_userId_id_key" ON "Folder"("userId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "Feed_feedUrl_key" ON "Feed"("feedUrl");

-- CreateIndex
CREATE INDEX "FeedSubscription_userId_folderId_idx" ON "FeedSubscription"("userId", "folderId");

-- CreateIndex
CREATE UNIQUE INDEX "FeedSubscription_userId_feedId_key" ON "FeedSubscription"("userId", "feedId");

-- CreateIndex
CREATE UNIQUE INDEX "FeedSubscription_userId_id_key" ON "FeedSubscription"("userId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "Podcast_feedUrl_key" ON "Podcast"("feedUrl");

-- CreateIndex
CREATE INDEX "PodcastSubscription_userId_sortOrder_idx" ON "PodcastSubscription"("userId", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "PodcastSubscription_userId_podcastId_key" ON "PodcastSubscription"("userId", "podcastId");

-- CreateIndex
CREATE INDEX "PodcastEpisode_podcastId_publishedAt_idx" ON "PodcastEpisode"("podcastId", "publishedAt");

-- CreateIndex
CREATE UNIQUE INDEX "PodcastEpisode_podcastId_externalId_key" ON "PodcastEpisode"("podcastId", "externalId");

-- CreateIndex
CREATE INDEX "PodcastEpisodeState_userId_isPlayed_idx" ON "PodcastEpisodeState"("userId", "isPlayed");

-- CreateIndex
CREATE INDEX "PodcastEpisodeState_userId_isStarred_idx" ON "PodcastEpisodeState"("userId", "isStarred");

-- CreateIndex
CREATE UNIQUE INDEX "PodcastEpisodeState_userId_episodeId_key" ON "PodcastEpisodeState"("userId", "episodeId");

-- CreateIndex
CREATE INDEX "Article_feedId_publishedAt_idx" ON "Article"("feedId", "publishedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Article_feedId_externalId_key" ON "Article"("feedId", "externalId");

-- CreateIndex
CREATE INDEX "ArticleState_userId_isRead_idx" ON "ArticleState"("userId", "isRead");

-- CreateIndex
CREATE INDEX "ArticleState_userId_isStarred_idx" ON "ArticleState"("userId", "isStarred");

-- CreateIndex
CREATE UNIQUE INDEX "ArticleState_userId_articleId_key" ON "ArticleState"("userId", "articleId");

-- CreateIndex
CREATE INDEX "ArticleCollection_userId_sortOrder_idx" ON "ArticleCollection"("userId", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "ArticleCollection_userId_name_key" ON "ArticleCollection"("userId", "name");

-- CreateIndex
CREATE INDEX "ArticleCollectionItem_articleId_idx" ON "ArticleCollectionItem"("articleId");

-- CreateIndex
CREATE INDEX "ArticleCollectionItem_podcastEpisodeId_idx" ON "ArticleCollectionItem"("podcastEpisodeId");

-- CreateIndex
CREATE UNIQUE INDEX "ArticleCollectionItem_collectionId_articleId_key" ON "ArticleCollectionItem"("collectionId", "articleId");

-- CreateIndex
CREATE UNIQUE INDEX "ArticleCollectionItem_collectionId_podcastEpisodeId_key" ON "ArticleCollectionItem"("collectionId", "podcastEpisodeId");

-- CreateIndex
CREATE UNIQUE INDEX "ArticleAiSummary_articleId_provider_model_key" ON "ArticleAiSummary"("articleId", "provider", "model");

-- CreateIndex
CREATE INDEX "AiUsageLog_userId_createdAt_idx" ON "AiUsageLog"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "AiDigest_userId_createdAt_idx" ON "AiDigest"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "AiDigest_userId_status_idx" ON "AiDigest"("userId", "status");

-- CreateIndex
CREATE INDEX "AiDigestItem_digestId_section_position_idx" ON "AiDigestItem"("digestId", "section", "position");

-- CreateIndex
CREATE UNIQUE INDEX "AiDigestItem_digestId_articleId_key" ON "AiDigestItem"("digestId", "articleId");

-- CreateIndex
CREATE INDEX "SmartDigestRule_userId_isEnabled_idx" ON "SmartDigestRule"("userId", "isEnabled");

-- CreateIndex
CREATE INDEX "SmartDigestRule_isEnabled_nextRunAt_idx" ON "SmartDigestRule"("isEnabled", "nextRunAt");

-- CreateIndex
CREATE UNIQUE INDEX "SmartDigestRule_userId_id_key" ON "SmartDigestRule"("userId", "id");

-- CreateIndex
CREATE INDEX "SmartDigestRuleFolder_folderId_idx" ON "SmartDigestRuleFolder"("folderId");

-- CreateIndex
CREATE UNIQUE INDEX "SmartDigestRuleFolder_ruleId_folderId_key" ON "SmartDigestRuleFolder"("ruleId", "folderId");

-- CreateIndex
CREATE INDEX "SmartDigestRuleSubscription_subscriptionId_idx" ON "SmartDigestRuleSubscription"("subscriptionId");

-- CreateIndex
CREATE UNIQUE INDEX "SmartDigestRuleSubscription_ruleId_subscriptionId_key" ON "SmartDigestRuleSubscription"("ruleId", "subscriptionId");

-- CreateIndex
CREATE INDEX "SmartDigest_userId_createdAt_idx" ON "SmartDigest"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "SmartDigest_ruleId_createdAt_idx" ON "SmartDigest"("ruleId", "createdAt");

-- CreateIndex
CREATE INDEX "SmartDigest_status_createdAt_idx" ON "SmartDigest"("status", "createdAt");

-- CreateIndex
CREATE INDEX "SmartDigest_emailStatus_createdAt_idx" ON "SmartDigest"("emailStatus", "createdAt");

-- CreateIndex
CREATE INDEX "SmartDigestItem_articleId_idx" ON "SmartDigestItem"("articleId");

-- CreateIndex
CREATE UNIQUE INDEX "SmartDigestItem_digestId_articleId_key" ON "SmartDigestItem"("digestId", "articleId");

-- CreateIndex
CREATE UNIQUE INDEX "SmartDigestItem_digestId_position_key" ON "SmartDigestItem"("digestId", "position");

-- CreateIndex
CREATE INDEX "BugReport_status_createdAt_idx" ON "BugReport"("status", "createdAt");

-- CreateIndex
CREATE INDEX "BugReport_userId_createdAt_idx" ON "BugReport"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "FeatureSuggestion_status_createdAt_idx" ON "FeatureSuggestion"("status", "createdAt");

-- CreateIndex
CREATE INDEX "FeatureSuggestion_userId_createdAt_idx" ON "FeatureSuggestion"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "DiscoverCategory_slug_key" ON "DiscoverCategory"("slug");

-- CreateIndex
CREATE INDEX "DiscoverCategory_countryCode_sortOrder_idx" ON "DiscoverCategory"("countryCode", "sortOrder");

-- CreateIndex
CREATE INDEX "DiscoverCategory_sortOrder_idx" ON "DiscoverCategory"("sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "DiscoverFeed_slug_key" ON "DiscoverFeed"("slug");

-- CreateIndex
CREATE INDEX "DiscoverFeed_categoryId_sortOrder_idx" ON "DiscoverFeed"("categoryId", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "DiscoverCategoryCustomization_categorySlug_key" ON "DiscoverCategoryCustomization"("categorySlug");

-- CreateIndex
CREATE INDEX "DiscoverCategoryCustomization_categorySlug_idx" ON "DiscoverCategoryCustomization"("categorySlug");

-- CreateIndex
CREATE INDEX "AdminAuditLog_adminUserId_createdAt_idx" ON "AdminAuditLog"("adminUserId", "createdAt");

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PasswordResetToken" ADD CONSTRAINT "PasswordResetToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailVerificationToken" ADD CONSTRAINT "EmailVerificationToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserSettings" ADD CONSTRAINT "UserSettings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Folder" ADD CONSTRAINT "Folder_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeedSubscription" ADD CONSTRAINT "FeedSubscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeedSubscription" ADD CONSTRAINT "FeedSubscription_feedId_fkey" FOREIGN KEY ("feedId") REFERENCES "Feed"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeedSubscription" ADD CONSTRAINT "FeedSubscription_folderId_fkey" FOREIGN KEY ("folderId") REFERENCES "Folder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PodcastSubscription" ADD CONSTRAINT "PodcastSubscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PodcastSubscription" ADD CONSTRAINT "PodcastSubscription_podcastId_fkey" FOREIGN KEY ("podcastId") REFERENCES "Podcast"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PodcastEpisode" ADD CONSTRAINT "PodcastEpisode_podcastId_fkey" FOREIGN KEY ("podcastId") REFERENCES "Podcast"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PodcastEpisodeState" ADD CONSTRAINT "PodcastEpisodeState_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PodcastEpisodeState" ADD CONSTRAINT "PodcastEpisodeState_episodeId_fkey" FOREIGN KEY ("episodeId") REFERENCES "PodcastEpisode"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Article" ADD CONSTRAINT "Article_feedId_fkey" FOREIGN KEY ("feedId") REFERENCES "Feed"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ArticleState" ADD CONSTRAINT "ArticleState_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ArticleState" ADD CONSTRAINT "ArticleState_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "Article"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ArticleCollection" ADD CONSTRAINT "ArticleCollection_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ArticleCollectionItem" ADD CONSTRAINT "ArticleCollectionItem_collectionId_fkey" FOREIGN KEY ("collectionId") REFERENCES "ArticleCollection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ArticleCollectionItem" ADD CONSTRAINT "ArticleCollectionItem_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "Article"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ArticleCollectionItem" ADD CONSTRAINT "ArticleCollectionItem_podcastEpisodeId_fkey" FOREIGN KEY ("podcastEpisodeId") REFERENCES "PodcastEpisode"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ArticleAiSummary" ADD CONSTRAINT "ArticleAiSummary_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "Article"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiUsageLog" ADD CONSTRAINT "AiUsageLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiDigest" ADD CONSTRAINT "AiDigest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiDigestItem" ADD CONSTRAINT "AiDigestItem_digestId_fkey" FOREIGN KEY ("digestId") REFERENCES "AiDigest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiDigestItem" ADD CONSTRAINT "AiDigestItem_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "Article"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SmartDigestRule" ADD CONSTRAINT "SmartDigestRule_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SmartDigestRuleFolder" ADD CONSTRAINT "SmartDigestRuleFolder_userId_ruleId_fkey" FOREIGN KEY ("userId", "ruleId") REFERENCES "SmartDigestRule"("userId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SmartDigestRuleFolder" ADD CONSTRAINT "SmartDigestRuleFolder_userId_folderId_fkey" FOREIGN KEY ("userId", "folderId") REFERENCES "Folder"("userId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SmartDigestRuleSubscription" ADD CONSTRAINT "SmartDigestRuleSubscription_userId_ruleId_fkey" FOREIGN KEY ("userId", "ruleId") REFERENCES "SmartDigestRule"("userId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SmartDigestRuleSubscription" ADD CONSTRAINT "SmartDigestRuleSubscription_userId_subscriptionId_fkey" FOREIGN KEY ("userId", "subscriptionId") REFERENCES "FeedSubscription"("userId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SmartDigest" ADD CONSTRAINT "SmartDigest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SmartDigest" ADD CONSTRAINT "SmartDigest_userId_ruleId_fkey" FOREIGN KEY ("userId", "ruleId") REFERENCES "SmartDigestRule"("userId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SmartDigestItem" ADD CONSTRAINT "SmartDigestItem_digestId_fkey" FOREIGN KEY ("digestId") REFERENCES "SmartDigest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SmartDigestItem" ADD CONSTRAINT "SmartDigestItem_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "Article"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImportJob" ADD CONSTRAINT "ImportJob_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BugReport" ADD CONSTRAINT "BugReport_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeatureSuggestion" ADD CONSTRAINT "FeatureSuggestion_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiscoverFeed" ADD CONSTRAINT "DiscoverFeed_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "DiscoverCategory"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdminAuditLog" ADD CONSTRAINT "AdminAuditLog_adminUserId_fkey" FOREIGN KEY ("adminUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
