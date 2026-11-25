import { PrismaLibSql } from "@prisma/adapter-libsql";
import { PrismaClient } from "../generated/prisma/client";

// Prisma 7 requires a driver adapter. Bun can't load better-sqlite3's native
// module, so we use the libSQL adapter, which also works with plain SQLite files.
// Swapping to PostgreSQL later means swapping this adapter (@prisma/adapter-pg).
const adapter = new PrismaLibSql({
  url: process.env.DATABASE_URL ?? "file:./dev.db",
});

export const prisma = new PrismaClient({ adapter });
