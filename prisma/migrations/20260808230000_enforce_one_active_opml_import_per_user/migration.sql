-- Refuse to silently choose which in-progress import should survive. Resolve any
-- historical duplicates before this migration is applied to a populated database.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "ImportJob"
    WHERE "status" IN ('PENDING', 'PROCESSING')
    GROUP BY "userId"
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'Cannot enforce one active OPML import per user while duplicate active ImportJob rows exist.';
  END IF;
END $$;

CREATE UNIQUE INDEX "ImportJob_one_active_per_user"
ON "ImportJob"("userId")
WHERE "status" IN ('PENDING', 'PROCESSING');
