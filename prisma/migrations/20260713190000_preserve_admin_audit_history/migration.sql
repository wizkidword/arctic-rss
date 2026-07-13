-- Preserve audit evidence if an administrator account is ever removed. The
-- snapshot columns intentionally keep the original actor identity even after
-- the nullable relational pointer is set to NULL.

ALTER TABLE "AdminAuditLog"
ADD COLUMN "actorUserId" TEXT,
ADD COLUMN "actorEmail" TEXT,
ADD COLUMN "actorName" TEXT;

UPDATE "AdminAuditLog" AS log
SET
  "actorUserId" = actor."id",
  "actorEmail" = actor."email",
  "actorName" = actor."name"
FROM "User" AS actor
WHERE actor."id" = log."adminUserId";

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "AdminAuditLog"
    WHERE "actorUserId" IS NULL OR "actorEmail" IS NULL
  ) THEN
    RAISE EXCEPTION
      'Admin audit history contains an actor that cannot be snapshotted; repair it before applying this migration.';
  END IF;
END
$$;

ALTER TABLE "AdminAuditLog"
ALTER COLUMN "adminUserId" DROP NOT NULL;

ALTER TABLE "AdminAuditLog"
DROP CONSTRAINT "AdminAuditLog_adminUserId_fkey";

ALTER TABLE "AdminAuditLog"
ADD CONSTRAINT "AdminAuditLog_adminUserId_fkey"
FOREIGN KEY ("adminUserId") REFERENCES "User"("id")
ON DELETE SET NULL ON UPDATE RESTRICT;

ALTER TABLE "AdminAuditLog"
ADD CONSTRAINT "AdminAuditLog_actor_snapshot_present"
CHECK ("actorUserId" IS NOT NULL AND "actorEmail" IS NOT NULL);

-- Prisma writes the actor relation, while this trigger derives the durable
-- snapshot from the current User row. This prevents callers from supplying a
-- mismatched email or name and makes the same rule apply to direct SQL writes.
CREATE FUNCTION "AdminAuditLog_capture_actor_snapshot"()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  actor "User"%ROWTYPE;
BEGIN
  IF NEW."adminUserId" IS NULL THEN
    RAISE EXCEPTION 'Admin audit records require an actor.' USING ERRCODE = '23514';
  END IF;

  SELECT *
  INTO actor
  FROM "User"
  WHERE "id" = NEW."adminUserId";

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Admin audit actor does not exist.' USING ERRCODE = '23503';
  END IF;

  NEW."actorUserId" := actor."id";
  NEW."actorEmail" := actor."email";
  NEW."actorName" := actor."name";

  RETURN NEW;
END;
$$;

CREATE TRIGGER "AdminAuditLog_capture_actor_snapshot"
BEFORE INSERT ON "AdminAuditLog"
FOR EACH ROW
EXECUTE FUNCTION "AdminAuditLog_capture_actor_snapshot"();

-- Audit content is append-only. The one permitted UPDATE is the foreign-key
-- action that clears the live actor relation after a User deletion; all
-- evidence stays in the immutable snapshot fields.
CREATE FUNCTION "AdminAuditLog_reject_mutation"()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Admin audit records are append-only.' USING ERRCODE = '55000';
  END IF;

  IF NEW."adminUserId" IS NULL
     AND OLD."adminUserId" IS NOT NULL
     AND NEW."id" IS NOT DISTINCT FROM OLD."id"
     AND NEW."actorUserId" IS NOT DISTINCT FROM OLD."actorUserId"
     AND NEW."actorEmail" IS NOT DISTINCT FROM OLD."actorEmail"
     AND NEW."actorName" IS NOT DISTINCT FROM OLD."actorName"
     AND NEW."action" IS NOT DISTINCT FROM OLD."action"
     AND NEW."targetType" IS NOT DISTINCT FROM OLD."targetType"
     AND NEW."targetId" IS NOT DISTINCT FROM OLD."targetId"
     AND NEW."metadata" IS NOT DISTINCT FROM OLD."metadata"
     AND NEW."createdAt" IS NOT DISTINCT FROM OLD."createdAt"
  THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'Admin audit records are immutable.' USING ERRCODE = '55000';
END;
$$;

CREATE TRIGGER "AdminAuditLog_reject_mutation"
BEFORE UPDATE OR DELETE ON "AdminAuditLog"
FOR EACH ROW
EXECUTE FUNCTION "AdminAuditLog_reject_mutation"();
