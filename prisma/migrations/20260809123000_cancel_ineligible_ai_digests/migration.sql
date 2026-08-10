-- Preserve completed briefings while giving disabled-account AI work a durable
-- terminal state that the worker will not resume.
ALTER TYPE "AiDigestStatus" ADD VALUE 'CANCELED';
