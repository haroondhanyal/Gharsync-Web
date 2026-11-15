-- CreateEnum
CREATE TYPE "TimeOffStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "StockMovementType" AS ENUM ('RECEIPT', 'ADJUSTMENT', 'RESERVATION', 'RELEASE', 'CONSUMPTION', 'TRANSFER_IN', 'TRANSFER_OUT');

-- CreateEnum
CREATE TYPE "WarrantyClaimStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED', 'RESOLVED');

-- CreateTable
CREATE TABLE "technician_profiles" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "memberId" UUID NOT NULL,
    "skills" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "employmentType" VARCHAR(30) NOT NULL DEFAULT 'FULL_TIME',
    "hourlyRate" DECIMAL(12,2),
    "bio" TEXT,
    "isAvailable" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "technician_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "technician_availability" (
    "id" UUID NOT NULL,
    "profileId" UUID NOT NULL,
    "weekday" INTEGER NOT NULL,
    "startMinute" INTEGER NOT NULL,
    "endMinute" INTEGER NOT NULL,
    "isAvailable" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "technician_availability_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "technician_time_off" (
    "id" UUID NOT NULL,
    "profileId" UUID NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "reason" VARCHAR(240),
    "status" "TimeOffStatus" NOT NULL DEFAULT 'PENDING',
    "reviewedById" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "technician_time_off_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "suppliers" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "name" VARCHAR(180) NOT NULL,
    "phone" VARCHAR(32),
    "email" VARCHAR(320),
    "address" VARCHAR(500),
    "notes" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "suppliers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_products" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "supplierId" UUID,
    "sku" VARCHAR(80) NOT NULL,
    "name" VARCHAR(180) NOT NULL,
    "category" VARCHAR(100) NOT NULL,
    "description" TEXT,
    "unit" VARCHAR(30) NOT NULL DEFAULT 'unit',
    "unitCost" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "reorderLevel" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "tracksWarranty" BOOLEAN NOT NULL DEFAULT false,
    "warrantyDays" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "inventory_products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_stocks" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "branchId" UUID NOT NULL,
    "productId" UUID NOT NULL,
    "quantity" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "reserved" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "inventory_stocks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_movements" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "branchId" UUID NOT NULL,
    "productId" UUID NOT NULL,
    "bookingId" UUID,
    "transferGroupId" UUID,
    "createdById" UUID NOT NULL,
    "type" "StockMovementType" NOT NULL,
    "quantity" DECIMAL(12,2) NOT NULL,
    "unitCost" DECIMAL(12,2),
    "reference" VARCHAR(120),
    "notes" VARCHAR(500),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stock_movements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "warranty_claims" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "branchId" UUID,
    "assetId" UUID NOT NULL,
    "productId" UUID,
    "supplierId" UUID,
    "status" "WarrantyClaimStatus" NOT NULL DEFAULT 'DRAFT',
    "claimNumber" VARCHAR(50) NOT NULL,
    "issue" VARCHAR(1000) NOT NULL,
    "resolution" TEXT,
    "submittedAt" TIMESTAMP(3),
    "resolvedAt" TIMESTAMP(3),
    "createdById" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "warranty_claims_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "technician_profiles_memberId_key" ON "technician_profiles"("memberId");

-- CreateIndex
CREATE INDEX "technician_profiles_organizationId_isAvailable_idx" ON "technician_profiles"("organizationId", "isAvailable");

-- CreateIndex
CREATE UNIQUE INDEX "technician_availability_profileId_weekday_key" ON "technician_availability"("profileId", "weekday");

-- CreateIndex
CREATE INDEX "technician_time_off_profileId_startsAt_endsAt_idx" ON "technician_time_off"("profileId", "startsAt", "endsAt");

-- CreateIndex
CREATE INDEX "suppliers_organizationId_isActive_name_idx" ON "suppliers"("organizationId", "isActive", "name");

-- CreateIndex
CREATE UNIQUE INDEX "suppliers_organizationId_name_key" ON "suppliers"("organizationId", "name");

-- CreateIndex
CREATE INDEX "inventory_products_organizationId_category_isActive_idx" ON "inventory_products"("organizationId", "category", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "inventory_products_organizationId_sku_key" ON "inventory_products"("organizationId", "sku");

-- CreateIndex
CREATE INDEX "inventory_stocks_organizationId_branchId_idx" ON "inventory_stocks"("organizationId", "branchId");

-- CreateIndex
CREATE UNIQUE INDEX "inventory_stocks_branchId_productId_key" ON "inventory_stocks"("branchId", "productId");

-- CreateIndex
CREATE INDEX "stock_movements_organizationId_branchId_createdAt_idx" ON "stock_movements"("organizationId", "branchId", "createdAt");

-- CreateIndex
CREATE INDEX "stock_movements_productId_createdAt_idx" ON "stock_movements"("productId", "createdAt");

-- CreateIndex
CREATE INDEX "stock_movements_transferGroupId_idx" ON "stock_movements"("transferGroupId");

-- CreateIndex
CREATE INDEX "warranty_claims_organizationId_branchId_status_createdAt_idx" ON "warranty_claims"("organizationId", "branchId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "warranty_claims_assetId_createdAt_idx" ON "warranty_claims"("assetId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "warranty_claims_organizationId_claimNumber_key" ON "warranty_claims"("organizationId", "claimNumber");

-- AddForeignKey
ALTER TABLE "technician_profiles" ADD CONSTRAINT "technician_profiles_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "technician_profiles" ADD CONSTRAINT "technician_profiles_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "organization_members"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "technician_availability" ADD CONSTRAINT "technician_availability_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "technician_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "technician_time_off" ADD CONSTRAINT "technician_time_off_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "technician_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "technician_time_off" ADD CONSTRAINT "technician_time_off_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "suppliers" ADD CONSTRAINT "suppliers_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_products" ADD CONSTRAINT "inventory_products_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_products" ADD CONSTRAINT "inventory_products_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "suppliers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_stocks" ADD CONSTRAINT "inventory_stocks_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_stocks" ADD CONSTRAINT "inventory_stocks_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_stocks" ADD CONSTRAINT "inventory_stocks_productId_fkey" FOREIGN KEY ("productId") REFERENCES "inventory_products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_productId_fkey" FOREIGN KEY ("productId") REFERENCES "inventory_products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "bookings"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "warranty_claims" ADD CONSTRAINT "warranty_claims_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "warranty_claims" ADD CONSTRAINT "warranty_claims_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "warranty_claims" ADD CONSTRAINT "warranty_claims_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "assets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "warranty_claims" ADD CONSTRAINT "warranty_claims_productId_fkey" FOREIGN KEY ("productId") REFERENCES "inventory_products"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "warranty_claims" ADD CONSTRAINT "warranty_claims_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "suppliers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
