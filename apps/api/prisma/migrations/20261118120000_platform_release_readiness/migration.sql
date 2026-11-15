CREATE TYPE "OrganizationVerificationStatus" AS ENUM ('UNVERIFIED', 'PENDING', 'VERIFIED', 'REJECTED');
ALTER TABLE "organizations" ADD COLUMN "verificationStatus" "OrganizationVerificationStatus" NOT NULL DEFAULT 'UNVERIFIED';
CREATE INDEX "organizations_verificationStatus_createdAt_idx" ON "organizations"("verificationStatus", "createdAt");
