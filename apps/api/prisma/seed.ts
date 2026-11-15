import dotenv from "dotenv";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client.js";
import { ensureDefaultPermissions } from "../src/permissions/permission-catalog.js";

dotenv.config({ path: "../../.env" });
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });

async function main() {
  await prisma.$transaction((tx) => ensureDefaultPermissions(tx));
}

main().finally(async () => prisma.$disconnect());
