import "dotenv/config"
import { PrismaClient } from "../lib/generated/prisma/client"
import { PrismaMariaDb } from "@prisma/adapter-mariadb"
const adapter = new PrismaMariaDb(process.env.MARIADB_URL!)
const prisma = new PrismaClient({ adapter })
async function main() {
  const users = await prisma.user.findMany({
    where: { role: { in: ["admin", "viewer"] } },
    select: { id: true, name: true, role: true, canViewFinancial: true },
  })
  for (const u of users) {
    console.log(`${u.name} (${u.role}) canViewFinancial: ${u.canViewFinancial}`)
  }
  await prisma.$disconnect()
}
main()
