import dotenv from "dotenv";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client.js";

dotenv.config({ path: "../../.env" });
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });

async function main() {
  // Phase 1 deliberately seeds no sample business/customer records.
  // Role and service-catalog seed data will be added with their owning phases.
  await prisma.$connect();
}

main().finally(async () => prisma.$disconnect());
