import "dotenv/config"
import { PrismaClient } from "../lib/generated/prisma/client"
import { PrismaMariaDb } from "@prisma/adapter-mariadb"

async function main() {
  const adapter = new PrismaMariaDb(process.env.DATABASE_URL!)
  const prisma = new PrismaClient({ adapter })

  const result = await prisma.demand.updateMany({
    where: { status: "CLOSED" },
    data: { contactPerson: "JOJO" },
  })
  console.log("Updated", result.count, "CLOSED demands → contactPerson: JOJO")

  const verify = await prisma.demand.findMany({
    where: { status: "CLOSED" },
    select: { demandNumber: true, contactPerson: true },
  })
  for (const d of verify) {
    console.log(d.demandNumber, "→", d.contactPerson)
  }
}
main()
