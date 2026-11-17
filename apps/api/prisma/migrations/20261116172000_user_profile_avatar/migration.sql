ALTER TABLE "users"
  ADD COLUMN "avatarStorageKey" VARCHAR(120),
  ADD COLUMN "avatarMimeType" VARCHAR(40),
  ADD COLUMN "avatarUpdatedAt" TIMESTAMP(3);
