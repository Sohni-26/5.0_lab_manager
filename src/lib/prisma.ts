import { PrismaClient, Prisma } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  campusLabPrisma?: PrismaClient;
};

export const prisma: PrismaClient =
  globalForPrisma.campusLabPrisma ??
  new PrismaClient({
    log:
      process.env.NODE_ENV === "development"
        ? ["error", "warn"]
        : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.campusLabPrisma = prisma;
}

/**
 * Injectable database client type supporting both full PrismaClient
 * and interactive transaction clients (as well as test harnesses).
 */
export type DbClient = PrismaClient;
export type TxClient = Prisma.TransactionClient;
export type PrismaLike = DbClient | TxClient;
