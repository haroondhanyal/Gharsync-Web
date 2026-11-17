ALTER TABLE "branches"
  ADD COLUMN "photoStorageKey" VARCHAR(120),
  ADD COLUMN "photoMimeType" VARCHAR(40),
  ADD COLUMN "photoUpdatedAt" TIMESTAMP(3);

ALTER TABLE "customers"
  ADD COLUMN "countryCode" CHAR(2) NOT NULL DEFAULT 'PK',
  ADD COLUMN "city" VARCHAR(100),
  ADD COLUMN "photoStorageKey" VARCHAR(120),
  ADD COLUMN "photoMimeType" VARCHAR(40),
  ADD COLUMN "photoUpdatedAt" TIMESTAMP(3);

UPDATE "customers" c SET "city" = a."city"
FROM "customer_addresses" a
WHERE a."customerId" = c."id" AND a."isDefault" = true AND c."city" IS NULL;
