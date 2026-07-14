-- Records the most recent successful authentication for the administrative user list.
ALTER TABLE "User" ADD COLUMN "lastLoginAt" TIMESTAMP(3);
