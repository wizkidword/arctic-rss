-- This migration is intentionally additive. Arctic IRC remains disabled until
-- an explicit environment flag is enabled; no existing reader records change.

CREATE TYPE "ChatRoomVisibility" AS ENUM ('PUBLIC', 'UNLISTED', 'PRIVATE');
CREATE TYPE "ChatRoomJoinPolicy" AS ENUM ('OPEN', 'REQUEST', 'INVITE');
CREATE TYPE "ChatRoomHistoryVisibility" AS ENUM ('PUBLIC_PREVIEW', 'MEMBERS', 'AFTER_JOIN');
CREATE TYPE "ChatRoomState" AS ENUM ('ACTIVE', 'READ_ONLY', 'ARCHIVED', 'SUSPENDED');
CREATE TYPE "ChatRoomFeedPostingMode" AS ENUM ('OFF', 'LIVE', 'DIGEST');
CREATE TYPE "ChatRoomMemberRole" AS ENUM ('OWNER', 'ADMIN', 'OPERATOR', 'VOICE', 'MEMBER');
CREATE TYPE "ChatRoomMemberStatus" AS ENUM ('ACTIVE', 'LEFT', 'PENDING');
CREATE TYPE "ChatNotificationMode" AS ENUM ('ALL', 'MENTIONS', 'NONE');
CREATE TYPE "ChatMessageKind" AS ENUM ('TEXT', 'ACTION', 'NOTICE', 'SYSTEM', 'ARTICLE', 'BOT');
CREATE TYPE "ChatReportStatus" AS ENUM ('OPEN', 'REVIEWING', 'ACTIONED', 'DISMISSED');

CREATE TABLE "ChatProfile" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "handle" TEXT NOT NULL,
  "handleNormalized" TEXT NOT NULL,
  "displayName" TEXT,
  "bio" TEXT,
  "statusText" TEXT,
  "allowDirectMessages" BOOLEAN NOT NULL DEFAULT false,
  "handleChangedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ChatProfile_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ChatRoom" (
  "id" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "topicLine" TEXT,
  "languageCode" TEXT NOT NULL DEFAULT 'en',
  "visibility" "ChatRoomVisibility" NOT NULL DEFAULT 'PUBLIC',
  "joinPolicy" "ChatRoomJoinPolicy" NOT NULL DEFAULT 'OPEN',
  "historyVisibility" "ChatRoomHistoryVisibility" NOT NULL DEFAULT 'MEMBERS',
  "state" "ChatRoomState" NOT NULL DEFAULT 'ACTIVE',
  "isOfficial" BOOLEAN NOT NULL DEFAULT false,
  "createdByUserId" TEXT,
  "slowModeSeconds" INTEGER NOT NULL DEFAULT 0,
  "messageRetentionDays" INTEGER,
  "joinPartNoticesEnabled" BOOLEAN NOT NULL DEFAULT true,
  "lastActivityAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ChatRoom_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ChatRoomInterest" (
  "roomId" TEXT NOT NULL,
  "interestId" TEXT NOT NULL,
  "weight" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ChatRoomInterest_pkey" PRIMARY KEY ("roomId", "interestId")
);

CREATE TABLE "ChatRoomFeed" (
  "roomId" TEXT NOT NULL,
  "feedId" TEXT NOT NULL,
  "postingMode" "ChatRoomFeedPostingMode" NOT NULL DEFAULT 'OFF',
  "minimumIntervalMinutes" INTEGER NOT NULL DEFAULT 60,
  "createdByUserId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ChatRoomFeed_pkey" PRIMARY KEY ("roomId", "feedId")
);

CREATE TABLE "ChatRoomMember" (
  "id" TEXT NOT NULL,
  "roomId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "role" "ChatRoomMemberRole" NOT NULL DEFAULT 'MEMBER',
  "status" "ChatRoomMemberStatus" NOT NULL DEFAULT 'ACTIVE',
  "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "leftAt" TIMESTAMP(3),
  "lastReadMessageSequence" BIGINT,
  "notificationMode" "ChatNotificationMode" NOT NULL DEFAULT 'MENTIONS',
  "roomMutedUntil" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ChatRoomMember_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ChatMessage" (
  "id" TEXT NOT NULL,
  "sequence" BIGSERIAL NOT NULL,
  "roomId" TEXT NOT NULL,
  "senderUserId" TEXT,
  "clientMessageId" TEXT NOT NULL,
  "kind" "ChatMessageKind" NOT NULL DEFAULT 'TEXT',
  "body" VARCHAR(2000) NOT NULL,
  "metadata" JSONB,
  "articleId" TEXT,
  "replyToMessageId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "editedAt" TIMESTAMP(3),
  "deletedAt" TIMESTAMP(3),
  "deletedByUserId" TEXT,
  "deletionReason" TEXT,
  CONSTRAINT "ChatMessage_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ChatBlock" (
  "blockerUserId" TEXT NOT NULL,
  "blockedUserId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ChatBlock_pkey" PRIMARY KEY ("blockerUserId", "blockedUserId")
);

CREATE TABLE "ChatRoomBan" (
  "id" TEXT NOT NULL,
  "roomId" TEXT NOT NULL,
  "targetUserId" TEXT NOT NULL,
  "createdByUserId" TEXT,
  "reason" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3),
  "revokedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ChatRoomBan_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ChatReport" (
  "id" TEXT NOT NULL,
  "reporterUserId" TEXT,
  "targetUserId" TEXT,
  "roomId" TEXT,
  "messageId" TEXT,
  "category" TEXT NOT NULL,
  "details" TEXT,
  "status" "ChatReportStatus" NOT NULL DEFAULT 'OPEN',
  "assignedModeratorUserId" TEXT,
  "evidenceSnapshot" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ChatReport_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ChatAuditLog" (
  "id" TEXT NOT NULL,
  "actorUserId" TEXT,
  "targetUserId" TEXT,
  "roomId" TEXT,
  "messageId" TEXT,
  "action" TEXT NOT NULL,
  "reason" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ChatAuditLog_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ChatProfile_userId_key" ON "ChatProfile"("userId");
CREATE UNIQUE INDEX "ChatProfile_handleNormalized_key" ON "ChatProfile"("handleNormalized");
CREATE UNIQUE INDEX "ChatRoom_slug_key" ON "ChatRoom"("slug");
CREATE UNIQUE INDEX "ChatRoomMember_roomId_userId_key" ON "ChatRoomMember"("roomId", "userId");
CREATE UNIQUE INDEX "ChatMessage_sequence_key" ON "ChatMessage"("sequence");
CREATE UNIQUE INDEX "ChatMessage_senderUserId_clientMessageId_key" ON "ChatMessage"("senderUserId", "clientMessageId");

CREATE INDEX "ChatRoom_state_isOfficial_lastActivityAt_idx" ON "ChatRoom"("state", "isOfficial", "lastActivityAt");
CREATE INDEX "ChatRoom_visibility_joinPolicy_idx" ON "ChatRoom"("visibility", "joinPolicy");
CREATE INDEX "ChatRoomInterest_interestId_idx" ON "ChatRoomInterest"("interestId");
CREATE INDEX "ChatRoomFeed_feedId_idx" ON "ChatRoomFeed"("feedId");
CREATE INDEX "ChatRoomMember_userId_status_idx" ON "ChatRoomMember"("userId", "status");
CREATE INDEX "ChatRoomMember_roomId_status_role_idx" ON "ChatRoomMember"("roomId", "status", "role");
CREATE INDEX "ChatMessage_roomId_sequence_idx" ON "ChatMessage"("roomId", "sequence");
CREATE INDEX "ChatMessage_senderUserId_createdAt_idx" ON "ChatMessage"("senderUserId", "createdAt");
CREATE INDEX "ChatBlock_blockedUserId_idx" ON "ChatBlock"("blockedUserId");
CREATE INDEX "ChatRoomBan_roomId_targetUserId_revokedAt_idx" ON "ChatRoomBan"("roomId", "targetUserId", "revokedAt");
CREATE INDEX "ChatRoomBan_targetUserId_expiresAt_idx" ON "ChatRoomBan"("targetUserId", "expiresAt");
CREATE INDEX "ChatReport_status_createdAt_idx" ON "ChatReport"("status", "createdAt");
CREATE INDEX "ChatReport_roomId_createdAt_idx" ON "ChatReport"("roomId", "createdAt");
CREATE INDEX "ChatReport_targetUserId_createdAt_idx" ON "ChatReport"("targetUserId", "createdAt");
CREATE INDEX "ChatAuditLog_roomId_createdAt_idx" ON "ChatAuditLog"("roomId", "createdAt");
CREATE INDEX "ChatAuditLog_actorUserId_createdAt_idx" ON "ChatAuditLog"("actorUserId", "createdAt");
CREATE INDEX "ChatAuditLog_targetUserId_createdAt_idx" ON "ChatAuditLog"("targetUserId", "createdAt");

ALTER TABLE "ChatProfile" ADD CONSTRAINT "ChatProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ChatRoom" ADD CONSTRAINT "ChatRoom_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ChatRoomInterest" ADD CONSTRAINT "ChatRoomInterest_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "ChatRoom"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ChatRoomFeed" ADD CONSTRAINT "ChatRoomFeed_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "ChatRoom"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ChatRoomFeed" ADD CONSTRAINT "ChatRoomFeed_feedId_fkey" FOREIGN KEY ("feedId") REFERENCES "Feed"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ChatRoomFeed" ADD CONSTRAINT "ChatRoomFeed_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ChatRoomMember" ADD CONSTRAINT "ChatRoomMember_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "ChatRoom"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ChatRoomMember" ADD CONSTRAINT "ChatRoomMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ChatMessage" ADD CONSTRAINT "ChatMessage_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "ChatRoom"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ChatMessage" ADD CONSTRAINT "ChatMessage_senderUserId_fkey" FOREIGN KEY ("senderUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ChatMessage" ADD CONSTRAINT "ChatMessage_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "Article"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ChatMessage" ADD CONSTRAINT "ChatMessage_deletedByUserId_fkey" FOREIGN KEY ("deletedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ChatMessage" ADD CONSTRAINT "ChatMessage_replyToMessageId_fkey" FOREIGN KEY ("replyToMessageId") REFERENCES "ChatMessage"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ChatBlock" ADD CONSTRAINT "ChatBlock_blockerUserId_fkey" FOREIGN KEY ("blockerUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ChatBlock" ADD CONSTRAINT "ChatBlock_blockedUserId_fkey" FOREIGN KEY ("blockedUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ChatRoomBan" ADD CONSTRAINT "ChatRoomBan_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "ChatRoom"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ChatRoomBan" ADD CONSTRAINT "ChatRoomBan_targetUserId_fkey" FOREIGN KEY ("targetUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ChatRoomBan" ADD CONSTRAINT "ChatRoomBan_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ChatReport" ADD CONSTRAINT "ChatReport_reporterUserId_fkey" FOREIGN KEY ("reporterUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ChatReport" ADD CONSTRAINT "ChatReport_targetUserId_fkey" FOREIGN KEY ("targetUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ChatReport" ADD CONSTRAINT "ChatReport_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "ChatRoom"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ChatReport" ADD CONSTRAINT "ChatReport_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "ChatMessage"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ChatReport" ADD CONSTRAINT "ChatReport_assignedModeratorUserId_fkey" FOREIGN KEY ("assignedModeratorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ChatAuditLog" ADD CONSTRAINT "ChatAuditLog_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ChatAuditLog" ADD CONSTRAINT "ChatAuditLog_targetUserId_fkey" FOREIGN KEY ("targetUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ChatAuditLog" ADD CONSTRAINT "ChatAuditLog_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "ChatRoom"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ChatAuditLog" ADD CONSTRAINT "ChatAuditLog_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "ChatMessage"("id") ON DELETE SET NULL ON UPDATE CASCADE;
