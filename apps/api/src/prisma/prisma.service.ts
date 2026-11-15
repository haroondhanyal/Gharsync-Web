import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { PrismaPg } from "@prisma/adapter-pg";
import { PGlite } from "@electric-sql/pglite";
import { PrismaPGlite } from "pglite-prisma-adapter";
import { PrismaClient } from "../generated/prisma/client.js";
import { readdir, readFile } from "node:fs/promises";
import { mkdirSync } from "node:fs";
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { ensureDefaultPermissions } from "../permissions/permission-catalog.js";

const logger = new Logger("Database");
const embeddedMode = process.env.DATABASE_MODE === "embedded" || (!process.env.DATABASE_MODE && process.env.NODE_ENV === "development");
const embeddedPath = resolve(process.cwd(), "../../var/pglite");
if (embeddedMode) mkdirSync(dirname(embeddedPath), { recursive: true });
const embeddedDb = embeddedMode ? new PGlite(embeddedPath) : null;
const adapter = embeddedDb ? new PrismaPGlite(embeddedDb) : new PrismaPg({ connectionString: process.env.DATABASE_URL });

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor() { super({ adapter }); }

  async onModuleInit() {
    if (embeddedDb) await embeddedDb.waitReady;
    await this.$connect();
    if (embeddedDb) await this.applyEmbeddedMigrations();
    await this.$transaction((tx) => ensureDefaultPermissions(tx));
  }

  private async applyEmbeddedMigrations() {
    const folder = [resolve(process.cwd(), "prisma/migrations"), resolve(process.cwd(), "apps/api/prisma/migrations"), resolve(dirname(fileURLToPath(import.meta.url)), "../../prisma/migrations")].find(existsSync);
    if (!folder) throw new Error("Prisma migration folder could not be found from the API workspace.");
    await embeddedDb!.exec('CREATE TABLE IF NOT EXISTS "_gharsync_local_migrations" ("name" text PRIMARY KEY, "appliedAt" timestamptz NOT NULL DEFAULT now())');
    const appliedRows = await embeddedDb!.query<{ name: string }>('SELECT "name" FROM "_gharsync_local_migrations"');
    const applied = new Set(appliedRows.rows.map((row) => row.name));
    const folders = (await readdir(folder, { withFileTypes: true })).filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort();
    for (const name of folders) {
      if (applied.has(name)) continue;
      const migration = await readFile(resolve(folder, name, "migration.sql"), "utf8");
      await embeddedDb!.exec(migration);
      await embeddedDb!.query('INSERT INTO "_gharsync_local_migrations" ("name") VALUES ($1)', [name]);
      logger.log(`Applied local embedded migration ${name}`);
    }
  }

  async onModuleDestroy() {
    await this.$disconnect();
    if (embeddedDb) await embeddedDb.close();
  }
}
