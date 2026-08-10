-- Make post-provider acknowledgement uncertainty visible without changing
-- existing retryable or terminal delivery states.
ALTER TYPE "SmartDigestEmailStatus" ADD VALUE 'DELIVERY_UNKNOWN';
