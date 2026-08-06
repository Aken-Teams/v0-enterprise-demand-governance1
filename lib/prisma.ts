import { PrismaClient } from "@/lib/generated/prisma/client"
import { PrismaMariaDb } from "@prisma/adapter-mariadb"

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient }

// 只有在需要建立新 client 時才建立連線池（adapter）。
// 若把 `new PrismaMariaDb(...)` 放在模組頂層，dev 每次 HMR 重載都會多開一個連線池，
// 造成遠端 DB 連線數被吃光、查詢排隊逾時（pool timeout）。用 ?? 短路可避免。
export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({ adapter: new PrismaMariaDb(process.env.DATABASE_URL!) })

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma
