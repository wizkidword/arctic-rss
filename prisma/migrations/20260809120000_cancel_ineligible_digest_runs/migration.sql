-- Preserve completed digests while giving disablement a durable terminal state
-- for retryable scheduled work.
ALTER TYPE "DigestRunStatus" ADD VALUE 'CANCELED';
