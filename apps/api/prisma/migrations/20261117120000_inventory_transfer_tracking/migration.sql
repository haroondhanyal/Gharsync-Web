-- Keep this additive migration safe for local PGlite databases that already applied the Phase 6–7 base migration.
ALTER TABLE "stock_movements" ADD COLUMN IF NOT EXISTS "transferGroupId" UUID;
CREATE INDEX IF NOT EXISTS "stock_movements_transferGroupId_idx" ON "stock_movements"("transferGroupId");
