import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "./generated/prisma/client.ts";

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL,
  max: 2,
  connectionTimeoutMillis: 1000,
});

export const prisma = new PrismaClient({ adapter });