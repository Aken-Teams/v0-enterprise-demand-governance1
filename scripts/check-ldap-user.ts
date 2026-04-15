import "dotenv/config"
import { PrismaClient } from "../lib/generated/prisma/client"
import { PrismaMariaDb } from "@prisma/adapter-mariadb"
const adapter = new PrismaMariaDb(process.env.MARIADB_URL!)
const prisma = new PrismaClient({ adapter })
async function main() {
  const byLdap = await prisma.user.findMany({
    where: { ldapUsername: "ad27" },
    select: { id: true, name: true, email: true, ldapUsername: true, ldapDomain: true, isActive: true, role: true, organization: { select: { name: true } } },
  })
  console.log("ldapUsername=ad27:", JSON.stringify(byLdap, null, 2))

  const byMail = await prisma.user.findMany({
    where: { email: { contains: "lhd" } },
    select: { id: true, name: true, email: true, ldapUsername: true, ldapDomain: true, isActive: true },
  })
  console.log("email contains lhd:", JSON.stringify(byMail, null, 2))

  // Also list all WXPJ domain users
  const wxpj = await prisma.user.findMany({
    where: { ldapDomain: "WXPJ" },
    select: { id: true, name: true, email: true, ldapUsername: true, ldapDomain: true, isActive: true },
  })
  console.log("ldapDomain=WXPJ:", JSON.stringify(wxpj, null, 2))

  await prisma.$disconnect()
}
main()
