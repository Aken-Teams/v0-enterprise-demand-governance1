import "dotenv/config"
import { PrismaMariaDb } from "@prisma/adapter-mariadb"
import { PrismaClient } from "../lib/generated/prisma/client"

const adapter = new PrismaMariaDb(process.env.DATABASE_URL!)
const prisma = new PrismaClient({ adapter })

async function main() {
  const d = await prisma.demand.findFirst({
    where: { demandNumber: "REQ-2026-005" },
    select: { id: true },
  })
  const plans = await prisma.demandPhasePlan.findMany({
    where: { demandId: d!.id },
    select: { phase: true, plannedSp: true, originalPlannedSp: true },
  })
  console.log(JSON.stringify(plans, null, 2))
  await prisma.$disconnect()
}
main()
