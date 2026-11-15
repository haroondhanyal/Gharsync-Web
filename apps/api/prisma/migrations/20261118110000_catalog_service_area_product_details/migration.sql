ALTER TABLE "services" ADD COLUMN IF NOT EXISTS "serviceAreas" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "inventory_products" ADD COLUMN IF NOT EXISTS "barcode" VARCHAR(100);
ALTER TABLE "inventory_products" ADD COLUMN IF NOT EXISTS "manufacturer" VARCHAR(120);
ALTER TABLE "inventory_products" ADD COLUMN IF NOT EXISTS "compatibleModels" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "inventory_products" ADD COLUMN IF NOT EXISTS "sellingPrice" DECIMAL(12,2);
CREATE UNIQUE INDEX IF NOT EXISTS "inventory_products_organizationId_barcode_key" ON "inventory_products"("organizationId", "barcode");
