import { PrismaClient } from "../generated/prisma/client";

declare global {
  var prisma: PrismaClient | undefined;
}

const prismaClient =
  global.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  global.prisma = prismaClient;
}

export const prisma = prismaClient;

