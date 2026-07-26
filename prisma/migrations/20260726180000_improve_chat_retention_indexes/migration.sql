-- CHAT-RET-001: retention scans always process the oldest eligible records
-- first, so each source needs an index aligned with its cursor ordering.
CREATE INDEX "ChatMessage_retention_created_idx"
  ON "ChatMessage"("createdAt", "id");
CREATE INDEX "ChatMessage_retention_deleted_idx"
  ON "ChatMessage"("deletedAt", "id");
CREATE INDEX "ChatRoomMember_retention_left_idx"
  ON "ChatRoomMember"("status", "leftAt", "id");
CREATE INDEX "ChatReport_retention_closed_idx"
  ON "ChatReport"("retentionClass", "closedAt", "id");
CREATE INDEX "ChatAuditLog_retention_created_idx"
  ON "ChatAuditLog"("createdAt", "id");
CREATE INDEX "AccountDeletionRecord_retention_completed_idx"
  ON "AccountDeletionRecord"("completedAt", "id");
