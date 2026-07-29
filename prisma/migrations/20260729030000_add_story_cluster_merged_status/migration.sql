-- An absorbed group remains immutable and auditable, but must not be presented
-- alongside the active combined group as duplicate related coverage.
ALTER TYPE "StoryClusterStatus" ADD VALUE IF NOT EXISTS 'MERGED';
