import "dotenv/config"
import { PrismaClient } from "../lib/generated/prisma/client"
import { PrismaMariaDb } from "@prisma/adapter-mariadb"
const adapter = new PrismaMariaDb(process.env.MARIADB_URL!)
const prisma = new PrismaClient({ adapter })
async function main() {
  const orgs = await prisma.organization.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } })
  for (const o of orgs) console.log(`${o.id} | ${o.name}`)
  await prisma.$disconnect()
}
main()
