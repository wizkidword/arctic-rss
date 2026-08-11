-- Sync-event retention must not run inside ordinary user writes. This keeps
-- the trigger focused on the atomic append; a bounded worker transaction now
-- expires events and advances the per-user cursor floor.
CREATE OR REPLACE FUNCTION "append_user_sync_event"(
  p_user_id TEXT,
  p_resource_type TEXT,
  p_resource_id TEXT,
  p_action TEXT,
  p_resource_version TEXT,
  p_payload JSONB
) RETURNS VOID AS $$
BEGIN
  INSERT INTO "UserSyncEvent" (
    "userId", "resourceType", "resourceId", "action", "resourceVersion", "payload"
  ) VALUES (
    p_user_id, p_resource_type, p_resource_id, p_action, p_resource_version, p_payload
  );
END;
$$ LANGUAGE plpgsql;
