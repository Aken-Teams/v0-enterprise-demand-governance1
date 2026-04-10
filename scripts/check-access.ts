import "dotenv/config"
import { PrismaClient } from "../lib/generated/prisma/client"
import { PrismaMariaDb } from "@prisma/adapter-mariadb"

console.log("URL:", process.env.MARIADB_URL?.substring(0, 30))
const adapter = new PrismaMariaDb(process.env.MARIADB_URL!)
const prisma = new PrismaClient({ adapter })

async function main() {
  const users = await prisma.user.findMany({
    where: { isActive: true, organization: { name: "強茂" }, role: { in: ["subsidiary", "viewer"] } },
    select: {
      name: true, email: true,
      demandAccessGrants: { select: { signoffRole: true } },
    },
    orderBy: { name: "asc" },
  })
  for (const u of users) {
    const roles = [...new Set(u.demandAccessGrants.map(a => a.signoffRole))]
    console.log(`${u.name}\t${u.email}\t${JSON.stringify(roles)}`)
  }
  await prisma.$disconnect()
}
main()
