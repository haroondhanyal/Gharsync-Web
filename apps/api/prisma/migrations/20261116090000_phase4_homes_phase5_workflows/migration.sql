-- CreateEnum
CREATE TYPE "QuoteStatus" AS ENUM ('DRAFT', 'SENT', 'ACCEPTED', 'REJECTED', 'EXPIRED', 'SUPERSEDED');

-- CreateEnum
CREATE TYPE "InvoiceStatus" AS ENUM ('ISSUED', 'PARTIALLY_PAID', 'PAID', 'VOID');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING_VERIFICATION', 'VERIFIED', 'REJECTED', 'REFUNDED');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('CASH', 'BANK_TRANSFER', 'CARD', 'DIGITAL_WALLET', 'OTHER');

-- AlterTable
ALTER TABLE "properties" ADD COLUMN     "latitude" DECIMAL(10,7),
ADD COLUMN     "longitude" DECIMAL(10,7);

-- AlterTable
ALTER TABLE "assets" ADD COLUMN     "installedAt" TIMESTAMP(3),
ADD COLUMN     "purchasePrice" DECIMAL(12,2),
ADD COLUMN     "seller" VARCHAR(180),
ADD COLUMN     "warrantyStartsAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "services" ADD COLUMN     "maxPrice" DECIMAL(12,2),
ADD COLUMN     "minPrice" DECIMAL(12,2),
ADD COLUMN     "requiredSkills" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "bookings" ADD COLUMN     "assignedMemberId" UUID,
ADD COLUMN     "internalNotes" TEXT,
ADD COLUMN     "latitude" DECIMAL(10,7),
ADD COLUMN     "longitude" DECIMAL(10,7);

-- CreateTable
CREATE TABLE "service_branches" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "serviceId" UUID NOT NULL,
    "branchId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "service_branches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "documents" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "branchId" UUID,
    "uploaderId" UUID NOT NULL,
    "customerId" UUID,
    "propertyId" UUID,
    "assetId" UUID,
    "bookingId" UUID,
    "fileName" VARCHAR(255) NOT NULL,
    "storageKey" VARCHAR(120) NOT NULL,
    "mimeType" VARCHAR(120) NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "checksum" CHAR(64) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quotes" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "branchId" UUID,
    "bookingId" UUID NOT NULL,
    "revision" INTEGER NOT NULL,
    "status" "QuoteStatus" NOT NULL DEFAULT 'DRAFT',
    "currency" CHAR(3) NOT NULL DEFAULT 'PKR',
    "subtotal" DECIMAL(12,2) NOT NULL,
    "discount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "tax" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "total" DECIMAL(12,2) NOT NULL,
    "notes" TEXT,
    "validUntil" TIMESTAMP(3),
    "createdById" UUID NOT NULL,
    "acceptedAt" TIMESTAMP(3),
    "rejectedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "quotes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quote_items" (
    "id" UUID NOT NULL,
    "quoteId" UUID NOT NULL,
    "description" VARCHAR(240) NOT NULL,
    "quantity" DECIMAL(10,2) NOT NULL,
    "unitPrice" DECIMAL(12,2) NOT NULL,
    "lineTotal" DECIMAL(12,2) NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "quote_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoices" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "branchId" UUID,
    "bookingId" UUID NOT NULL,
    "quoteId" UUID,
    "invoiceNumber" VARCHAR(40) NOT NULL,
    "status" "InvoiceStatus" NOT NULL DEFAULT 'ISSUED',
    "currency" CHAR(3) NOT NULL DEFAULT 'PKR',
    "subtotal" DECIMAL(12,2) NOT NULL,
    "discount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "tax" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "total" DECIMAL(12,2) NOT NULL,
    "dueAt" TIMESTAMP(3),
    "createdById" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "voidedAt" TIMESTAMP(3),

    CONSTRAINT "invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoice_items" (
    "id" UUID NOT NULL,
    "invoiceId" UUID NOT NULL,
    "description" VARCHAR(240) NOT NULL,
    "quantity" DECIMAL(10,2) NOT NULL,
    "unitPrice" DECIMAL(12,2) NOT NULL,
    "lineTotal" DECIMAL(12,2) NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "invoice_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payments" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "branchId" UUID,
    "invoiceId" UUID NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "currency" CHAR(3) NOT NULL DEFAULT 'PKR',
    "method" "PaymentMethod" NOT NULL,
    "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING_VERIFICATION',
    "reference" VARCHAR(180),
    "idempotencyKey" VARCHAR(120),
    "recordedById" UUID NOT NULL,
    "verifiedById" UUID,
    "verifiedAt" TIMESTAMP(3),
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refunds" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "branchId" UUID,
    "paymentId" UUID NOT NULL,
    "invoiceId" UUID NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "reference" VARCHAR(180),
    "reason" VARCHAR(500) NOT NULL,
    "processedById" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refunds_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "service_branches_organizationId_branchId_idx" ON "service_branches"("organizationId", "branchId");

-- CreateIndex
CREATE UNIQUE INDEX "service_branches_serviceId_branchId_key" ON "service_branches"("serviceId", "branchId");

-- CreateIndex
CREATE UNIQUE INDEX "documents_storageKey_key" ON "documents"("storageKey");

-- CreateIndex
CREATE INDEX "documents_organizationId_branchId_createdAt_idx" ON "documents"("organizationId", "branchId", "createdAt");

-- CreateIndex
CREATE INDEX "documents_customerId_createdAt_idx" ON "documents"("customerId", "createdAt");

-- CreateIndex
CREATE INDEX "documents_propertyId_createdAt_idx" ON "documents"("propertyId", "createdAt");

-- CreateIndex
CREATE INDEX "documents_assetId_createdAt_idx" ON "documents"("assetId", "createdAt");

-- CreateIndex
CREATE INDEX "documents_bookingId_createdAt_idx" ON "documents"("bookingId", "createdAt");

-- CreateIndex
CREATE INDEX "quotes_organizationId_branchId_status_createdAt_idx" ON "quotes"("organizationId", "branchId", "status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "quotes_bookingId_revision_key" ON "quotes"("bookingId", "revision");

-- CreateIndex
CREATE INDEX "quote_items_quoteId_sortOrder_idx" ON "quote_items"("quoteId", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "invoices_quoteId_key" ON "invoices"("quoteId");

-- CreateIndex
CREATE INDEX "invoices_bookingId_createdAt_idx" ON "invoices"("bookingId", "createdAt");

-- CreateIndex
CREATE INDEX "invoices_organizationId_branchId_status_createdAt_idx" ON "invoices"("organizationId", "branchId", "status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "invoices_organizationId_invoiceNumber_key" ON "invoices"("organizationId", "invoiceNumber");

-- CreateIndex
CREATE INDEX "invoice_items_invoiceId_sortOrder_idx" ON "invoice_items"("invoiceId", "sortOrder");

-- CreateIndex
CREATE INDEX "payments_organizationId_branchId_status_createdAt_idx" ON "payments"("organizationId", "branchId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "payments_invoiceId_status_idx" ON "payments"("invoiceId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "payments_organizationId_idempotencyKey_key" ON "payments"("organizationId", "idempotencyKey");

-- CreateIndex
CREATE INDEX "refunds_organizationId_branchId_createdAt_idx" ON "refunds"("organizationId", "branchId", "createdAt");

-- CreateIndex
CREATE INDEX "refunds_invoiceId_createdAt_idx" ON "refunds"("invoiceId", "createdAt");

-- CreateIndex
CREATE INDEX "bookings_organizationId_assignedMemberId_scheduledAt_idx" ON "bookings"("organizationId", "assignedMemberId", "scheduledAt");

-- AddForeignKey
ALTER TABLE "service_branches" ADD CONSTRAINT "service_branches_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_branches" ADD CONSTRAINT "service_branches_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "services"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_branches" ADD CONSTRAINT "service_branches_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_assignedMemberId_fkey" FOREIGN KEY ("assignedMemberId") REFERENCES "organization_members"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_uploaderId_fkey" FOREIGN KEY ("uploaderId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "properties"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "assets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "bookings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "bookings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quote_items" ADD CONSTRAINT "quote_items_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "quotes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "bookings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "quotes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice_items" ADD CONSTRAINT "invoice_items_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "invoices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_recordedById_fkey" FOREIGN KEY ("recordedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_verifiedById_fkey" FOREIGN KEY ("verifiedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "payments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "invoices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_processedById_fkey" FOREIGN KEY ("processedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
